// The remix studio API (/api/remix/*). Page serving lives in worker.ts, which
// injects the fork's theme into the real prerendered pages.

import { getAgentByName } from "agents";
import { FORK_COOKIE, type ModelChoice } from "./config";

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

// A fork id is a client-generated opaque token; keep it to safe chars.
export function forkIdFrom(request: Request): string | null {
  const raw = getCookie(request, FORK_COOKIE);
  if (!raw) return null;
  const id = raw.trim().slice(0, 64);
  return /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
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
  if (path === "/api/remix/reset" && request.method === "POST") {
    await agent.resetSelf();
    return Response.json({ ok: true });
  }
  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    id?: string;
    model?: string;
  };
  if (path === "/api/remix/agent" && request.method === "POST") {
    const model: ModelChoice = body.model === "capable" ? "capable" : "fast";
    const stream = await agent.streamAgentEdit(String(body.prompt ?? ""), model);
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
