// One ephemeral fork per visitor. The fork's Durable Object holds a Workspace
// (theme.css + page snapshots) edited by a Think tool loop, and a
// content-addressed version history of committed states. The worker serves
// pages copy-on-write: ASSETS by default, workspace-shadowed paths for edited
// pages, committed theme CSS injected at serve time.
//
// Free tier: the content lock is architectural — write access is
// tool-allowlisted to theme.css, and the single-call fallback has no tools at
// all. The serving and storage layers are already multi-file so the full-edit
// tier is a flag-flip.

import { createOpenAI } from "@ai-sdk/openai";
import {
  Think,
  Workspace,
  type StreamCallback,
  type ToolCallContext,
  type ToolCallDecision,
} from "@cloudflare/think";
import { generateText, tool, type LanguageModel, type ToolSet } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import {
  AGENT_LOOP_SYSTEM,
  AGENT_SYSTEM,
  FORK_JS_FILE,
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
import { normalizeRoute, type ServedPage } from "./serving";
import {
  ORIGINAL_ID,
  commitVersion,
  currentManifest,
  getManifest,
  listVersions,
  manifestFile,
  materializeVersion,
  rollbackToCurrent,
  seedOriginalVersion,
  wipeVersions,
  type VersionSummary,
} from "./versions";

export interface RemixState {
  versions: VersionSummary[];
  error?: string;
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

  // ── model seam ──────────────────────────────────────────────────────
  // The BYO track (PLANS/byo-auth.md) replaces tier() with credential
  // detection on the fork and extends getModelFor for the signed-in
  // provider; everything else keys off these two.
  tier(): ModelTier {
    return "free";
  }
  getModelFor(tier: ModelTier, kind: "loop" | "fallback" = "loop"): LanguageModel {
    const id = TIER_MODELS[tier][kind];
    if (id.startsWith("@cf/")) {
      return createWorkersAI({ binding: this.env.AI })(id);
    }
    return createOpenAI({ apiKey: this.env.OPENAI_API_KEY })(id);
  }
  override getModel() {
    return this.getModelFor(this.tier());
  }
  override getSystemPrompt() {
    return AGENT_LOOP_SYSTEM;
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
    return { versions: await listVersions(this.ctx.storage) };
  }

  // ── RPC: agentic restyle (SSE stream) ───────────────────────────────
  streamAgentEdit(prompt: string): ReadableStream {
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

    const run = async () => {
      if (busy) {
        send({ kind: "done", error: "A restyle is already running — wait for it to finish." });
        return close();
      }
      const abort = new AbortController();
      const watchdog = setTimeout(() => abort.abort(), 120_000);
      try {
        await this.ensureReady();
        turn.live = true;
        send({ kind: "status", text: "Reading the site..." });

        const tier = this.tier();
        let looped = false;
        if (MODEL_SUPPORTS_TOOLS[TIER_MODELS[tier].loop]) {
          looped = await this.runToolLoop(prompt, turn, tier, abort.signal);
        }
        if (!looped && !turn.changed.has(THEME_FILE)) {
          send({ kind: "status", text: "Designing your theme..." });
          await this.runSingleCall(prompt, turn, tier, abort.signal);
        }
        await turn.queue;

        this.turn = undefined;
        const manifest =
          turn.changed.size > 0
            ? await commitVersion(this.ctx.storage, this.workspace, prompt.slice(0, 72))
            : null;
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
        const message = abort.signal.aborted
          ? "That took too long — please try again."
          : // A deploy resets live DOs mid-query; the retry lands on fresh code.
            /code was updated/i.test(String(err))
            ? "The site was just redeployed — please try again."
            : String(err instanceof Error ? err.message : err).slice(0, 200);
        send({ kind: "done", error: message, rolledBack });
      } finally {
        clearTimeout(watchdog);
        this.turn = undefined;
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
      if (!call || !isWriteAllowed(call.path, tier)) return false;
      await this.workspace.writeFile(THEME_FILE, call.content);
      return true;
    };

    // Without explicit headroom the Workers AI default output cap (~256
    // tokens) truncates the write tool's args mid-stylesheet.
    const chatConfig = { signal, maxOutputTokens: 8000 };
    await this.chat(this.buildLoopPrompt(prompt), callback, chatConfig);
    if (signal.aborted) throw new Error("timeout");
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
  async revertVersion(id: string): Promise<RemixState> {
    await this.ensureReady();
    const ok = await materializeVersion(this.ctx.storage, this.workspace, id);
    if (!ok) return { versions: [], error: "Version not found." };
    return this.remixState();
  }

  // ── RPC: discard the whole fork ─────────────────────────────────────
  // Deletes only this studio's state. storage.deleteAll() would drop the
  // Think/Workspace SQL tables under the live instance (every call after a
  // reset then fails with "no such table" until the DO is evicted).
  async resetSelf(): Promise<void> {
    await this.workspace.rm(ROOT, { recursive: true }).catch(() => undefined);
    await this.clearMessages().catch(() => undefined);
    await wipeVersions(this.ctx.storage);
    for (const key of ["versions", "seedVersion"]) {
      await this.ctx.storage.delete(key);
    }
    this.readyPromise = undefined;
  }
}
