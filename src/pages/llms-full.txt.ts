import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { blogIndexMd, homeMd, postMd, projectsMd, sortPosts, workMd } from "../lib/md-pages";

export const GET: APIRoute = async () => {
  const posts = sortPosts(await getCollection("blog"));
  const sections = [
    homeMd(),
    projectsMd(),
    workMd(),
    blogIndexMd(posts),
    ...posts.map((p) => postMd(p)),
  ];
  return new Response(sections.join("\n---\n\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
