// One ephemeral fork per visitor. The fork's Durable Object holds a Workspace
// (theme.css + page snapshots) edited by a Think tool loop, and a
// content-addressed version history of committed states. The worker serves
// pages copy-on-write: ASSETS by default, workspace-shadowed paths for edited
// pages, committed theme CSS injected at serve time.
//
// Page files are a copy-on-read mirror of ASSETS. Remixing requires signing in
// with ChatGPT; every turn runs on the visitor's own plan (gpt-5.5, Codex
// Responses API), billed to them.

import {
  Think,
  Workspace,
  type StreamCallback,
  type ToolCallContext,
  type ToolCallDecision,
} from "@cloudflare/think";
import {
  AGENT_SYSTEM,
  FORK_JS_FILE,
  PAGES_DIR,
  ROOT,
  SEED_THEME,
  THEME_FILE,
  isWriteAllowed,
} from "./config";
import {
  type AuthRecord,
  CHATGPT_VERIFY_URL,
  type CodexAuth,
  type DeviceStart,
  exchangeDeviceCode,
  pollDeviceCode,
  refreshAuthRecord,
  requestDeviceCode,
} from "./chatgpt";
import { modelFor } from "./models";
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

export interface RemixAuthState {
  signedIn: boolean;
  /** "email · Plan" of the signed-in account. */
  label?: string;
  /** The stored session was invalidated; the user must sign in again. */
  expired?: boolean;
}

export interface RemixState {
  versions: VersionSummary[];
  auth: RemixAuthState;
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
  /** Files actually changed by the model. */
  changed: Set<string>;
  /** Depth of copy-on-read context preparation; its writes are not model work. */
  preparingWorkspace: number;
  send: (obj: unknown) => void;
  /** Serializes async css-content reads so events stay seq-ordered. */
  queue: Promise<void>;
}

export class UserApp extends Think<Env> {
  override workspace = new Workspace({
    sql: this.ctx.storage.sql,
    namespace: "user",
    name: () => this.name,
    onChange: (event) => this.onWorkspaceChange(event),
  });
  workspaceBash = false;
  chatStreamStallTimeoutMs = 180_000;

  private readyPromise?: Promise<void>;
  private turn?: ActiveTurn;
  private authRefreshPromise?: Promise<AuthRecord | null>;

  override getModel() {
    return modelFor(() => this.codexAuth());
  }
  override getSystemPrompt() {
    return AGENT_SYSTEM;
  }

  // ── Sign in with ChatGPT ────────────────────────────────────────────
  // Tokens live only in this DO; responses expose only the display label.

  // Begin the device-code flow: request a user code and stash the pending
  // device state. The visitor enters the code at CHATGPT_VERIFY_URL.
  async startAuth(): Promise<
    { userCode: string; verifyUrl: string; interval: number } | { error: string }
  > {
    const started = await requestDeviceCode();
    if ("error" in started) return started;
    await this.ctx.storage.put("deviceAuth", started);
    await this.ctx.storage.delete("devicePollAt");
    return {
      userCode: started.userCode,
      verifyUrl: CHATGPT_VERIFY_URL,
      interval: started.interval,
    };
  }

  // One poll of the device flow, driven by the widget across requests. On
  // approval it exchanges the code and stores the session.
  async pollAuth(): Promise<{
    status: "pending" | "authorized" | "expired" | "error";
    auth?: RemixAuthState;
    error?: string;
  }> {
    const device = await this.ctx.storage.get<DeviceStart>("deviceAuth");
    if (!device) return { status: "error", error: "Sign-in expired — start again." };
    if (Date.now() > device.expiresAt) {
      await this.ctx.storage.delete("deviceAuth");
      return { status: "expired", error: "Sign-in expired — start again." };
    }
    // Enforce the upstream poll interval here; the widget's timer can fire
    // early and OpenAI rate-limits fast polls.
    if (!(await this.devicePollGate(device.interval * 1000 - 250))) return { status: "pending" };

    const poll = await pollDeviceCode(device.deviceAuthId, device.userCode);
    if (poll.status === "pending") return { status: "pending" };
    await this.ctx.storage.delete("deviceAuth");
    if (poll.status === "error") return { status: "error", error: poll.error };

    const record = await exchangeDeviceCode(poll.code, poll.codeVerifier);
    if ("error" in record) return { status: "error", error: record.error };
    await this.ctx.storage.put("auth", record);
    return { status: "authorized", auth: await this.authState() };
  }

  async clearAuth(): Promise<{ ok: true }> {
    await this.ctx.storage.delete(["auth", "deviceAuth", "devicePollAt"]);
    return { ok: true };
  }

  // Throttle for the device-code poll relay; the last-poll timestamp lives
  // here so a scripted caller can't reset it.
  private async devicePollGate(minIntervalMs: number): Promise<boolean> {
    const last = (await this.ctx.storage.get<number>("devicePollAt")) ?? 0;
    const now = Date.now();
    if (now - last < minIntervalMs) return false;
    await this.ctx.storage.put("devicePollAt", now);
    return true;
  }

  private async authState(): Promise<RemixAuthState> {
    const record = await this.ctx.storage.get<AuthRecord>("auth");
    if (!record) return { signedIn: false };
    return { signedIn: !record.invalid, label: record.label, expired: record.invalid === true };
  }

  // Fresh credentials for a Codex request. Throws (surfaced as an auth error)
  // when the session is gone, so a turn can report "sign in again".
  private async codexAuth(): Promise<CodexAuth> {
    const record = await this.freshAuth();
    if (!record) throw new Error("ChatGPT session expired — sign in again (401).");
    return { accessToken: record.accessToken, accountId: record.accountId };
  }

  // A usable record (refreshed near expiry) or null. The refresh token rotates
  // on use, so refresh is single-flight and the rotated pair is persisted
  // before the promise resolves — concurrent turns can't burn a single-use
  // refresh token into invalid_grant.
  private async freshAuth(): Promise<AuthRecord | null> {
    const record = await this.ctx.storage.get<AuthRecord>("auth");
    if (!record || record.invalid) return null;
    if (Date.now() < record.expiresAt - 60_000) return record;
    if (!this.authRefreshPromise) {
      this.authRefreshPromise = (async () => {
        const current = await this.ctx.storage.get<AuthRecord>("auth");
        if (!current || current.invalid) return null;
        if (Date.now() < current.expiresAt - 60_000) return current;
        const rotated = await refreshAuthRecord(current);
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

  override async beforeToolCall(ctx: ToolCallContext): Promise<ToolCallDecision | void> {
    const input = ctx.input as { path?: unknown } | undefined;
    const path = typeof input?.path === "string" ? input.path : "";
    if (ctx.toolName === "write" || ctx.toolName === "edit" || ctx.toolName === "delete") {
      if (!isWriteAllowed(path)) {
        return {
          action: "block",
          reason: `Write access is limited to ${ROOT}/. Read tools may use any workspace path.`,
        };
      }
    }
    // Copy-on-read: a live page materializes into the workspace the first
    // time the agent reads or edits its file.
    if (ctx.toolName === "read" || ctx.toolName === "edit") {
      await this.materializePage(path);
    }
  }

  // Map a workspace page path to its live route; null for non-page paths.
  private pageRouteFor(path: string): string | null {
    const p = path.startsWith("/") ? path : `/${path}`;
    if (!p.startsWith(`${PAGES_DIR}/`) || p.includes("..")) return null;
    return normalizeRoute(p.slice(PAGES_DIR.length));
  }

  private async materializePage(path: string): Promise<void> {
    const route = this.pageRouteFor(path);
    if (!route) return;
    const target = `${PAGES_DIR}${route}`;
    const existing = await this.workspace.readFile(target).catch(() => null);
    if (existing !== null) return;

    // Workspace emits a create event for this write. Suppress it as a turn
    // effect: copying live markup in so the model can read it is not a remix.
    const turn = this.turn;
    if (turn) turn.preparingWorkspace++;
    try {
      await this.snapshotRoute(route);
    } finally {
      if (turn) turn.preparingWorkspace--;
    }
  }

  // ── lifecycle ───────────────────────────────────────────────────────
  private static readonly SEED_VERSION = 4;

  private async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        const seeded = await this.ctx.storage.get<number>("seedVersion");
        if (seeded === UserApp.SEED_VERSION) return;

        await this.workspace.rm(ROOT, { recursive: true }).catch(() => undefined);
        await this.clearMessages().catch(() => undefined);
        await wipeVersions(this.ctx.storage);
        // Re-seeding is a workspace migration, not a sign-out: keep "auth".
        await this.ctx.storage.delete(["versions", "deviceAuth", "devicePollAt", "freeUsage"]);
        // Snapshot the real prerendered pages so the agent can read the actual
        // markup it is styling.
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
    if (!turn?.live || turn.preparingWorkspace > 0 || !event.path.startsWith(`${ROOT}/`)) return;
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

  // ── RPC: agentic remix (SSE stream) ─────────────────────────────────
  streamAgentEdit(prompt: string, route = "/"): ReadableStream {
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
      preparingWorkspace: 0,
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
      const watchdog = setTimeout(() => abort.abort(), 600_000);
      try {
        await this.ensureReady();

        const record = await this.ctx.storage.get<AuthRecord>("auth");
        if (!record || record.invalid) {
          send({
            kind: "done",
            error: "Sign in with ChatGPT to remix.",
            auth: record?.invalid ? "expired" : undefined,
          });
          return close();
        }

        turn.live = true;
        send({ kind: "status", text: "Reading the site..." });
        await this.runToolLoop(prompt, route, turn, abort.signal);
        await turn.queue;

        this.turn = undefined;
        const manifest = turn.changed.size
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
          send({ kind: "done", error: "That didn't change the remix. Try rephrasing." });
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
          : /code was updated/i.test(String(err))
            ? "The site was just redeployed — please try again."
            : String(err instanceof Error ? err.message : err).slice(0, 200);
        const auth = (await this.authState()).expired ? "expired" : undefined;
        send({ kind: "done", error: message, rolledBack, auth });
      } finally {
        clearTimeout(watchdog);
        this.turn = undefined;
        close();
      }
    };
    run();
    return stream;
  }

  private async runToolLoop(
    prompt: string,
    route: string,
    turn: ActiveTurn,
    signal: AbortSignal,
  ): Promise<void> {
    let error: string | undefined;
    const callback: StreamCallback = {
      onStart: () => {},
      onEvent: (chunk) => turn.send({ kind: "event", chunk }),
      onDone: () => {},
      onError: (message) => {
        error = message;
      },
    };
    const chat = (message: string) => this.chat(message, callback, { signal });

    await chat(this.buildLoopPrompt(prompt, route));
    if (signal.aborted) throw new Error("timeout");
    if (error) throw new Error(error);
    if (turn.changed.size) return;

    turn.send({ kind: "status", text: "One more pass..." });
    error = undefined;
    await chat("Nothing changed. Use the write or edit tool now, then finish briefly.");
    if (signal.aborted) throw new Error("timeout");
    if (error) throw new Error(error);
  }

  private buildLoopPrompt(request: string, route: string): string {
    return [
      `REQUEST: ${request}`,
      `CURRENT PAGE: ${route} (${PAGES_DIR}${normalizeRoute(route)})`,
      "Explore and edit the workspace as needed. Continue until the requested remix is complete.",
    ].join("\n\n");
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
        error: "A remix is running — wait for it to finish before reverting.",
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
    for (const key of [
      "versions",
      "seedVersion",
      "freeUsage",
      "auth",
      "deviceAuth",
      "devicePollAt",
    ]) {
      await this.ctx.storage.delete(key);
    }
    this.readyPromise = undefined;
    return { ok: true };
  }
}
