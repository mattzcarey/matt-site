import type { APIRoute } from "astro";
import { workMd } from "../lib/md-pages";

export const GET: APIRoute = () =>
  new Response(workMd(), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
