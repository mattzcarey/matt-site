import type { LanguageModel } from "ai";
import { type CodexAuth, createChatGPTModel } from "./chatgpt";

// The only model is the signed-in visitor's ChatGPT plan: gpt-5.5 via the
// Codex Responses API, billed to their own account. getAuth supplies fresh
// credentials per request (the DO refreshes tokens single-flight).
export function modelFor(getAuth: () => Promise<CodexAuth>): LanguageModel {
  return createChatGPTModel(getAuth);
}
