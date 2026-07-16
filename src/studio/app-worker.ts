// The fork's dynamic app worker: AI-generated code from /site/app/** loaded
// into an isolated Dynamic Worker. The code is untrusted — it gets no egress
// (globalOutbound: null), tight resource limits, and a single SYSTEM broker
// binding. Loader isolates are keyed by forkId:versionId, so promoting or
// reverting a version switches code without any explicit invalidation.

import { APP_COMPAT_DATE, APP_DIR, APP_ENTRY, APP_LIMITS } from "./config";
import type { WorkspaceFiles } from "./versions";

export interface AppCode {
  /** Loader module name of the entrypoint (path relative to APP_DIR). */
  mainModule: string;
  /** Loader module name -> source. */
  modules: Record<string, string>;
}

export interface AppActive extends AppCode {
  versionId: string;
}

export const PASSTHROUGH_HEADER = "x-fork-passthrough";

/** Collect /site/app/** JS modules from the workspace. Null if no app. */
export async function collectAppCode(
  ws: WorkspaceFiles,
): Promise<AppCode | { error: string } | null> {
  const entries = await ws.glob(`${APP_DIR}/**`).catch(() => []);
  const modules: Record<string, string> = {};
  let sawFiles = false;
  for (const entry of entries) {
    if (entry.type !== "file") continue;
    sawFiles = true;
    if (!/\.(js|mjs)$/.test(entry.path)) {
      return { error: `${entry.path}: only plain .js/.mjs ES modules are supported in ${APP_DIR}` };
    }
    const content = await ws.readFile(entry.path).catch(() => null);
    if (content === null) continue;
    modules[entry.path.slice(APP_DIR.length + 1)] = content;
  }
  if (!sawFiles) return null;
  const total = Object.values(modules).reduce((n, s) => n + s.length, 0);
  if (total > 256 * 1024) {
    return { error: `${APP_DIR} is too large (${Math.round(total / 1024)}KB > 256KB)` };
  }
  const mainModule = APP_ENTRY.slice(APP_DIR.length + 1);
  if (!(mainModule in modules)) {
    return { error: `missing entrypoint ${APP_ENTRY}` };
  }
  return { mainModule, modules };
}

export function isAppCode(code: AppCode | { error: string }): code is AppCode {
  return !("error" in code);
}

function workerCode(code: AppCode, system: Fetcher) {
  return {
    compatibilityDate: APP_COMPAT_DATE,
    mainModule: code.mainModule,
    modules: code.modules,
    env: { SYSTEM: system },
    globalOutbound: null,
    limits: APP_LIMITS,
  };
}

/** Load (or reuse) the fork's dynamic worker isolate. */
export function loadAppWorker(
  env: Env,
  system: Fetcher,
  forkId: string,
  versionId: string,
  code: AppCode,
): Fetcher {
  return env.LOADER.get(`${forkId}:${versionId}`, () => workerCode(code, system)).getEntrypoint();
}

/** Run the app worker for a request, bounded by a timeout. */
export async function fetchAppWorker(
  entry: Fetcher,
  request: Request,
  timeoutMs = 5_000,
): Promise<Response> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("app worker timed out")), timeoutMs),
  );
  return Promise.race([entry.fetch(request), timeout]);
}

/**
 * Smoke-test freshly generated code: load it and fire one request. Syntax and
 * top-level errors surface here, verbatim, so the model can repair them.
 */
export async function validateAppWorker(
  env: Env,
  system: Fetcher,
  code: AppCode,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // load() is a one-shot, uncached isolate — validation never pollutes the
    // keyed isolate cache used for serving.
    const entry = env.LOADER.load(workerCode(code, system)).getEntrypoint();
    const res = await fetchAppWorker(entry, new Request("https://fork.local/"), 10_000);
    await res.body?.cancel();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err).slice(0, 500) };
  }
}
