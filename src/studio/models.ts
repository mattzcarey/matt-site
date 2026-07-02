// Model routing for the three restyle tiers (see PLANS/byo-auth.md §4.3):
//   chatgpt    -> user's ChatGPT plan via the Codex backend (Responses API)
//   cloudflare -> user's Workers AI over REST with their OAuth Bearer token
//   free       -> Matt's env.AI binding (or the OPENAI_API_KEY dev override)

import { createOpenAI } from "@ai-sdk/openai";
import { createWorkersAI } from "workers-ai-provider";
import type { AuthRecord } from "./auth";
import { CHATGPT_CODEX_BASE_URL, CHATGPT_MODEL, CHATGPT_OPENAI_BETA, MODEL } from "./config";

// chatgpt.com/backend-api/codex is stream-only: force stream:true (and the
// mandatory store:false), then aggregate the SSE stream back into a single
// Responses JSON body so the non-streaming generateText call upstream — and
// the shared timeout race — stay identical across all tiers.
const codexFetch: typeof globalThis.fetch = async (input, init) => {
  let body: Record<string, unknown> = {};
  if (typeof init?.body === "string") {
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      /* not JSON; send as-is below */
    }
  }
  body.stream = true;
  body.store = false;
  const res = await fetch(input, { ...init, body: JSON.stringify(body) });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("text/event-stream")) return res;

  const text = await res.text();
  let completed: unknown;
  let failed: unknown;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let event: { type?: string; response?: unknown };
    try {
      event = JSON.parse(data) as { type?: string; response?: unknown };
    } catch {
      continue;
    }
    if (event.type === "response.completed" || event.type === "response.incomplete") {
      completed = event.response;
    } else if (event.type === "response.failed" || event.type === "error") {
      failed = event.response ?? event;
    }
  }
  if (completed === undefined) {
    return new Response(JSON.stringify(failed ?? { error: { message: "Empty Codex stream." } }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify(completed), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export function getModelFor(env: Env, auth: AuthRecord | null) {
  if (auth?.provider === "chatgpt" && auth.chatgptAccountId) {
    return createOpenAI({
      baseURL: CHATGPT_CODEX_BASE_URL,
      apiKey: auth.accessToken,
      headers: {
        "ChatGPT-Account-ID": auth.chatgptAccountId,
        "OpenAI-Beta": CHATGPT_OPENAI_BETA,
        // The backend may allowlist originators; use the Codex CLI's own.
        originator: "codex_cli_rs",
        session_id: crypto.randomUUID(),
      },
      fetch: codexFetch,
    }).responses(CHATGPT_MODEL);
  }
  if (auth?.provider === "cloudflare" && auth.cfAccountId) {
    // REST mode: exactly the live-verified /accounts/{id}/ai/run/{model}
    // request with the user's OAuth Bearer token.
    return createWorkersAI({ accountId: auth.cfAccountId, apiKey: auth.accessToken })(MODEL);
  }
  if (MODEL.startsWith("@cf/")) {
    return createWorkersAI({ binding: env.AI })(MODEL);
  }
  return createOpenAI({ apiKey: env.OPENAI_API_KEY })(MODEL);
}
