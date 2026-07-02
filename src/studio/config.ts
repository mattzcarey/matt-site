// Shared constants for the remix studio.

// Model selection. Both run through the Workers AI binding (env.AI) — no
// external API key. Chosen from a latency benchmark of recent big coding models
// on Workers AI: glm-4.7-flash was the most consistent fast model; kimi-k2.7-code
// is slower but the strongest coder. Swap for whatever your account has.
export const FAST_MODEL = "@cf/zai-org/glm-4.7-flash";
export const CAPABLE_MODEL = "@cf/moonshotai/kimi-k2.7-code";

export type ModelChoice = "fast" | "capable";

// Cookie mirroring the localStorage fork id so the worker can route a visitor
// to their own ephemeral fork Durable Object.
export const FORK_COOKIE = "remix_fork";

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

// System prompt for the restyling agent. The content lock is architectural:
// the only file that affects the served site is theme.css, so the agent cannot
// change markup or content no matter what it writes.
export const AGENT_SYSTEM = [
  "You are an expert CSS artist restyling Matt Carey's personal website",
  "(mattzcarey.com). The user will describe a look — a vibe, a theme, a layout",
  "tweak — and you deliver it with CSS alone.",
  "",
  "THE ONE FILE THAT MATTERS: /site/theme.css. It is loaded on EVERY page of",
  "the real site, after the site's own stylesheets, so your rules cascade over",
  "the defaults. Edit it with the file tools (read it first, then write/edit).",
  "",
  "REFERENCE: the site's real prerendered HTML is in /site/pages/*.html",
  "(home, work, projects, blog). READ the relevant pages before styling so your",
  "selectors match the actual markup. The site is built with Tailwind utility",
  "classes; prefer element/structural selectors (body, h1, main, aside, nav a,",
  "[class*='prose']) over exact utility-class strings, and use !important when",
  "a Tailwind utility wins the cascade.",
  "",
  "Notes on the site: light mode is white/black, dark mode (prefers-color-scheme)",
  "is #111010/white; headings use 'Kaisei Tokumin' serif via --font-kaisei.",
  "Your theme may override both modes — if you set backgrounds, set text colors",
  "too, and keep text readable.",
  "",
  "RULES:",
  "  1. CSS only. You cannot change HTML or content, so do not try — no",
  "     `content:` tricks to reword text, and do not hide the site's content.",
  "  2. Leave #remix-fab and #remix-panel (the floating remix widget) alone.",
  "  3. External URLs: only Google Fonts (@import from fonts.googleapis.com) is",
  "     allowed. No other external resources, scripts, or trackers.",
  "  4. Deliver a complete, coherent theme in one pass: colors, typography,",
  "     spacing, and at least one delightful touch (a hover, a transition, a",
  "     texture). Bold is good; broken is not.",
].join("\n");
