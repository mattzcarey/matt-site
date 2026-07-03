// Main worker for mattzcarey.com.
//
// The worker runs in front of the static assets (run_worker_first) so it can
// remix the real prerendered pages per visitor, copy-on-write:
//   - no fork cookie      -> assets served untouched (fast path)
//   - forked visitor      -> getServed(path): ASSETS by default, the fork's
//                            workspace shadows agent-edited paths; ONE
//                            serve-time invariants pass (theme injection,
//                            widget survival, noindex, href rebase)
//   - /api/remix/*        -> the studio API (agent SSE, previews, state,
//                            revert, reset)
//   - /remix-assets/*     -> files served from the fork's workspace

import { getAgentByName } from "agents";
import { forkIdFrom, handleRemixAsset, handleStudioApi } from "./studio/router";
import { applyInvariants } from "./studio/serving";

export { UserApp } from "./studio/user-app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // The studio used to live at /remix; the remix is in-place now.
    if (url.pathname === "/remix" || url.pathname.startsWith("/remix/")) {
      return Response.redirect(new URL("/", url).toString(), 301);
    }
    if (url.pathname.startsWith("/remix-assets/")) {
      return handleRemixAsset(request, env);
    }

    const api = await handleStudioApi(request, env);
    if (api) return api;

    const forkId = forkIdFrom(request);
    // Forked visitors must never get a 304: a conditional revalidation of a
    // page they cached before forking would bypass the whole remix pipeline
    // and resurrect the unremixed body from their browser cache.
    let assetReq = request;
    if (
      forkId &&
      (request.headers.has("if-none-match") || request.headers.has("if-modified-since"))
    ) {
      assetReq = new Request(request);
      assetReq.headers.delete("if-none-match");
      assetReq.headers.delete("if-modified-since");
    }
    const assetRes = await env.ASSETS.fetch(assetReq);
    if (!forkId) return assetRes;
    const contentType = assetRes.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return assetRes;

    const agent = await getAgentByName(env.USERAPP, forkId);
    const served = await agent.getServed(url.pathname);
    if (served.source === "assets" && !served.css.trim() && !served.forkJsVersion) {
      return assetRes;
    }

    let base = assetRes;
    if (served.source === "fork" && served.html !== undefined) {
      await assetRes.body?.cancel();
      base = new Response(served.html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    const themed = await applyInvariants(base, served, env.ASSETS);

    // Remixed HTML is per-visitor: never cache it, and drop the asset ETag so
    // a revalidation can't resurrect the unremixed body.
    const headers = new Headers(themed.headers);
    headers.set("cache-control", "private, no-store");
    headers.delete("etag");
    return new Response(themed.body, { status: themed.status, headers });
  },
};
