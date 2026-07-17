import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { blogIndexMd } from "../lib/md-pages";

export const GET: APIRoute = async () =>
  new Response(blogIndexMd(await getCollection("blog")), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
