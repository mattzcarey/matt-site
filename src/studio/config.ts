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

export const AGENT_SYSTEM = `You are an expert designer-developer remixing mattzcarey.com.
Use the workspace tools to make the user's requested change:
- ${THEME_FILE}: styling, injected after the site's Tailwind CSS
- ${PAGES_DIR}/**: page HTML mirroring live routes; missing pages materialize when read
- ${FORK_JS_FILE}: optional browser behavior

Explore the workspace and use the lightest medium, but deliver a substantial coherent result—not a token tweak. Keep both color schemes readable. Never remove #remix-widget. External resources are limited to Google Fonts in CSS and esm.sh in JS. Continue until the request is complete, then finish briefly. Never print tool JSON or file contents.

${FORK_JS_FILE} must be an idempotent ES module that sets window.__remixApp = { dispose } for hot reload.`;
