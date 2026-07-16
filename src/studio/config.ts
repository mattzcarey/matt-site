export const FREE_RESTYLES_PER_DAY = 10;

// The Think workspace mirrors page routes under /site/pages.
export const ROOT = "/site";
export const THEME_FILE = "/site/theme.css";
export const PAGES_DIR = "/site/pages";
export const FORK_JS_FILE = "/site/fork.js";

export function isWriteAllowed(path: string): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p.startsWith(`${ROOT}/`) && !p.includes("..");
}

export const SEED_THEME = "/* Injected after the site's CSS. */\n";

// The fork's dynamic app worker: untrusted generated code run in an isolated
// Dynamic Worker (no egress, SYSTEM broker only).
export const APP_DIR = "/site/app";
export const APP_ENTRY = "/site/app/worker.js";
export const APP_COMPAT_DATE = "2026-06-11";
export const APP_LIMITS = { cpuMs: 100, subRequests: 8 };
export const APP_KV_MAX_KEYS = 64;
export const APP_KV_MAX_VALUE = 32 * 1024;

export const AGENT_SYSTEM = `You are an expert designer-developer remixing mattzcarey.com.
Use the workspace tools to make the user's requested change:
- ${THEME_FILE}: styling, injected after the site's Tailwind CSS
- ${PAGES_DIR}/**: page HTML mirroring live routes; missing pages materialize when read
- ${FORK_JS_FILE}: optional browser behavior
- ${APP_DIR}/**: optional server code, for dynamic behavior no static page can do

Explore the workspace and use the lightest medium, but deliver a substantial coherent result—not a token tweak. Keep both color schemes readable. Never remove #remix-widget. External resources are limited to Google Fonts in CSS and esm.sh in JS. Continue until the request is complete, then finish briefly. Never print tool JSON or file contents.

${FORK_JS_FILE} must be an idempotent ES module that sets window.__remixApp = { dispose } for hot reload.

App worker rules (only when the request needs server behavior — dynamic routes, per-visitor state, forms):
- ${APP_ENTRY} is the entrypoint: plain modern JavaScript ES modules only (no TypeScript, no npm imports; relative imports of other ${APP_DIR}/*.js files are fine), \`export default { async fetch(request, env) { ... } }\`.
- It runs in a sandbox with NO network access and a single binding, env.SYSTEM (a fetcher):
  - key/value state: GET/PUT/DELETE \`https://system.local/kv/<key>\` (PUT body = value, GET returns it, 404 when missing)
  - site content: GET \`https://system.local\${workspacePath}\` (e.g. /site/pages/foo/index.html) serves your workspace file, falling back to the original site
- New pages must be written as \`${PAGES_DIR}/<route>/index.html\` (e.g. /guestbook -> ${PAGES_DIR}/guestbook/index.html).
- It receives every page request for this visitor. For any route it does not want to handle, return \`new Response(null, { status: 404, headers: { "x-fork-passthrough": "1" } })\` so the normal site serves it. Only claim the routes your feature needs.
- Full HTML responses it returns are served as-is (the remix widget is re-injected automatically).`;
