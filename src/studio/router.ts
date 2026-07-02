// The remix studio API (/api/remix/*). Page serving lives in worker.ts, which
// injects the fork's theme into the real prerendered pages.

import { getAgentByName } from "agents";
import { hasPaidGrant } from "./auth";
import { forkIdFrom } from "./cookies";

export { forkIdFrom } from "./cookies";

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
  };
  if (path === "/api/remix/agent" && request.method === "POST") {
    const allowPaid = await hasPaidGrant(request, env, forkId);
    const stream = await agent.streamAgentEdit(String(body.prompt ?? ""), allowPaid);
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
