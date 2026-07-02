// One ephemeral fork per visitor. The fork's Durable Object holds a Workspace
// (theme.css + page snapshots) edited by a Think tool loop, and a
// content-addressed version history of committed states. The worker serves
// pages copy-on-write: ASSETS by default, workspace-shadowed paths for edited
// pages, committed theme CSS injected at serve time.
//
// Free tier: the content lock is architectural — write access is
// tool-allowlisted to theme.css, and the single-call fallback has no tools at
// all. The BYO tier (a valid auth record in this DO plus the grant cookie —
// see PLANS/byo-auth.md) opens the write allowlist and runs on the visitor's
// own ChatGPT or Cloudflare credential; tokens live only here, never in
// cookies or the browser.

import {
  Think,
  Workspace,
  type StreamCallback,
  type ToolCallContext,
  type ToolCallDecision,
  type TurnConfig,
} from "@cloudflare/think";
import { generateText, tool, type LanguageModel, type ToolSet } from "ai";
import { z } from "zod";
import { type AuthRecord, refreshAuthRecord } from "./auth";
import {
  AGENT_LOOP_SYSTEM,
  AGENT_SYSTEM,
  FORK_JS_CONTRACT,
  FORK_JS_FILE,
  FREE_RESTYLES_PER_DAY,
  MODEL_SUPPORTS_TOOLS,
  PAGES_DIR,
  ROOT,
  SEED_THEME,
  SNAPSHOT_ROUTES,
  THEME_FILE,
  TIER_MODELS,
  WRITE_ALLOWLIST,
  isWriteAllowed,
  type ModelTier,
} from "./config";
import { modelFor } from "./models";
import { normalizeRoute, type ServedPage } from "./serving";
import {
  ORIGINAL_ID,
  commitVersion,
  currentManifest,
  currentVersionId,
  getManifest,
  listVersions,
  manifestFile,
  materializeVersion,
  rollbackToCurrent,
  seedOriginalVersion,
  wipeVersions,
  type VersionSummary,
} from "./versions";

export interface RemixAuthState {
  provider: "chatgpt" | "cloudflare" | null;
  label: string | null;
  expired?: boolean;
}

export interface RemixState {
  versions: VersionSummary[];
  auth: RemixAuthState;
  error?: string;
}

interface FreeUsage {
  day: string;
  count: number;
}

type Artifact = "css" | "html" | "js" | "file";

function artifactFor(path: string): Artifact {
  if (path === THEME_FILE) return "css";
  if (path.startsWith(`${PAGES_DIR}/`) && path.endsWith(".html")) return "html";
  if (path === FORK_JS_FILE) return "js";
  return "file";
}

// Per-turn state. The workspace is the working tree: change events stream to
// the initiating tab as hot-reload previews, and the turn commits (or rolls
// back) the workspace as a whole.
interface ActiveTurn {
  /** Gates change events: seeding/rollback writes must not emit. */
  live: boolean;
  seq: number;
  changed: Set<string>;
  send: (obj: unknown) => void;
  /** Serializes async css-content reads so events stay seq-ordered. */
  queue: Promise<void>;
}

// Pull usable CSS out of a model reply: unwrap markdown fences, drop anything
// that could close the injected <style> tag, reject non-CSS.
function extractCss(text: string): string | null {
  let out = text.trim();
  const fence = out.match(/```(?:css)?\s*([\s\S]*?)```/);
  if (fence) out = fence[1].trim();
  out = out.replace(/<\/style/gi, "");
  if (!out.includes("{") || !out.includes("}")) return null;
  return out;
}

function isAuthFailure(err: unknown): boolean {
  const status = (err as { statusCode?: number } | null)?.statusCode;
  return status === 401 || /\b401\b|unauthorized/i.test(String(err));
}

// Scout occasionally leaks a tool call as JSON text (finish "stop", nothing
// written). If the leak parses to write-tool args, salvage the write.
function findWriteArgs(value: unknown, depth = 0): { path: string; content: string } | null {
  if (!value || typeof value !== "object" || depth > 3) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findWriteArgs(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.path === "string" && typeof obj.content === "string") {
    return { path: obj.path, content: obj.content };
  }
  for (const key of ["parameters", "arguments", "input", "args"]) {
    const found = findWriteArgs(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function salvageToolWrite(text: string): { path: string; content: string } | null {
  const candidates: unknown[] = [];
  const tryParse = (raw: string) => {
    try {
      candidates.push(JSON.parse(raw));
    } catch {
      /* not JSON */
    }
  };
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) tryParse(fence[1].trim());
  tryParse(trimmed);
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) tryParse(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    const found = findWriteArgs(candidate);
    if (found && found.content.includes("{") && found.content.includes("}")) return found;
  }
  return null;
}

export class UserApp extends Think<Env> {
  override workspace = new Workspace({
    sql: this.ctx.storage.sql,
    namespace: "user",
    name: () => this.name,
    onChange: (event) => this.onWorkspaceChange(event),
  });
  workspaceBash = false;
  chatStreamStallTimeoutMs = 120000;

  private readyPromise?: Promise<void>;
  private turn?: ActiveTurn;
  private authRefreshPromise?: Promise<AuthRecord | null>;
  // The turn-scoped credential: set at turn start when the fork holds a valid
  // auth record AND the router verified the grant cookie; cleared when the
  // turn ends or degrades to free. tier() keys off it.
  private turnAuth: AuthRecord | null = null;

  // ── model seam ──────────────────────────────────────────────────────
  tier(): ModelTier {
    return this.turnAuth ? "byo" : "free";
  }
  getModelFor(tier: ModelTier, kind: "loop" | "fallback" = "loop"): LanguageModel {
    return modelFor(this.env, tier === "byo" ? this.turnAuth : null, TIER_MODELS[tier][kind]);
  }
  override getModel() {
    return this.getModelFor(this.tier());
  }
  override getSystemPrompt() {
    if (this.tier() === "byo") return `${AGENT_LOOP_SYSTEM}\n\n${FORK_JS_CONTRACT}`;
    return AGENT_LOOP_SYSTEM;
  }
  // Without explicit headroom the Workers AI default output cap (~256 tokens)
  // truncates the write tool's args mid-stylesheet. chat() options don't carry
  // maxOutputTokens — only TurnConfig reaches streamText.
  override beforeTurn(): TurnConfig {
    return { maxOutputTokens: 8000 };
  }
  // Whether this tier's turn can drive the Think tool loop. The ChatGPT tier
  // has native tool calling; every other tier keys off the provider-bridge
  // probe results in config.
  private supportsLoop(tier: ModelTier): boolean {
    if (tier === "byo" && this.turnAuth?.provider === "chatgpt") return true;
    return MODEL_SUPPORTS_TOOLS[TIER_MODELS[tier].loop] === true;
  }

  // ── auth (BYO model, see PLANS/byo-auth.md) ─────────────────────────
  // Tokens live only here; the browser and every API response see just
  // {provider, label}.

  async setAuth(record: AuthRecord): Promise<void> {
    await this.ctx.storage.put("auth", record);
  }

  // Deletes the record and returns it so the caller can best-effort revoke.
  async clearAuth(): Promise<AuthRecord | null> {
    const record = (await this.ctx.storage.get<AuthRecord>("auth")) ?? null;
    await this.ctx.storage.delete("auth");
    return record;
  }

  // Throttle for the ChatGPT device-code poll relay. The signed tx cookie is
  // client-held (replayable), so the last-poll timestamp must live here.
  async devicePollGate(minIntervalMs: number): Promise<boolean> {
    const last = (await this.ctx.storage.get<number>("devicePollAt")) ?? 0;
    const now = Date.now();
    if (now - last < minIntervalMs) return false;
    await this.ctx.storage.put("devicePollAt", now);
    return true;
  }

  private async markAuthExpired(): Promise<void> {
    const record = await this.ctx.storage.get<AuthRecord>("auth");
    if (record) await this.ctx.storage.put("auth", { ...record, invalid: true });
  }

  // Returns a usable record (refreshed if near expiry) or null. Both
  // providers rotate refresh tokens on use, so refresh is single-flight and
  // the rotated pair is persisted before the promise resolves — concurrent
  // restyles can't race a single-use refresh token into invalid_grant.
  private async freshAuth(): Promise<AuthRecord | null> {
    const record = await this.ctx.storage.get<AuthRecord>("auth");
    if (!record || record.invalid) return null;
    if (Date.now() < record.expiresAt - 60_000) return record;
    if (!this.authRefreshPromise) {
      this.authRefreshPromise = (async () => {
        const current = await this.ctx.storage.get<AuthRecord>("auth");
        if (!current || current.invalid) return null;
        if (Date.now() < current.expiresAt - 60_000) return current;
        const rotated = await refreshAuthRecord(this.env, current);
        if (rotated === "denied") {
          await this.ctx.storage.put("auth", { ...current, invalid: true });
          return null;
        }
        if (!rotated) return null;
        await this.ctx.storage.put("auth", rotated);
        return rotated;
      })();
      this.authRefreshPromise.finally(() => {
        this.authRefreshPromise = undefined;
      });
    }
    return this.authRefreshPromise;
  }

  private async authState(): Promise<RemixAuthState> {
    const record = await this.ctx.storage.get<AuthRecord>("auth");
    if (!record) return { provider: null, label: null };
    return { provider: record.provider, label: record.label, expired: record.invalid === true };
  }

  // The free tier bills Matt; cap restyles per fork per day.
  private async consumeFreeRestyle(): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    const usage = await this.ctx.storage.get<FreeUsage>("freeUsage");
    const count = usage?.day === today ? usage.count : 0;
    if (count >= FREE_RESTYLES_PER_DAY) return false;
    await this.ctx.storage.put("freeUsage", { day: today, count: count + 1 });
    return true;
  }

  // ── tools ───────────────────────────────────────────────────────────
  // Workspace read/write/edit/... tools are merged in by Think itself;
  // beforeToolCall enforces the per-tier write allowlist over them.
  override getTools(): ToolSet {
    const tools: ToolSet = {
      commit: tool({
        description:
          "Save the current workspace as a named version in the fork's history. Optional — changes are committed automatically when the turn succeeds.",
        inputSchema: z.object({
          message: z.string().describe("Short human-readable label for this version"),
        }),
        execute: async ({ message }) => {
          const manifest = await commitVersion(
            this.ctx.storage,
            this.workspace,
            message.slice(0, 72),
          );
          return manifest
            ? { committed: manifest.id.slice(0, 7) }
            : { committed: false, reason: "no changes since the last version" };
        },
      }),
    };
    if (this.tier() === "byo") {
      tools.snapshot_page = tool({
        description:
          'Copy a live page of the site into the workspace so it can be edited. Pass the route, e.g. "/blog/".',
        inputSchema: z.object({ route: z.string().describe("Page route, e.g. /work/") }),
        execute: async ({ route }) => {
          const ok = await this.snapshotRoute(normalizeRoute(route));
          return ok
            ? { snapshotted: `${PAGES_DIR}${normalizeRoute(route)}` }
            : { error: "No such page on the live site." };
        },
      });
    }
    return tools;
  }

  override beforeToolCall(ctx: ToolCallContext): ToolCallDecision | void {
    if (ctx.toolName !== "write" && ctx.toolName !== "edit" && ctx.toolName !== "delete") return;
    const tier = this.tier();
    const input = ctx.input as { path?: unknown } | undefined;
    const path = typeof input?.path === "string" ? input.path : "";
    if (ctx.toolName === "delete" && tier === "free") {
      return {
        action: "block",
        reason: "Deleting files is disabled. Overwrite the theme with write instead.",
      };
    }
    if (!isWriteAllowed(path, tier)) {
      return {
        action: "block",
        reason: `Write access is limited to: ${WRITE_ALLOWLIST[tier].join(", ")}. Read tools may use any workspace path.`,
      };
    }
  }

  // ── lifecycle ───────────────────────────────────────────────────────
  // Bump when the seed layout changes; forks from older layouts (including
  // the v2 single-css versions array) are wiped and reseeded.
  private static readonly SEED_VERSION = 3;

  private async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        const seeded = await this.ctx.storage.get<number>("seedVersion");
        if (seeded === UserApp.SEED_VERSION) return;

        await this.workspace.rm(ROOT, { recursive: true }).catch(() => undefined);
        await this.clearMessages().catch(() => undefined);
        await wipeVersions(this.ctx.storage);
        await this.ctx.storage.delete("versions"); // pre-v3 single-css history
        // Snapshot the real prerendered pages so the agent can read the actual
        // markup it is styling.
        for (const route of SNAPSHOT_ROUTES) {
          await this.snapshotRoute(route);
        }
        await this.workspace.writeFile(THEME_FILE, SEED_THEME);
        await seedOriginalVersion(this.ctx.storage, this.workspace);
        await this.ctx.storage.put("seedVersion", UserApp.SEED_VERSION);
      })();
      this.readyPromise.catch(() => {
        this.readyPromise = undefined;
      });
    }
    return this.readyPromise;
  }

  private async snapshotRoute(route: string): Promise<boolean> {
    try {
      const res = await this.env.ASSETS.fetch(new Request(`https://assets.local${route}`));
      if (!res.ok) return false;
      await this.workspace.writeFile(`${PAGES_DIR}${normalizeRoute(route)}`, await res.text());
      return true;
    } catch {
      return false; // snapshot is best-effort
    }
  }

  // ── hot reload: workspace change events ─────────────────────────────
  private onWorkspaceChange(event: { type: "create" | "update" | "delete"; path: string }): void {
    const turn = this.turn;
    if (!turn || !turn.live || !event.path.startsWith(`${ROOT}/`)) return;
    const seq = ++turn.seq;
    const artifact = artifactFor(event.path);
    turn.changed.add(event.path);
    turn.send({ kind: "file", seq, path: event.path, change: event.type, artifact });
    if (artifact === "css" && event.type !== "delete") {
      // CSS rides the SSE inline: tiny, and the instant-repaint hero.
      turn.queue = turn.queue.then(async () => {
        const css = await this.workspace.readFile(THEME_FILE).catch(() => null);
        if (css !== null) turn.send({ kind: "css", seq, css });
      });
    } else if (artifact === "html") {
      // HTML is notify+fetch: the client pulls /api/remix/preview/page for
      // the route it is viewing, coalescing by seq.
      turn.send({ kind: "page", seq, route: event.path.slice(PAGES_DIR.length) });
    }
  }

  // ── RPC: copy-on-write page serving ─────────────────────────────────
  async getServed(pathname: string): Promise<ServedPage> {
    await this.ensureReady();
    const storage = this.ctx.storage;
    const current = await currentManifest(storage);
    if (!current) return { source: "assets", css: "" };
    const css =
      current.id === ORIGINAL_ID ? "" : ((await manifestFile(storage, current, THEME_FILE)) ?? "");
    const forkJsHash = current.files[FORK_JS_FILE];
    const forkJsVersion = forkJsHash ? forkJsHash.slice(0, 8) : undefined;

    const page = `${PAGES_DIR}${normalizeRoute(pathname)}`;
    const pageHash = current.files[page];
    if (pageHash) {
      const original = await getManifest(storage, ORIGINAL_ID);
      if (pageHash !== original?.files[page]) {
        const html = await manifestFile(storage, current, page);
        if (html !== null) return { source: "fork", html, css, forkJsVersion };
      }
    }
    return { source: "assets", css, forkJsVersion };
  }

  // ── RPC: live workspace reads (mid-turn previews, /remix-assets) ────
  async previewFile(path: string): Promise<string | null> {
    if (!path.startsWith(`${ROOT}/`) || path.includes("..")) return null;
    await this.ensureReady();
    return this.workspace.readFile(path).catch(() => null);
  }

  // ── RPC: state ──────────────────────────────────────────────────────
  async remixState(): Promise<RemixState> {
    await this.ensureReady();
    return { versions: await listVersions(this.ctx.storage), auth: await this.authState() };
  }

  // ── RPC: agentic restyle (SSE stream) ───────────────────────────────
  // allowPaid: the router verified the HttpOnly remix_auth grant cookie, so
  // this caller may spend the signed-in user's tokens.
  streamAgentEdit(prompt: string, allowPaid = false): ReadableStream {
    const enc = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    const send = (obj: unknown) => {
      try {
        controller.enqueue(enc.encode("data: " + JSON.stringify(obj) + "\n\n"));
      } catch {
        /* closed */
      }
    };
    const close = () => {
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    };

    // Reserve the turn synchronously so overlapping requests can't interleave.
    const busy = this.turn !== undefined;
    const turn: ActiveTurn = {
      live: false,
      seq: 0,
      changed: new Set(),
      send,
      queue: Promise.resolve(),
    };
    if (!busy) this.turn = turn;

    const providerName = (record: AuthRecord) =>
      record.provider === "chatgpt" ? "ChatGPT" : "Cloudflare";

    // One tier's worth of restyling: the tool loop when the tier supports it,
    // the single-call CSS path otherwise (or when the loop produced nothing).
    const runTier = async (tier: ModelTier, signal: AbortSignal) => {
      let looped = false;
      if (this.supportsLoop(tier)) {
        looped = await this.runToolLoop(prompt, turn, tier, signal);
      }
      if (!looped && !turn.changed.has(THEME_FILE)) {
        send({ kind: "status", text: "Designing your theme..." });
        await this.runSingleCall(prompt, turn, tier, signal);
      }
    };

    const run = async () => {
      if (busy) {
        send({ kind: "done", error: "A restyle is already running — wait for it to finish." });
        return close();
      }
      const abort = new AbortController();
      const watchdog = setTimeout(() => abort.abort(), 120_000);
      try {
        await this.ensureReady();

        // Resolve the tier. A signed-in fork whose refresh is expired/denied
        // degrades to the free tier with a status message — the turn still
        // runs rather than failing.
        this.turnAuth = null;
        const record = await this.ctx.storage.get<AuthRecord>("auth");
        if (record && allowPaid) {
          this.turnAuth = await this.freshAuth();
          if (!this.turnAuth) {
            send({
              kind: "status",
              text: `Your ${providerName(record)} session expired — continuing with the free model. Sign in again to restore it.`,
            });
          }
        }
        if (!this.turnAuth && !(await this.consumeFreeRestyle())) {
          send({
            kind: "done",
            error:
              "Free restyles are used up for today — sign in with ChatGPT or Cloudflare, or come back tomorrow.",
          });
          return close();
        }

        const baseId = await currentVersionId(this.ctx.storage);
        turn.live = true;
        send({ kind: "status", text: "Reading the site..." });

        try {
          await runTier(this.tier(), abort.signal);
        } catch (err) {
          // A revoked/expired credential mid-turn degrades to the free tier
          // with a status message rather than failing the turn.
          const failedAuth = this.turnAuth;
          if (!failedAuth || abort.signal.aborted || !isAuthFailure(err)) throw err;
          await this.markAuthExpired();
          this.turnAuth = null;
          if (!(await this.consumeFreeRestyle())) throw err;
          send({
            kind: "status",
            text: `Your ${providerName(failedAuth)} session expired — continuing with the free model. Sign in again to restore it.`,
          });
          await runTier("free", abort.signal);
        }
        await turn.queue;

        this.turn = undefined;
        let manifest =
          turn.changed.size > 0
            ? await commitVersion(this.ctx.storage, this.workspace, prompt.slice(0, 72))
            : null;
        if (!manifest) {
          // The model may have already committed via the commit tool, in which
          // case the workspace matches current and commitVersion returns null —
          // still a successful turn.
          const committed = await currentManifest(this.ctx.storage);
          if (committed && committed.id !== baseId) manifest = committed;
        }
        if (manifest) {
          send({
            kind: "done",
            ok: true,
            version: {
              id: manifest.id,
              short: manifest.id.slice(0, 7),
              message: manifest.message,
            },
          });
        } else {
          send({ kind: "done", error: "That didn't produce a new style. Try rephrasing." });
        }
      } catch (err) {
        // A failed turn must not leave half-written preview state: restore
        // the workspace from the committed version.
        this.turn = undefined;
        const rolledBack = await rollbackToCurrent(this.ctx.storage, this.workspace).catch(
          () => false,
        );
        if (this.turnAuth && isAuthFailure(err) && !abort.signal.aborted) {
          await this.markAuthExpired();
          send({
            kind: "done",
            error: `Your ${providerName(this.turnAuth)} session expired — sign in again.`,
            auth: "expired",
            rolledBack,
          });
        } else {
          const message = abort.signal.aborted
            ? "That took too long — please try again."
            : // A deploy resets live DOs mid-query; the retry lands on fresh code.
              /code was updated/i.test(String(err))
              ? "The site was just redeployed — please try again."
              : String(err instanceof Error ? err.message : err).slice(0, 200);
          send({ kind: "done", error: message, rolledBack });
        }
      } finally {
        clearTimeout(watchdog);
        this.turn = undefined;
        this.turnAuth = null;
        close();
      }
    };
    run();
    return stream;
  }

  // The Think tool loop: workspace tools + the write allowlist, streaming
  // UI chunks through to the SSE consumer. Returns true once the theme file
  // was written (directly or via the leak salvage).
  private async runToolLoop(
    prompt: string,
    turn: ActiveTurn,
    tier: ModelTier,
    signal: AbortSignal,
  ): Promise<boolean> {
    let leakedText = "";
    let chatError: string | undefined;
    const callback: StreamCallback = {
      onStart: () => {},
      onEvent: (json: string) => {
        turn.send({ kind: "event", chunk: json });
        try {
          const chunk = JSON.parse(json) as { type?: string; delta?: string };
          if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
            leakedText += chunk.delta;
          }
        } catch {
          /* presentation only */
        }
      },
      onDone: () => {},
      onError: (error: string) => {
        chatError = error;
      },
    };
    const salvage = async (): Promise<boolean> => {
      const call = salvageToolWrite(leakedText);
      if (!call) return false;
      const path = call.path.startsWith("/") ? call.path : `/${call.path}`;
      if (!isWriteAllowed(path, tier)) return false;
      await this.workspace.writeFile(path, call.content);
      return true;
    };

    // Output-token headroom rides beforeTurn() — ChatOptions has no
    // maxOutputTokens field.
    const chatConfig = { signal };
    await this.chat(this.buildLoopPrompt(prompt), callback, chatConfig);
    if (signal.aborted) throw new Error("timeout");
    // Surface a credential failure so the caller can degrade the tier
    // instead of burning the fallback call on a dead token.
    if (chatError && tier === "byo" && isAuthFailure(chatError)) throw new Error(chatError);
    if (turn.changed.has(THEME_FILE)) return true;
    if (chatError) return false; // degrade to the single-call path
    if (await salvage()) return true;

    // Text-leak turn with nothing to salvage: one corrective retry.
    turn.send({ kind: "status", text: "One more pass..." });
    leakedText = "";
    await this.chat(
      `Your last reply printed the tool call as text instead of invoking it — nothing was written. Call the write tool now with path ${THEME_FILE} and the complete stylesheet as content. Do not print JSON.`,
      callback,
      chatConfig,
    );
    if (signal.aborted) throw new Error("timeout");
    if (turn.changed.has(THEME_FILE)) return true;
    return salvage();
  }

  private buildLoopPrompt(request: string): string {
    return [
      `REQUEST: ${request}`,
      "",
      `Restyle the site now: read ${THEME_FILE}, read ${PAGES_DIR}/index.html,`,
      `then write the COMPLETE new stylesheet to ${THEME_FILE}. One tool call per`,
      "step. Finish with one short sentence describing the look.",
    ].join("\n");
  }

  // The single-call CSS path (no tools, non-streaming) — today's shipped
  // mode, kept as the fallback tier. Writes the theme file on success so the
  // same change event → hot-reload pipeline applies.
  private async runSingleCall(
    prompt: string,
    turn: ActiveTurn,
    tier: ModelTier,
    signal: AbortSignal,
  ): Promise<void> {
    const current = (await this.workspace.readFile(THEME_FILE).catch(() => "")) ?? "";
    const userPrompt = await this.buildSingleCallPrompt(prompt, current);
    // Reasoning models (gpt-oss) can spend most of the budget thinking and
    // return an empty or truncated answer; give headroom and retry once.
    const attempt = (extra: string) =>
      generateText({
        model: this.getModelFor(tier, "fallback"),
        system: AGENT_SYSTEM,
        prompt: userPrompt + extra,
        maxOutputTokens: 8000,
        abortSignal: signal,
      }).then((r) => r.text);

    let css = extractCss(await attempt(""));
    if (!css) {
      turn.send({ kind: "status", text: "One more pass..." });
      css = extractCss(
        await attempt(
          "\n\nIMPORTANT: reply with the CSS itself, nothing else. Start with @import or a selector.",
        ),
      );
    }
    if (!css || css === current.trim()) return;
    await this.workspace.writeFile(THEME_FILE, css);
  }

  // One user message: the request, the current theme, and the real markup
  // (page snapshots, minus scripts/styles/svg noise) to write selectors against.
  private async buildSingleCallPrompt(request: string, currentTheme: string): Promise<string> {
    const pages: string[] = [];
    for (const route of ["/index.html", "/work/index.html"]) {
      const raw = await this.workspace.readFile(`${PAGES_DIR}${route}`).catch(() => null);
      if (!raw) continue;
      const cleaned = raw
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<svg[\s\S]*?<\/svg>/gi, "<svg/>")
        .replace(/\s+/g, " ")
        .slice(0, 5000);
      pages.push(`----- ${route} -----\n${cleaned}`);
    }
    return [
      `REQUEST: ${request}`,
      "",
      "CURRENT THEME CSS (empty = original site):",
      currentTheme.trim() || "(none)",
      "",
      "REAL PAGE MARKUP:",
      pages.join("\n\n") || "(snapshots unavailable — style body, h1-h3, main, aside, a)",
      "",
      "Reply with the complete new stylesheet, CSS only.",
    ].join("\n");
  }

  // ── RPC: revert ─────────────────────────────────────────────────────
  // Guarded against active turns: a mid-turn materialize would leak writes
  // into the running turn's stream and get clobbered by its commit.
  async revertVersion(id: string): Promise<RemixState> {
    await this.ensureReady();
    if (this.turn) {
      return {
        versions: await listVersions(this.ctx.storage),
        auth: await this.authState(),
        error: "A restyle is running — wait for it to finish before reverting.",
      };
    }
    const ok = await materializeVersion(this.ctx.storage, this.workspace, id);
    if (!ok) return { versions: [], auth: await this.authState(), error: "Version not found." };
    return this.remixState();
  }

  // ── RPC: discard the whole fork ─────────────────────────────────────
  // Deletes only this studio's state. storage.deleteAll() would drop the
  // Think/Workspace SQL tables under the live instance (every call after a
  // reset then fails with "no such table" until the DO is evicted).
  async resetSelf(): Promise<{ ok: boolean; error?: string }> {
    if (this.turn) {
      return { ok: false, error: "A restyle is running — wait for it to finish." };
    }
    await this.workspace.rm(ROOT, { recursive: true }).catch(() => undefined);
    await this.clearMessages().catch(() => undefined);
    await wipeVersions(this.ctx.storage);
    for (const key of ["versions", "seedVersion", "auth", "freeUsage", "devicePollAt"]) {
      await this.ctx.storage.delete(key);
    }
    this.readyPromise = undefined;
    return { ok: true };
  }
}
