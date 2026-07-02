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
