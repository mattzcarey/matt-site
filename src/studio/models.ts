import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";

const MODEL = "@cf/zai-org/glm-5.2";

export function modelFor(env: Env, sessionAffinity: string): LanguageModel {
  return createWorkersAI({ binding: env.AI })(MODEL, {
    sessionAffinity,
    reasoning_effort: null,
    chat_template_kwargs: { enable_thinking: false },
  });
}
