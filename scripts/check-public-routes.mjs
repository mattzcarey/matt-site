const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");

async function request(path) {
  return fetch(`${base}${path}`, { redirect: "manual" });
}

async function expectHtml(path) {
  const response = await request(path);
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !contentType.includes("text/html")) {
    throw new Error(`${path}: expected HTML 200, got ${response.status} ${contentType}`);
  }
}

async function expectMarkdown(path, text) {
  const response = await request(path);
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (
    response.status !== 200 ||
    !contentType.includes("text/markdown") ||
    !body.includes(text) ||
    body.includes("<!DOCTYPE html>")
  ) {
    throw new Error(`${path}: expected raw Markdown 200, got ${response.status} ${contentType}`);
  }
}

async function expectRedirect(path, destination) {
  const response = await request(path);
  const location = response.headers.get("location");
  if (response.status !== 301 || location !== `${base}${destination}`) {
    throw new Error(`${path}: expected 301 to ${destination}, got ${response.status} ${location}`);
  }
}

await expectHtml("/");
await expectHtml("/blog");
await expectHtml("/projects");
await expectHtml("/work");
await expectHtml("/blog/agent-computer");

await expectMarkdown("/index.md", "# Matt Carey");
await expectMarkdown("/blog.md", "# Posts");
await expectMarkdown("/projects.md", "# Projects");
await expectMarkdown("/work.md", "# Work");
await expectMarkdown("/blog/agent-computer.md", 'title: "Give your agent a computer"');

await expectRedirect("/blog/give-your-agent-a-computer", "/blog/agent-computer");
await expectRedirect("/blog/give-your-agent-a-computer.md", "/blog/agent-computer.md");
await expectRedirect("/blog/give-your-agent-a-computer.md/", "/blog/agent-computer.md");
await expectRedirect("/md/blog/give-your-agent-a-computer.md", "/blog/agent-computer.md");

console.log(`Public route contract passed against ${base}`);
