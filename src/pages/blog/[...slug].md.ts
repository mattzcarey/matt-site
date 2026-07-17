import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { blogSlug } from "../../lib/blog-routes";
import { postMd } from "../../lib/md-pages";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({ params: { slug: blogSlug(post) }, props: { post } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(postMd(props.post), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
