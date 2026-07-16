import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { postMd } from "../../../lib/md-pages";

// Emits dist/md/blog/<id> for every post; ids already end in ".md" so the
// built files are markdown siblings of the rendered /blog/<id>/ pages.
export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(postMd(props.post), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
