import { createOpenAI } from "@ai-sdk/openai";
import { Container, getContainer, switchPort } from "@cloudflare/containers";
import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { AuthRecord } from "./auth";

const FREE_MODEL = "@cf/zai-org/glm-4.7-flash";
const CLOUDFLARE_MODEL = "@cf/moonshotai/kimi-k2.7-code";
const CODEX_BASE = "https://chatgpt.com/backend-api/codex";
const CHATGPT_MODEL = "gpt-5.5";
const RESPONSES_PATH = "/backend-api/codex/responses";

// ChatGPT blocks direct Worker subrequests. This private Container gives the
// Think agent ordinary server egress; tokens never leave this deployment.
export class CodexEgress extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";
}

function codexFetch(env: Env): typeof fetch {
  return async (input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    const request = new Request(input, {
      ...init,
      body: JSON.stringify({ ...body, stream: true, store: false }),
    });
    const container = getContainer(env.CODEX_EGRESS, "responses");
    return container.fetch(
      switchPort(new Request(`http://codex-egress${RESPONSES_PATH}`, request), 8080),
    );
  };
}

const workersOptions = (sessionAffinity: string) => ({
  sessionAffinity,
  reasoning_effort: null as null,
  chat_template_kwargs: { enable_thinking: false, thinking: false },
});

/** Select the Think agent model from the turn's authenticated provider. */
export function modelFor(
  env: Env,
  auth: AuthRecord | null,
  sessionAffinity: string,
): LanguageModel {
  if (auth?.provider === "chatgpt" && auth.chatgptAccountId) {
    return createOpenAI({
      baseURL: CODEX_BASE,
      apiKey: auth.accessToken,
      headers: {
        "ChatGPT-Account-ID": auth.chatgptAccountId,
        originator: "matt_site_remix",
        session_id: crypto.randomUUID(),
      },
      fetch: codexFetch(env),
    }).responses(CHATGPT_MODEL);
  }
  if (auth?.provider === "cloudflare" && auth.cfAccountId) {
    return createWorkersAI({ accountId: auth.cfAccountId, apiKey: auth.accessToken })(
      CLOUDFLARE_MODEL,
      workersOptions(sessionAffinity),
    );
  }
  return createWorkersAI({ binding: env.AI })(FREE_MODEL, workersOptions(sessionAffinity));
}
