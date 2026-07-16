import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE_URL, sortPosts } from "../lib/md-pages";

export const GET: APIRoute = async () => {
  const posts = sortPosts(await getCollection("blog"));
  const lines = [
    "# Matt Carey",
    "",
    "> AI Engineer and Community Builder based between London and Lisbon. Personal site: blog, projects, and work history. Markdown versions of every page are listed below.",
    "",
    "## Pages",
    "",
    `- [Home](${SITE_URL}/md/index.md)`,
    `- [Projects](${SITE_URL}/md/projects.md)`,
    `- [Work](${SITE_URL}/md/work.md)`,
    `- [Blog index](${SITE_URL}/md/blog/index.md)`,
    "",
    "## Blog posts",
    "",
    ...posts.map(
      (p) =>
        `- [${p.data.title}](${SITE_URL}/md/blog/${p.id})${p.data.description ? `: ${p.data.description}` : ""}`,
    ),
    "",
    "## Optional",
    "",
    `- [Full content](${SITE_URL}/llms-full.txt)`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
