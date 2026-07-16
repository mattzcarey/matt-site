// Bot classification and the markdown ("LLM view") experience.
//
// Bots never reach the remix/fork pipeline: AI crawlers get the raw markdown
// built under /md/*, search indexers get the normal prerendered HTML, and
// humans can opt in via the `view=llm` cookie (`?view=llm` / `?view=human`).

export type BotExperience = "markdown" | "html";

// request.cf.verifiedBotCategory → experience. Unknown categories fall back
// to HTML so search indexing is never at risk.
const CATEGORY_EXPERIENCE: Record<string, BotExperience> = {
  "AI Crawler": "markdown",
  "AI Assistant": "markdown",
  "AI Search": "markdown",
  Archiver: "markdown",
  "Academic Research": "markdown",
  "Search Engine Crawler": "html",
  "Search Engine Optimization": "html",
  "Page Preview": "html",
  "Feed Fetcher": "html",
  "Monitoring & Analytics": "html",
  "Advertising & Marketing": "html",
  Aggregator: "html",
  Security: "html",
  Accessibility: "html",
  Webhooks: "html",
};

// Unverified agents: UA sniffing fallback. The category (verified) wins.
const MD_UA =
  /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|CCBot|Bytespider|Google-Extended|Applebot-Extended|meta-externalagent|Amazonbot|cohere-ai|DuckAssistBot|AI2Bot|Diffbot|Timpibot|omgili/i;
const HTML_UA = /Googlebot|Bingbot|DuckDuckBot|Applebot|YandexBot|Baiduspider|SeznamBot/i;

export function classifyBot(request: Request): BotExperience | null {
  const category = (request.cf as { verifiedBotCategory?: string } | undefined)
    ?.verifiedBotCategory;
  if (category) return CATEGORY_EXPERIENCE[category] ?? "html";
  const ua = request.headers.get("user-agent") ?? "";
  if (MD_UA.test(ua)) return "markdown";
  if (HTML_UA.test(ua)) return "html";
  return null;
}

// Page → markdown asset built by the /md/* Astro endpoints. Null means the
// path has no markdown twin (feeds, assets, 404s) and passes through.
export function mdPathFor(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return "/md/index.md";
  if (p === "/blog") return "/md/blog/index.md";
  if (p === "/projects") return "/md/projects.md";
  if (p === "/work") return "/md/work.md";
  const post = p.match(/^\/blog\/([a-zA-Z0-9._-]+\.md)$/);
  if (post) return `/md/blog/${post[1]}`;
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Human-readable wrapper for LLM view: the exact scraper markdown in a
// minimal monospace shell, with a way back.
export function llmShell(markdown: string, pathname: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>LLM view — mattzcarey.com${escapeHtml(pathname)}</title>
<style>
body{margin:0;background:#fff;color:#262626;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
header{position:sticky;top:0;background:#fafafa;border-bottom:1px solid #e5e5e5;padding:10px 16px;font-size:13px}
header a{color:#262626}
main{max-width:80ch;margin:2rem auto;padding:0 1rem}
pre{white-space:pre-wrap;word-wrap:break-word;font:inherit;font-size:14px;line-height:1.6}
@media (prefers-color-scheme: dark){
body{background:#111010;color:#d4d4d4}
header{background:#161515;border-color:#262626}
header a{color:#d4d4d4}
}
</style>
</head>
<body>
<header>LLM view — the original site content as agents see it (not your remix). <a href="?view=human">Switch to human view</a></header>
<main><pre>${escapeHtml(markdown)}</pre></main>
</body>
</html>`;
}
