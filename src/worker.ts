// Main worker for mattzcarey.com.
//
// The worker runs in front of the static assets (run_worker_first) so it can
// restyle the real prerendered pages per visitor:
//   - no fork cookie      -> assets served untouched (fast path)
//   - forked visitor      -> same real HTML, with their remix theme.css
//                            injected after the site's own styles
//   - /api/remix/*        -> the studio API (agent, state, revert, reset)
// The HTML never changes — content is locked by construction; only CSS varies.

import { getAgentByName } from "agents";
import { handleAuth } from "./studio/auth";
import { forkIdFrom, handleStudioApi } from "./studio/router";

export { UserApp } from "./studio/user-app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // The studio used to live at /remix; the remix is in-place now.
    if (url.pathname === "/remix" || url.pathname.startsWith("/remix/")) {
      return Response.redirect(new URL("/", url).toString(), 301);
    }

    const auth = await handleAuth(request, env);
    if (auth) return auth;

    const api = await handleStudioApi(request, env);
    if (api) return api;

    const assetRes = await env.ASSETS.fetch(request);
    const forkId = forkIdFrom(request);
    if (!forkId) return assetRes;
    const contentType = assetRes.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return assetRes;

    const agent = await getAgentByName(env.USERAPP, forkId);
    const css = await agent.getTheme();
    if (!css.trim()) return assetRes;

    // The CSS goes inside a <style> tag; make sure it can't close it early.
    const safe = css.replace(/<\/style/gi, "");
    const themed = new HTMLRewriter()
      .on("head", {
        element(el) {
          el.append(`<style id="remix-theme">${safe}</style>`, { html: true });
        },
      })
      .transform(assetRes);

    // Themed HTML is per-visitor: never cache it, and drop the asset ETag so a
    // revalidation can't resurrect the unthemed body.
    const headers = new Headers(themed.headers);
    headers.set("cache-control", "private, no-store");
    headers.delete("etag");
    return new Response(themed.body, { status: themed.status, headers });
  },
};
