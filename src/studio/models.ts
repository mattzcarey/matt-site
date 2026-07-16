import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";

// Z.ai's agentic coding model: handles both restyles and app-worker codegen.
const MODEL = "@cf/zai-org/glm-5.2";

export function modelFor(env: Env, sessionAffinity: string): LanguageModel {
  // glm-5.2 rejects reasoning_effort: null / enable_thinking (glm-4.7-flash
  // options); "low" keeps interactive latency while staying valid.
  return createWorkersAI({ binding: env.AI })(MODEL, {
    sessionAffinity,
    reasoning_effort: "low",
  });
}
