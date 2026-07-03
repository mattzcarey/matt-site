// Shared constants for the remix studio.

// Model tiers. "free" is the anonymous default; "byo" is the signed-in
// bring-your-own-credential tier (a valid auth record in the fork DO plus the
// remix_auth grant cookie — see tier() in user-app.ts).
export type ModelTier = "free" | "byo";

// Models. "@cf/" slugs run on the Workers AI binding; anything else goes to
// the OpenAI API (OPENAI_API_KEY secret).
// Probed through workers-ai-provider + streamText (Think's exact path):
// llama-4-scout round-trips structured tool calls at ~0.5-2.5s/step but
// occasionally leaks the call as JSON text (salvage guard in user-app.ts);
// gpt-oss-20b dies reasoning-only on streaming tool turns yet is solid on a
// single non-streaming generateText call — hence loop vs fallback below.
// kimi/glm loop correctly but at 35-53s/step, which kills the hot-reload feel.
export const LOOP_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const FALLBACK_MODEL = "@cf/openai/gpt-oss-20b";

// Whether a model can drive the Think tool loop through the provider bridge.
// Models not listed default to the single-call CSS path.
export const MODEL_SUPPORTS_TOOLS: Record<string, boolean> = {
  [LOOP_MODEL]: true,
  [FALLBACK_MODEL]: false,
};

// Per-tier model choice. On the BYO tier these ids ride the signed-in
// credential instead of Matt's binding: a Cloudflare grant runs them over the
// Workers AI REST API billed to the user; a ChatGPT grant swaps both for
// CHATGPT_MODEL on the Codex backend (see models.ts).
export const TIER_MODELS: Record<ModelTier, { loop: string; fallback: string }> = {
  free: { loop: LOOP_MODEL, fallback: FALLBACK_MODEL },
  byo: { loop: LOOP_MODEL, fallback: FALLBACK_MODEL },
};

// Cookie mirroring the localStorage fork id so the worker can route a visitor
// to their own ephemeral fork Durable Object.
export const FORK_COOKIE = "remix_fork";

// ── BYO-model auth (see PLANS/byo-auth.md) ──────────────────────────────
// Paid-tier grant cookie: HMAC(forkId), HttpOnly. Set on sign-in so a leaked
// localStorage fork id alone cannot spend a signed-in user's tokens.
export const AUTH_COOKIE = "remix_auth";

// Cloudflare self-serve OAuth client (public client id, safe to commit).
export const CF_OAUTH_CLIENT_ID = "475794bcb17db3c3e4bef4a2070923e8";
export const CF_OAUTH_AUTHORIZE_URL = "https://dash.cloudflare.com/oauth2/auth";
export const CF_OAUTH_TOKEN_URL = "https://dash.cloudflare.com/oauth2/token";
export const CF_OAUTH_REVOKE_URL = "https://dash.cloudflare.com/oauth2/revoke";
// Must byte-match the redirect registered on the OAuth client, in both the
// authorize URL and the token-exchange body.
export const CF_OAUTH_REDIRECT_URI = "https://mattzcarey.com/oauth/cloudflare/callback";
// Dot-form self-serve scope ids; offline_access rides the refresh_token grant.
// Hydra rejects any scope the dash client wasn't granted. ai.write subsumes
// ai.read (bach role "Workers AI Write" carries ai.run/list/read/create).
// account-settings.read gates GET /accounts, which — being account-scoped —
// returns exactly the account(s) the user consented: one-call discovery and
// the account name doubles as the signed-in label.
export const CF_OAUTH_SCOPES = "ai.write account-settings.read offline_access";
export const CF_API_BASE = "https://api.cloudflare.com/client/v4";

// "Sign in with ChatGPT": device-code flow against the public Codex client.
export const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const OPENAI_ISSUER = "https://auth.openai.com";
export const CHATGPT_VERIFY_URL = `${OPENAI_ISSUER}/codex/device`;
export const CHATGPT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
// UNVERIFIED best guesses pending a manual curl with a real ChatGPT token
// (PLANS/byo-auth.md §7.1/§7.3): the slug catalog is server-driven and the
// OpenAI-Beta value for the plain SSE POST is undocumented.
export const CHATGPT_MODEL = "gpt-5.5";
export const CHATGPT_OPENAI_BETA = "responses=experimental";

// The free tier is the only Matt-billed tier; cap restyles per fork per day.
export const FREE_RESTYLES_PER_DAY = 10;

// Workspace layout inside each fork's Durable Object. Page snapshots mirror
// their routes (/site/pages/work/index.html serves /work/) so serving,
// previews, and future full-tier snapshots share one path rule.
export const ROOT = "/site";
export const THEME_FILE = "/site/theme.css";
export const PAGES_DIR = "/site/pages";
export const FORK_JS_FILE = "/site/fork.js";

// Real prerendered pages snapshotted into the workspace at fork time so the
// agent writes selectors against the actual markup.
export const SNAPSHOT_ROUTES = [
  "/index.html",
  "/work/index.html",
  "/projects/index.html",
  "/blog/index.html",
];

// Paths the agent's write/edit tools may touch (same for every tier —
// capabilities are identical; tiers only decide the model and who pays).
// Entries ending in "/" are prefixes.
export const WRITE_ALLOWLIST: readonly string[] = [`${ROOT}/`];

export function isWriteAllowed(path: string): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p.includes("..")) return false;
  return WRITE_ALLOWLIST.some((rule) => (rule.endsWith("/") ? p.startsWith(rule) : p === rule));
}

export const SEED_THEME = `/* Your remix of mattzcarey.com.
 * This stylesheet is injected on every page AFTER the site's own CSS,
 * so rules here override the defaults. The HTML never changes — only style. */
`;

// Styling knowledge shared by both agent paths.
const STYLE_BRIEF = [
  "You are an expert CSS artist restyling Matt Carey's personal website",
  "(mattzcarey.com). The user describes a look — a vibe, a theme, a layout",
  "tweak — and you deliver it with CSS alone.",
  "",
  "The stylesheet is injected on every page AFTER the site's own Tailwind CSS,",
  "so your rules cascade over the defaults; prefer element/structural selectors",
  "(body, h1, main, aside, nav a) over exact utility-class strings, and use",
  "!important when a Tailwind utility wins the cascade. Build on the current",
  "theme when the request is an adjustment, replace it when the request is a",
  "new look.",
  "",
  "Site notes: light mode is white/black, dark mode (prefers-color-scheme) is",
  "#111010/white; headings use 'Kaisei Tokumin' serif via --font-kaisei. If you",
  "set backgrounds, set text colors for BOTH modes, and keep text readable.",
  "",
  "RULES:",
  "  1. Do not hide the site's content and do not use `content:` to reword it.",
  "  2. Do not hide or move #remix-widget (the floating remix widget).",
  "  3. External URLs: only Google Fonts (@import url('https://fonts.googleapis.com/...'))",
  "     is allowed. No other external resources.",
  "  4. Deliver a complete, coherent theme: colors, typography, spacing, and at",
  "     least one delightful touch (a hover, a transition, an animation).",
].join("\n");

// System prompt for the single-call restyle path (no tools). The content lock
// is architectural: the only thing the model produces is CSS.
export const AGENT_SYSTEM = [
  STYLE_BRIEF,
  "",
  "You output the COMPLETE new stylesheet (not a diff). Output ONLY CSS —",
  "no prose, no markdown fences, no HTML. The user's message includes the",
  "current theme CSS and the real page markup.",
].join("\n");

// System prompt for the free-tier tool-loop path. The agent works in a
// workspace and applies its restyle by writing the theme file; every write
// hot-reloads on the visitor's screen.
export const AGENT_LOOP_SYSTEM = [
  "You are an expert designer-developer remixing Matt Carey's personal website",
  "(mattzcarey.com). The user describes a change — a look, a layout tweak, new",
  "content or behavior — and you make it by editing the workspace.",
  "",
  "You work in a workspace:",
  `  ${THEME_FILE} — the remix stylesheet, injected on every page AFTER the`,
  "    site's own Tailwind CSS, so its rules cascade over the defaults; prefer",
  "    element/structural selectors and use !important when a utility wins.",
  `  ${PAGES_DIR}/... — editable copies of the real pages, mirroring routes`,
  `    (${PAGES_DIR}/work/index.html serves /work/). Any live route can be`,
  "    edited: its page file materializes automatically the first time you",
  "    read or edit it, even if a directory listing doesn't show it yet.",
  `  ${FORK_JS_FILE} — an optional browser module loaded on every page, for`,
  "    interactive behavior.",
  "",
  "Site notes: light mode is white/black, dark mode (prefers-color-scheme) is",
  "#111010/white; headings use 'Kaisei Tokumin' serif via --font-kaisei. If you",
  "set backgrounds, set text colors for BOTH modes, and keep text readable.",
  "",
  "RULES:",
  "  1. Pick the lightest medium for the request: styling in the stylesheet,",
  "     structure and content in the page HTML, behavior in JS. Do not rewrite",
  "     a page to restyle it.",
  "  2. Do not remove or hide #remix-widget (the floating remix widget).",
  "  3. External URLs: only Google Fonts in CSS and https://esm.sh imports in JS.",
  "",
  "WORKFLOW (call exactly ONE tool per step and wait for its result — never",
  "guess file contents, never combine a read and a write in the same step):",
  "read the files involved, then write your changes — write outputs the",
  "COMPLETE file content, not a diff; use edit for small in-place changes.",
  "Finish with one short sentence describing the change. No code in the reply.",
  "",
  "Always invoke tools through the tool-calling mechanism. NEVER print a tool",
  "call, JSON, or file content as your text reply.",
].join("\n");

// The browser-module contract fork.js must follow so hot reload can dispose
// and re-import it; getSystemPrompt appends it to the loop system prompt.
export const FORK_JS_CONTRACT = [
  `${FORK_JS_FILE} is a single plain browser ES module (no imports, or`,
  "https://esm.sh imports only). It must be idempotent and set",
  "window.__remixApp = { dispose } so a newer version can tear it down and",
  "hot-swap in place; without dispose, changes only apply on reload.",
].join("\n");
