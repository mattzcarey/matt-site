// One ephemeral fork per visitor. Holds the fork's files in a Workspace, lets a
// Think agent restyle them, bundles with worker-bundler, and serves the result
// as plain static assets — no Worker Loader, no dynamic execution, no sandbox.

import { Think, Workspace } from "@cloudflare/think";
import {
  createApp,
  createMemoryStorage,
  handleAssetRequest,
  type AssetStorage,
  type CreateAppResult
} from "@cloudflare/worker-bundler";
import { createWorkersAI } from "workers-ai-provider";
import { openai } from "workers-ai-provider/openai";
import { BASE_FILES } from "./base-app";
import { appOverlay } from "./overlay";
import { SITE_CONTENT, canonicalStrings } from "./content";
import {
  AGENT_SYSTEM,
  CAPABLE_MODEL,
  CONTENT_PLACEHOLDER,
  FAST_MODEL,
  ROOT,
  STUDIO_PREFIX,
  type ModelChoice
} from "./config";

interface Version {
  id: string;
  message: string;
  files: Record<string, string>;
  createdAt: number;
}

export interface VersionSummary {
  id: string;
  short: string;
  message: string;
  current: boolean;
}

export interface RemixState {
  versions: VersionSummary[];
  error?: string;
}

// Serialise content for embedding inside a <script> tag safely.
function contentJson(): string {
  return JSON.stringify(SITE_CONTENT).replace(/</g, "\\u003c");
}

export class UserApp extends Think<Env> {
  override workspace = new Workspace({
    sql: this.ctx.storage.sql,
    namespace: "user",
    name: () => this.name
  });
  workspaceBash = false;
  chatStreamStallTimeoutMs = 120000;

  private build?: CreateAppResult;
  private buildStorage?: AssetStorage;
  private buildVersion = 0;
  private modelChoice: ModelChoice = "capable";
  private readyPromise?: Promise<void>;

  getModel() {
    const model = this.modelChoice === "fast" ? FAST_MODEL : CAPABLE_MODEL;
    if (model.startsWith("@cf/")) {
      return createWorkersAI({ binding: this.env.AI })(model);
    }
    // OpenAI catalog via the env.AI slug delegate (unified billing, no token).
    return createWorkersAI({ binding: this.env.AI, providers: [openai] })(model);
  }
  getSystemPrompt() {
    return AGENT_SYSTEM;
  }

  // ── file helpers ────────────────────────────────────────────────────
  private async readFiles(): Promise<Record<string, string>> {
    const entries = (await this.workspace
      .glob(`${ROOT}/**/*`)
      .catch(() => [] as Array<{ path: string; type: string }>)) as Array<{
      path: string;
      type: string;
    }>;
    const files: Record<string, string> = {};
    for (const e of entries) {
      if (e.type !== "file") continue;
      try {
        const content = await this.workspace.readFile(e.path);
        if (content !== null) {
          files[e.path.replace(new RegExp(`^${ROOT}/`), "")] = content;
        }
      } catch {
        /* skip unreadable */
      }
    }
    return files;
  }

  private async writeFiles(files: Record<string, string>): Promise<void> {
    for (const [path, content] of Object.entries(files)) {
      await this.workspace.writeFile(`${ROOT}/${path}`, content);
    }
  }

  // ── build ───────────────────────────────────────────────────────────
  private async rebuild(files: Record<string, string>): Promise<void> {
    const assets: Record<string, string> = {};
    if (files["index.html"]) assets["/index.html"] = files["index.html"];
    if (files["styles.css"]) assets["/styles.css"] = files["styles.css"];
    const built = await createApp({
      files,
      client: "src/app.ts",
      server: "_server.ts",
      assets,
      bundle: true
    });
    this.build = built;
    this.buildStorage = createMemoryStorage(built.assets ?? {});
    this.buildVersion++;
  }

  // Reject a build that broke the content lock (dropped the injection point,
  // the content data element, or the client that renders it).
  private contentLockError(files: Record<string, string>): string | undefined {
    const html = files["index.html"] ?? "";
    const app = files["src/app.ts"] ?? "";
    if (!html.includes(CONTENT_PLACEHOLDER)) {
      return "Version rejected: it removed the content injection point. The site content must stay locked.";
    }
    if (!html.includes('id="site-content"')) {
      return "Version rejected: it removed the #site-content element that carries Matt's content.";
    }
    if (!html.includes("/remix/app.js")) {
      return "Version rejected: index.html no longer loads the app.";
    }
    if (!app.includes("site-content")) {
      return "Version rejected: app.ts no longer renders the locked content from #site-content.";
    }
    return undefined;
  }

  // ── lifecycle ───────────────────────────────────────────────────────
  private async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        let versions = await this.ctx.storage.get<Version[]>("versions");
        if (!versions || versions.length === 0) {
          const base: Version = {
            id: "original",
            message: "Original site",
            files: this.baseFilesRelative(),
            createdAt: 0
          };
          versions = [base];
          await this.ctx.storage.put("versions", versions);
          await this.ctx.storage.put("currentId", base.id);
          await this.writeFiles(base.files);
        }
        const currentId =
          (await this.ctx.storage.get<string>("currentId")) ?? versions[0].id;
        const current =
          versions.find((v) => v.id === currentId) ?? versions[versions.length - 1];
        // Rebuild from the workspace (edited files) so hot DOs keep their state.
        const onDisk = await this.readFiles();
        await this.rebuild(
          Object.keys(onDisk).length > 0 ? onDisk : current.files
        );
      })();
      this.readyPromise.catch(() => {
        this.readyPromise = undefined;
      });
    }
    return this.readyPromise;
  }

  private baseFilesRelative(): Record<string, string> {
    // BASE_FILES keys are already relative to ROOT.
    return { ...BASE_FILES };
  }

  // ── RPC: state ──────────────────────────────────────────────────────
  async remixState(): Promise<RemixState> {
    await this.ensureReady();
    const versions = (await this.ctx.storage.get<Version[]>("versions")) ?? [];
    const currentId = await this.ctx.storage.get<string>("currentId");
    return {
      versions: versions.map((v) => ({
        id: v.id,
        short: v.id === "original" ? "original" : v.id.slice(0, 7),
        message: v.message,
        current: v.id === currentId
      }))
    };
  }

  // ── RPC: agentic edit (SSE stream) ──────────────────────────────────
  streamAgentEdit(prompt: string, model: ModelChoice = "capable"): ReadableStream {
    this.modelChoice = model;
    const enc = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      }
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

    const run = async () => {
      try {
        await this.ensureReady();
        send({ kind: "status", text: "Agent starting..." });
        const before = JSON.stringify(await this.readFiles());

        let chatError = "";
        await this.chat(prompt, {
          onStart: () => send({ kind: "status", text: "Thinking..." }),
          onEvent: (json: string) => send({ kind: "event", chunk: json }),
          onDone: () => undefined,
          onError: (err: string) => {
            chatError = err;
          }
        }).catch((err) => {
          chatError = String(err);
        });

        if (chatError) {
          send({ kind: "done", error: "Agent error: " + chatError.slice(0, 200) });
          return close();
        }

        const files = await this.readFiles();
        if (JSON.stringify(files) === before) {
          send({ kind: "done", error: "Agent made no changes. Try rephrasing." });
          return close();
        }

        // Enforce the content lock before we accept the version.
        const lockErr = this.contentLockError(files);
        if (lockErr) {
          await this.rollback(send);
          send({ kind: "done", error: lockErr });
          return close();
        }

        send({ kind: "status", text: "Building..." });
        try {
          await this.rebuild(files);
        } catch (err) {
          await this.rollback(send);
          send({ kind: "done", error: "Build failed: " + String(err).slice(0, 200) });
          return close();
        }

        await this.commitVersion(prompt.slice(0, 72), files);
        send({ kind: "done", ok: true });
        close();
      } catch (err) {
        send({ kind: "done", error: String(err).slice(0, 200) });
        close();
      }
    };
    run();
    return stream;
  }

  // Restore the workspace + build to the current committed version.
  private async rollback(send: (o: unknown) => void): Promise<void> {
    try {
      const versions = (await this.ctx.storage.get<Version[]>("versions")) ?? [];
      const currentId = await this.ctx.storage.get<string>("currentId");
      const current =
        versions.find((v) => v.id === currentId) ?? versions[versions.length - 1];
      if (current) {
        await this.workspace.rm(ROOT, { recursive: true }).catch(() => undefined);
        await this.writeFiles(current.files);
        await this.rebuild(current.files);
      }
    } catch {
      send({ kind: "status", text: "Rolled back." });
    }
  }

  private async commitVersion(
    message: string,
    files: Record<string, string>
  ): Promise<void> {
    const versions = (await this.ctx.storage.get<Version[]>("versions")) ?? [];
    const version: Version = {
      id: crypto.randomUUID(),
      message: message || "Update",
      files,
      createdAt: Date.now()
    };
    versions.push(version);
    // Cap history so an ephemeral fork can't grow unbounded.
    while (versions.length > 25) versions.splice(1, 1);
    await this.ctx.storage.put("versions", versions);
    await this.ctx.storage.put("currentId", version.id);
  }

  // ── RPC: revert ─────────────────────────────────────────────────────
  async revertVersion(id: string): Promise<RemixState> {
    await this.ensureReady();
    const versions = (await this.ctx.storage.get<Version[]>("versions")) ?? [];
    const target = versions.find((v) => v.id === id);
    if (!target) return { versions: [], error: "Version not found." };
    await this.workspace.rm(ROOT, { recursive: true }).catch(() => undefined);
    await this.writeFiles(target.files);
    await this.rebuild(target.files);
    await this.ctx.storage.put("currentId", target.id);
    return this.remixState();
  }

  // ── RPC: discard the whole fork ─────────────────────────────────────
  async resetSelf(): Promise<void> {
    await this.workspace.rm(ROOT, { recursive: true }).catch(() => undefined);
    await this.ctx.storage.deleteAll();
    this.build = undefined;
    this.buildStorage = undefined;
    this.buildVersion = 0;
    this.readyPromise = undefined;
  }

  // ── RPC: serve the built app ────────────────────────────────────────
  async serve(pathname: string, forked: boolean): Promise<Response> {
    await this.ensureReady();
    const built = this.build!;
    let sub = pathname.slice(STUDIO_PREFIX.length);
    if (sub === "" || sub === "/") sub = "/index.html";

    if (sub !== "/index.html") {
      const res = await handleAssetRequest(
        new Request("https://remix.local" + sub),
        built.assetManifest,
        this.buildStorage!,
        built.assetConfig
      );
      return res ?? new Response("Not found", { status: 404 });
    }

    let html = (built.assets["/index.html"] as string) ?? "";
    html = html.replace(CONTENT_PLACEHOLDER, contentJson());
    const overlay = appOverlay(forked);
    html = html.includes("</body>")
      ? html.replace("</body>", overlay + "</body>")
      : html + overlay;
    return new Response(html, {
      headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store" }
    });
  }
}

// Keep the import from being tree-shaken in type-only builds.
export const _canonical = canonicalStrings;
