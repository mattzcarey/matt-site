// The seed files every fork starts from. The editing agent rewrites these to
// restyle the app; worker-bundler bundles src/app.ts into a browser asset and
// the host serves index.html + styles.css as-is (with content injected).
//
// The app is 100% client-side — nothing here runs on the server, so there is no
// sandbox. _server.ts is an unused stub that only exists because worker-bundler's
// createApp() requires a server entry; the studio never loads its output.

export const BASE_FILES: Record<string, string> = {
  "package.json": JSON.stringify({ name: "remix-app", type: "module" }, null, 2),

  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Matt Carey</title>
    <link rel="stylesheet" href="/remix/styles.css" />
  </head>
  <body>
    <main id="app"></main>
    <!-- Content is injected read-only by the host. Do not edit or remove. -->
    <script id="site-content" type="application/json">__SITE_CONTENT__</script>
    <script type="module" src="/remix/app.js"></script>
  </body>
</html>
`,

  "styles.css": `:root {
  --bg: #111010;
  --fg: #ffffff;
  --muted: #a3a3a3;
  --accent: #f6821f;
  --serif: "Kaisei Tokumin", Georgia, serif;
  --sans: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--sans);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
#app { max-width: 56rem; margin: 0 auto; padding: 4rem 1.5rem 8rem; }
h1 { font-family: var(--serif); font-weight: 700; font-size: 2rem; margin: 0; }
h2 { font-size: 1.1rem; color: var(--muted); font-weight: 600; margin: 2.5rem 0 1rem; }
.intro { color: #d4d4d4; max-width: 30rem; margin: 1.25rem 0; }
.avatar { width: 100px; height: 100px; border-radius: 9999px; filter: grayscale(1); }
.socials { display: flex; gap: 1.5rem; margin: 1.5rem 0; }
.socials a { color: var(--muted); text-decoration: none; }
.socials a:hover { color: var(--fg); }
.entry { display: flex; gap: 2rem; margin: 1.25rem 0; align-items: baseline; }
.entry .period { color: var(--muted); font-size: 0.85rem; min-width: 7rem; }
.entry a { color: var(--fg); text-decoration: underline; text-decoration-color: #555; }
.entry .kind { color: var(--muted); font-style: italic; font-size: 0.8rem; margin-left: 0.5rem; }
.entry .desc { color: var(--muted); }
@media (max-width: 640px) { .entry { flex-direction: column; gap: 0.25rem; } }
`,

  "src/app.ts": `// Client renderer. Reads the host-injected, read-only content and paints the
// page. Restyle this however you like — but keep reading from #site-content.

interface Social { label: string; href: string; }
interface Entry {
  period: string;
  title: string;
  href: string | null;
  kind?: string;
  description: string;
}
interface Content {
  name: string;
  tagline: string;
  intro: string;
  avatar: string;
  socials: Social[];
  work: Entry[];
  projects: Entry[];
}

function getContent(): Content {
  const el = document.getElementById("site-content");
  return JSON.parse(el?.textContent || "{}") as Content;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function link(href: string | null, text: string): string {
  if (!href) return esc(text);
  return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(text) + "</a>";
}

function entryRow(e: Entry): string {
  return (
    '<div class="entry">' +
    '<span class="period">' + esc(e.period) + "</span>" +
    "<div>" +
    "<div>" + link(e.href, e.title) +
    (e.kind ? '<span class="kind">(' + esc(e.kind) + ")</span>" : "") +
    "</div>" +
    '<div class="desc">' + esc(e.description) + "</div>" +
    "</div></div>"
  );
}

function render(): void {
  const c = getContent();
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML =
    "<header>" +
    "<h1>" + esc(c.name) + "</h1>" +
    '<p class="intro">' + esc(c.intro) + "</p>" +
    '<img class="avatar" src="' + esc(c.avatar) + '" alt="' + esc(c.name) + '" width="100" height="100" />' +
    "</header>" +
    "<h2>Find me on</h2>" +
    '<div class="socials">' +
    c.socials.map((s) => link(s.href, s.label)).join("") +
    "</div>" +
    "<h2>Work</h2>" +
    c.work.map(entryRow).join("") +
    "<h2>Projects</h2>" +
    c.projects.map(entryRow).join("");
}

render();
`,

  // Unused stub: createApp() requires a server entry, but the studio only serves
  // the client bundle + static assets. This never executes.
  "_server.ts": `export default {
  fetch(): Response {
    return new Response("remix app served statically", { status: 200 });
  }
};
`,
};

// Which seed files the agent is allowed to edit (the presentation). Everything
// else (the server stub, package.json) is host-owned.
export const EDITABLE_FILES = ["index.html", "styles.css", "src/app.ts"];
