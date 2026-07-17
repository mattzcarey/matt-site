import type { APIRoute } from "astro";
import { homeMd } from "../lib/md-pages";

export const GET: APIRoute = () =>
  new Response(homeMd(), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
