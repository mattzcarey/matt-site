// Shared constants for the remix studio.

// Model for the restyling agent. "@cf/" slugs run on the Workers AI binding;
// anything else goes to the OpenAI API (OPENAI_API_KEY secret).
// Benchmarked on the full theme task (complete CSS, warmed, median of 2):
// gpt-oss-20b 7.4s / gpt-oss-120b 15.8s (both clean, complete, keyframes);
// llama-4-scout 6.7s but invalid selectors; qwen2.5-coder thin output;
// glm-4.7-flash 40s / kimi-k2.6 34s / glm-5.2 53s — thinking models truncate
// at the token cap on themes this size.
// Full restyle turn (single call, real prompt): 20b ~10-16s, 120b ~35s.
export const MODEL = "@cf/openai/gpt-oss-20b";

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
// Dot-form self-serve scope ids; offline_access rides the refresh_token grant.
export const CF_OAUTH_SCOPES = "ai.read ai.write user-details.read memberships.read offline_access";
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

// Workspace layout inside each fork's Durable Object.
export const ROOT = "/site";
export const THEME_FILE = "/site/theme.css";

// Real prerendered pages snapshotted into the workspace at fork time so the
// agent writes selectors against the actual markup.
export const SNAPSHOT_PAGES: Array<[route: string, file: string]> = [
  ["/index.html", "home.html"],
  ["/work/index.html", "work.html"],
  ["/projects/index.html", "projects.html"],
  ["/blog/index.html", "blog.html"],
];

export const SEED_THEME = `/* Your remix of mattzcarey.com.
 * This stylesheet is injected on every page AFTER the site's own CSS,
 * so rules here override the defaults. The HTML never changes — only style. */
`;

// System prompt for the single-call restyle. The content lock is architectural:
// the only thing the model produces is CSS, so it cannot change markup or
// content no matter what it writes.
export const AGENT_SYSTEM = [
  "You are an expert CSS artist restyling Matt Carey's personal website",
  "(mattzcarey.com). The user describes a look — a vibe, a theme, a layout",
  "tweak — and you deliver it with CSS alone.",
  "",
  "You output the COMPLETE new stylesheet (not a diff). It is injected on every",
  "page AFTER the site's own Tailwind CSS, so your rules cascade over the",
  "defaults; prefer element/structural selectors (body, h1, main, aside, nav a)",
  "over exact utility-class strings, and use !important when a Tailwind utility",
  "wins the cascade. The user's message includes the current theme CSS and the",
  "real page markup — build on the current theme when the request is an",
  "adjustment, replace it when the request is a new look.",
  "",
  "Site notes: light mode is white/black, dark mode (prefers-color-scheme) is",
  "#111010/white; headings use 'Kaisei Tokumin' serif via --font-kaisei. If you",
  "set backgrounds, set text colors for BOTH modes, and keep text readable.",
  "",
  "RULES:",
  "  1. Output ONLY CSS. No prose, no markdown fences, no HTML.",
  "  2. Do not hide the site's content and do not use `content:` to reword it.",
  "  3. Do not hide or move #remix-widget (the floating remix widget).",
  "  4. External URLs: only Google Fonts (@import url('https://fonts.googleapis.com/...'))",
  "     is allowed. No other external resources.",
  "  5. Deliver a complete, coherent theme: colors, typography, spacing, and at",
  "     least one delightful touch (a hover, a transition, an animation).",
].join("\n");
