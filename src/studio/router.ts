// Top-level routing for the remix studio. Everything under /remix and
// /api/remix is handled here; all other paths fall through to the static site
// (served by the ASSETS binding).

import { getAgentByName } from "agents";
import { FORK_COOKIE, STUDIO_PREFIX, type ModelChoice } from "./config";

const BASE_TARGET = "__base__";

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

// A fork id is a client-generated opaque token; keep it to safe chars.
function safeForkId(raw: string | null): string | null {
  if (!raw) return null;
  const id = raw.trim().slice(0, 64);
  return /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
}

export async function handleStudio(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  const isStudioPage = path === STUDIO_PREFIX || path.startsWith(STUDIO_PREFIX + "/");
  const isStudioApi = path.startsWith("/api/remix/");
  if (!isStudioPage && !isStudioApi) return null; // not ours

  const forkId = safeForkId(getCookie(request, FORK_COOKIE));

  // ── API ───────────────────────────────────────────────────────────
  if (isStudioApi) {
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
      const model: ModelChoice = body.model === "fast" ? "fast" : "capable";
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

  // ── Studio page + its bundled assets ──────────────────────────────
  // Anonymous visitors see the pristine base app; forked visitors see theirs.
  const target = forkId ?? BASE_TARGET;
  const agent = await getAgentByName(env.USERAPP, target);
  try {
    return await agent.serve(path, forkId !== null);
  } catch (err) {
    return new Response("remix error: " + String(err), { status: 500 });
  }
}
