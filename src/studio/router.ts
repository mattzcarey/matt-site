// The remix studio API (/api/remix/*) and workspace-served files
// (/remix-assets/*). Page serving lives in worker.ts, which overlays the
// fork's edits onto the real prerendered pages.

import { getAgentByName } from "agents";
import { hasPaidGrant } from "./auth";
import { PAGES_DIR, ROOT, THEME_FILE } from "./config";
import { forkIdFrom } from "./cookies";
import { normalizeRoute } from "./serving";

export { forkIdFrom } from "./cookies";

const ASSET_TYPES: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
};

// Files served straight from the fork's workspace (fork.js and friends).
// Scope-bound under /remix-assets/ so a hostile ServiceWorker registration
// can never claim /.
export async function handleRemixAsset(request: Request, env: Env): Promise<Response> {
  const forkId = forkIdFrom(request);
  if (!forkId) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const rest = url.pathname.slice("/remix-assets/".length);
  if (!rest || rest.includes("..")) return new Response("Not found", { status: 404 });
  const agent = await getAgentByName(env.USERAPP, forkId);
  const content = await agent.previewFile(`${ROOT}/${rest}`);
  if (content === null) return new Response("Not found", { status: 404 });
  const ext = rest.slice(rest.lastIndexOf(".") + 1).toLowerCase();
  return new Response(content, {
    headers: {
      "content-type": ASSET_TYPES[ext] ?? "text/plain; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

export async function handleStudioApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/remix/")) return null;

  const forkId = forkIdFrom(request);
  if (!forkId) {
    return Response.json({ error: "Start remixing first." }, { status: 401 });
  }
  const agent = await getAgentByName(env.USERAPP, forkId);

  if (path === "/api/remix/state") {
    return Response.json(await agent.remixState());
  }
  // Live workspace reads: mid-turn hot-reload previews (and the committed
  // state between turns, since the workspace is the working tree).
  if (path === "/api/remix/preview/theme") {
    const css = await agent.previewFile(THEME_FILE);
    return new Response(css ?? "", {
      headers: { "content-type": "text/css; charset=utf-8", "cache-control": "private, no-store" },
    });
  }
  if (path === "/api/remix/preview/page") {
    const route = url.searchParams.get("route") ?? "/";
    if (route.includes("..")) return new Response("Not found", { status: 404 });
    const html = await agent.previewFile(`${PAGES_DIR}${normalizeRoute(route)}`);
    if (html === null) return new Response("Not found", { status: 404 });
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
      },
    });
  }
  if (path === "/api/remix/reset" && request.method === "POST") {
    return Response.json(await agent.resetSelf());
  }
  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    route?: string;
    id?: string;
  };
  if (path === "/api/remix/agent" && request.method === "POST") {
    // The paid tiers require the HttpOnly grant cookie set at sign-in, bound
    // to the fork id — a leaked localStorage id alone cannot spend tokens.
    const allowPaid = await hasPaidGrant(request, env, forkId);
    const requestedRoute = String(body.route ?? "/");
    const route =
      requestedRoute.startsWith("/") && !requestedRoute.includes("..") ? requestedRoute : "/";
    const stream = await agent.streamAgentEdit(String(body.prompt ?? ""), allowPaid, route);
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
      },
    });
  }
  if (path === "/api/remix/revert" && request.method === "POST") {
    return Response.json(await agent.revertVersion(String(body.id ?? "")));
  }
  return Response.json({ error: "Unknown remix API." }, { status: 404 });
}
