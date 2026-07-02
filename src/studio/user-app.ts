// One ephemeral fork per visitor. The fork holds a single artifact that affects
// the served site: theme.css. A Think agent edits it in a Workspace; the worker
// injects the committed CSS into the real prerendered pages at serve time.
// Content is locked architecturally — the HTML never passes through the agent.

import { createOpenAI } from "@ai-sdk/openai";
import { Think, Workspace } from "@cloudflare/think";
import { AGENT_SYSTEM, MODEL, ROOT, SEED_THEME, SNAPSHOT_PAGES, THEME_FILE } from "./config";

interface Version {
  id: string;
  message: string;
  css: string;
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

export class UserApp extends Think<Env> {
  override workspace = new Workspace({
    sql: this.ctx.storage.sql,
    namespace: "user",
    name: () => this.name,
  });
  workspaceBash = false;
  chatStreamStallTimeoutMs = 120000;

  private readyPromise?: Promise<void>;

  getModel() {
    return createOpenAI({ apiKey: this.env.OPENAI_API_KEY })(MODEL);
  }
  getSystemPrompt() {
    return AGENT_SYSTEM;
  }

  // ── lifecycle ───────────────────────────────────────────────────────
  // Bump when the seed layout changes; forks from older layouts are reseeded.
  private static readonly SEED_VERSION = 2;

  private async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        const seeded = await this.ctx.storage.get<number>("seedVersion");
        if (seeded === UserApp.SEED_VERSION) return;

        // A fork created just before seedVersion existed is already v2-shaped
        // (it has a theme file) — backfill the marker without wiping it.
        const hasTheme = (await this.workspace.readFile(THEME_FILE).catch(() => null)) !== null;
        const versions = await this.ctx.storage.get<Version[]>("versions");
        if (hasTheme && versions && versions.length > 0) {
          await this.ctx.storage.put("seedVersion", UserApp.SEED_VERSION);
          return;
        }

        // Fresh fork, or one from a previous seed layout — start clean.
        await this.workspace.rm(ROOT, { recursive: true }).catch(() => undefined);
        await this.clearMessages().catch(() => undefined);
        // Snapshot the real prerendered pages so the agent can read the actual
        // markup it is styling.
        for (const [route, file] of SNAPSHOT_PAGES) {
          try {
            const res = await this.env.ASSETS.fetch(new Request(`https://assets.local${route}`));
            if (res.ok) {
              await this.workspace.writeFile(`${ROOT}/pages/${file}`, await res.text());
            }
          } catch {
            /* snapshot is best-effort */
          }
        }
        await this.workspace.writeFile(THEME_FILE, SEED_THEME);
        const original: Version = {
          id: "original",
          message: "Original site",
          css: "",
          createdAt: 0,
        };
        await this.ctx.storage.put("versions", [original]);
        await this.ctx.storage.put("currentId", original.id);
        await this.ctx.storage.put("seedVersion", UserApp.SEED_VERSION);
      })();
      this.readyPromise.catch(() => {
        this.readyPromise = undefined;
      });
    }
    return this.readyPromise;
  }

  private async currentVersion(): Promise<Version | undefined> {
    const versions = (await this.ctx.storage.get<Version[]>("versions")) ?? [];
    const currentId = await this.ctx.storage.get<string>("currentId");
    return versions.find((v) => v.id === currentId) ?? versions.at(-1);
  }

  // ── RPC: the committed theme CSS (empty string = original site) ────
  async getTheme(): Promise<string> {
    await this.ensureReady();
    return (await this.currentVersion())?.css ?? "";
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
        current: v.id === currentId,
      })),
    };
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

    const run = async () => {
      try {
        await this.ensureReady();
        send({ kind: "status", text: "Agent starting..." });
        const before = (await this.workspace.readFile(THEME_FILE).catch(() => "")) ?? "";

        let chatError = "";
        // Cap the total turn duration.
        const turn = this.chat(prompt, {
          onStart: () => send({ kind: "status", text: "Thinking..." }),
          onEvent: (json: string) => send({ kind: "event", chunk: json }),
          onDone: () => undefined,
          onError: (err: string) => {
            chatError = err;
          },
        }).catch((err) => {
          chatError = String(err);
        });
        const timeout = new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), 120_000),
        );
        if ((await Promise.race([turn, timeout])) === "timeout") {
          send({ kind: "done", error: "That took too long — please try again." });
          return close();
        }

        if (chatError) {
          // A deploy resets live DOs mid-query; the retry lands on fresh code.
          const friendly = /code was updated/i.test(chatError)
            ? "The site was just redeployed — please try again."
            : "Agent error: " + chatError.slice(0, 200);
          send({ kind: "done", error: friendly });
          return close();
        }

        const after = (await this.workspace.readFile(THEME_FILE).catch(() => "")) ?? "";
        if (after === before || after.trim() === "") {
          send({ kind: "done", error: "The agent made no style changes. Try rephrasing." });
          return close();
        }

        await this.commitVersion(prompt.slice(0, 72), after);
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

  private async commitVersion(message: string, css: string): Promise<void> {
    const versions = (await this.ctx.storage.get<Version[]>("versions")) ?? [];
    const version: Version = {
      id: crypto.randomUUID(),
      message: message || "Restyle",
      css,
      createdAt: Date.now(),
    };
    versions.push(version);
    // Cap history (keep "original" at index 0) so a fork can't grow unbounded.
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
    await this.workspace.writeFile(THEME_FILE, target.css || SEED_THEME);
    await this.ctx.storage.put("currentId", target.id);
    return this.remixState();
  }

  // ── RPC: discard the whole fork ─────────────────────────────────────
  // Deletes only this studio's state. storage.deleteAll() would drop the
  // Think/Workspace SQL tables under the live instance (every call after a
  // reset then fails with "no such table" until the DO is evicted).
  async resetSelf(): Promise<void> {
    await this.workspace.rm(ROOT, { recursive: true }).catch(() => undefined);
    await this.clearMessages().catch(() => undefined);
    for (const key of ["versions", "currentId", "seedVersion"]) {
      await this.ctx.storage.delete(key);
    }
    this.readyPromise = undefined;
  }
}
