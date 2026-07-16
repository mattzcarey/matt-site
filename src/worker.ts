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
import { classifyBot, llmShell, mdPathFor } from "./bots";
import { PASSTHROUGH_HEADER, fetchAppWorker, loadAppWorker } from "./studio/app-worker";
import { getCookie } from "./studio/cookies";
import { forkIdFrom, handleRemixAsset, handleStudioApi } from "./studio/router";
import { applyInvariants } from "./studio/serving";

export { SystemBroker } from "./studio/system-broker";
export { UserApp } from "./studio/user-app";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

    // Bot / LLM-view branch. Runs before any fork logic: bots and LLM view
    // always get the original prebundled content, never a remix.
    if (request.method === "GET" || request.method === "HEAD") {
      const view = url.searchParams.get("view");
      if (view === "llm" || view === "human") {
        const clean = new URL(url);
        clean.searchParams.delete("view");
        return new Response(null, {
          status: 303,
          headers: {
            location: clean.toString(),
            "set-cookie":
              view === "llm"
                ? "view=llm; Path=/; Max-Age=31536000; SameSite=Lax"
                : "view=; Path=/; Max-Age=0; SameSite=Lax",
            "cache-control": "no-store",
          },
        });
      }
      const mdPath = mdPathFor(url.pathname);
      if (mdPath) {
        const bot = classifyBot(request);
        if (bot === "markdown") {
          // AI crawlers get the markdown twin at the page's own URL.
          const mdRes = await env.ASSETS.fetch(new URL(mdPath, url).toString(), {
            method: request.method,
          });
          // The SAME page URL serves markdown to bots and HTML to humans, so
          // this response must never enter a shared cache — no Vary on
          // User-Agent would reliably split it. Keep it uncacheable; the
          // markdown twin under /md/* is separately cacheable if a bot wants it.
          const headers = new Headers(mdRes.headers);
          headers.set("content-type", "text/markdown; charset=utf-8");
          headers.set("cache-control", "private, no-store");
          headers.delete("etag");
          return new Response(mdRes.body, { status: mdRes.status, headers });
        }
        if (!bot && getCookie(request, "view") === "llm") {
          const mdRes = await env.ASSETS.fetch(new URL(mdPath, url).toString());
          if (mdRes.ok) {
            const shell = llmShell(await mdRes.text(), url.pathname);
            return new Response(request.method === "HEAD" ? null : shell, {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "private, no-store",
              },
            });
          }
        }
      }
      // "html" bots and cookie-less humans fall through to normal serving.
    }

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
    // Non-GET requests only exist for forks with an app worker (form posts,
    // API calls to generated routes): ASSETS can't answer them, so they go
    // straight to app dispatch and 405 when unclaimed.
    const isRead = request.method === "GET" || request.method === "HEAD";
    if (!forkId) return env.ASSETS.fetch(assetReq);
    const assetRes = isRead ? await env.ASSETS.fetch(assetReq) : null;
    if (assetRes) {
      const contentType = assetRes.headers.get("content-type") ?? "";
      // Real static assets (css, images, fonts) serve untouched. HTML pages
      // and asset misses (routes only the fork's app worker knows) go on to
      // fork dispatch.
      if (!contentType.includes("text/html") && assetRes.status !== 404) return assetRes;
    }

    const agent = await getAgentByName(env.USERAPP, forkId);
    const served = await agent.getServed(url.pathname);

    // The fork's dynamic app worker gets first claim on the route (full-site
    // takeover). It runs isolated with no egress and only the SYSTEM broker;
    // any failure or explicit passthrough falls back to the overlay pipeline.
    if (served.app) {
      try {
        const system = ctx.exports.SystemBroker({ props: { forkId } });
        const entry = loadAppWorker(env, system, forkId, served.app.versionId, served.app);
        // No visitor secrets cross into generated code.
        const appReq = new Request(request);
        appReq.headers.delete("cookie");
        const appRes = await fetchAppWorker(entry, appReq);
        if (!appRes.headers.has(PASSTHROUGH_HEADER)) {
          await assetRes?.body?.cancel();
          const isHtml = (appRes.headers.get("content-type") ?? "").includes("text/html");
          const out = isHtml
            ? await applyInvariants(appRes, { ...served, source: "app" }, env.ASSETS)
            : appRes;
          const headers = new Headers(out.headers);
          headers.set("cache-control", "private, no-store");
          // Generated code must not set cookies, block the widget via CSP, or
          // leave a cacheable validator behind.
          headers.delete("etag");
          headers.delete("set-cookie");
          headers.delete("content-security-policy");
          return new Response(out.body, { status: out.status, headers });
        }
        await appRes.body?.cancel();
      } catch (err) {
        console.warn("app worker failed, serving overlay", err);
      }
    }

    // Unclaimed non-GET request: nothing else can answer it.
    if (!assetRes) return new Response("Method not allowed", { status: 405 });

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
