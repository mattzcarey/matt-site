import type { APIRoute } from "astro";
import { projectsMd } from "../lib/md-pages";

export const GET: APIRoute = () =>
  new Response(projectsMd(), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
