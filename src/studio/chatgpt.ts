// Sign in with ChatGPT — OAuth device-code flow against auth.openai.com using
// the public Codex CLI client, plus a Codex Responses model bound to the
// signed-in user's own ChatGPT plan. Usage is billed to that user, never to
// the site.
//
// The wire protocol mirrors the Codex CLI: requests to the ChatGPT backend
// carry the `codex_cli_rs` originator, a forged Codex User-Agent, and the
// `client_version` query param the backend gates its model catalogue on.
// Omitting client_version makes every model (including gpt-5.5) report as "not
// supported"; skipping the stateless-body normalization below yields a stream
// with no assistant text. Both were why the earlier attempt looked broken.

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// ── constants (public Codex CLI client — safe to commit) ────────────────
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_ISSUER = "https://auth.openai.com";

export const CHATGPT_MODEL = "gpt-5.5";
export const CHATGPT_VERIFY_URL = `${OPENAI_ISSUER}/codex/device`;

const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const ORIGINATOR = "codex_cli_rs";
// Bump toward the current Codex CLI release if models disappear.
const CLIENT_VERSION = "0.142.5";
// chatgpt.com's backend rejects unfamiliar clients; present as the Codex CLI.
const USER_AGENT = `codex_cli_rs/${CLIENT_VERSION} (Linux; x86_64) reqwest`;
const OPENAI_BETA = "responses=experimental";
const REASONING_ENCRYPTED_CONTENT = "reasoning.encrypted_content";
const AUTH_CLAIM = "https://api.openai.com/auth";

const TOKEN_URL = `${OPENAI_ISSUER}/oauth/token`;
const DEVICE_USERCODE_URL = `${OPENAI_ISSUER}/api/accounts/deviceauth/usercode`;
const DEVICE_TOKEN_URL = `${OPENAI_ISSUER}/api/accounts/deviceauth/token`;
const DEVICE_REDIRECT_URI = `${OPENAI_ISSUER}/deviceauth/callback`;

// Fallback access-token lifetime when the token response omits expires_in and
// the token is not a decodable JWT.
const FALLBACK_TOKEN_TTL_S = 1800;

const DEFAULT_INSTRUCTIONS =
  "You are a helpful assistant powered by the user's ChatGPT account. Answer the request directly and helpfully.";

// ── types ───────────────────────────────────────────────────────────────

/** The signed-in credentials, persisted only in the fork's Durable Object. */
export interface AuthRecord {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  /** ChatGPT account id — required on every Codex request. */
  accountId: string;
  expiresAt: number;
  /** "email · Plan" for display. */
  label: string;
  /** Set when a refresh was definitively denied; forces re-sign-in. */
  invalid?: boolean;
}

/** Minimal auth material a Codex request needs. */
export interface CodexAuth {
  accessToken: string;
  accountId: string;
}

export interface DeviceStart {
  deviceAuthId: string;
  userCode: string;
  interval: number;
  expiresAt: number;
}

export type DevicePoll =
  | { status: "pending" }
  | { status: "authorized"; code: string; codeVerifier: string }
  | { status: "error"; error: string };

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

// ── JWT (decode only; tokens come straight from OpenAI over TLS) ─────────

function decodeJwt(token: string | undefined): Record<string, unknown> | undefined {
  const part = token?.split(".").at(1);
  if (!part) return undefined;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function tokenExpiry(raw: OAuthTokenResponse): number {
  if (typeof raw.expires_in === "number" && raw.expires_in > 0) {
    return Date.now() + raw.expires_in * 1000;
  }
  const exp = decodeJwt(raw.access_token)?.["exp"];
  if (typeof exp === "number") return exp * 1000;
  return Date.now() + FALLBACK_TOKEN_TTL_S * 1000;
}

/** Reads account id + a display label from the id (or access) token. */
function parseAccount(
  idToken: string | undefined,
  accessToken: string,
): {
  accountId?: string;
  label: string;
} {
  const claims = decodeJwt(idToken) ?? decodeJwt(accessToken) ?? {};
  const auth = isRecord(claims[AUTH_CLAIM]) ? (claims[AUTH_CLAIM] as Record<string, unknown>) : {};
  const accountId =
    typeof auth["chatgpt_account_id"] === "string" ? auth["chatgpt_account_id"] : undefined;
  const parts: string[] = [];
  if (typeof claims["email"] === "string" && claims["email"]) parts.push(claims["email"]);
  const plan = auth["chatgpt_plan_type"];
  if (typeof plan === "string" && plan) parts.push(plan.charAt(0).toUpperCase() + plan.slice(1));
  return { accountId, label: parts.join(" · ") || "ChatGPT" };
}

// ── device-code flow ────────────────────────────────────────────────────

/** Requests a fresh device code. The user enters it at CHATGPT_VERIFY_URL. */
export async function requestDeviceCode(): Promise<DeviceStart | { error: string }> {
  const res = await fetch(DEVICE_USERCODE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ client_id: CODEX_CLIENT_ID }),
  }).catch(() => null);
  const data = res?.ok
    ? ((await res.json().catch(() => null)) as {
        device_auth_id?: string;
        user_code?: string;
        usercode?: string;
        interval?: number | string;
      } | null)
    : null;
  const userCode = data?.user_code ?? data?.usercode;
  if (!data?.device_auth_id || !userCode) {
    return { error: "Couldn't start ChatGPT sign-in. Try again." };
  }
  const interval = Math.min(Math.max(Number(data.interval) || 5, 1), 60);
  return {
    deviceAuthId: data.device_auth_id,
    userCode,
    interval,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}

/** Polls once for device authorization. 403/404/429 mean "keep waiting". */
export async function pollDeviceCode(deviceAuthId: string, userCode: string): Promise<DevicePoll> {
  const res = await fetch(DEVICE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ device_auth_id: deviceAuthId, user_code: userCode }),
  }).catch(() => null);
  if (!res || [403, 404, 429].includes(res.status)) return { status: "pending" };
  if (!res.ok) return { status: "error", error: "ChatGPT sign-in failed — start again." };
  const approval = (await res.json().catch(() => null)) as {
    authorization_code?: string;
    code_verifier?: string;
  } | null;
  if (!approval?.authorization_code || !approval.code_verifier) {
    // A 200 without a code means it is still binding — keep polling.
    return { status: "pending" };
  }
  return {
    status: "authorized",
    code: approval.authorization_code,
    codeVerifier: approval.code_verifier,
  };
}

/** Exchanges an approved device authorization for a stored auth record. */
export async function exchangeDeviceCode(
  code: string,
  codeVerifier: string,
): Promise<AuthRecord | { error: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CODEX_CLIENT_ID,
      code_verifier: codeVerifier,
      redirect_uri: DEVICE_REDIRECT_URI,
    }),
  }).catch(() => null);
  const tokens = res?.ok ? ((await res.json().catch(() => null)) as OAuthTokenResponse) : null;
  if (!tokens?.access_token || !tokens.refresh_token) {
    return { error: "ChatGPT sign-in failed — start again." };
  }
  const { accountId, label } = parseAccount(tokens.id_token, tokens.access_token);
  if (!accountId) return { error: "ChatGPT sign-in failed — start again." };
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    accountId,
    expiresAt: tokenExpiry(tokens),
    label,
  };
}

/**
 * Refreshes a stored record. The refresh token rotates on use, so the caller
 * must persist the returned record before letting another request refresh.
 * "denied" = the grant is dead (re-auth needed); null = transient failure.
 */
export async function refreshAuthRecord(record: AuthRecord): Promise<AuthRecord | "denied" | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: record.refreshToken,
        client_id: CODEX_CLIENT_ID,
      }),
    });
    if (!res.ok) return res.status >= 400 && res.status < 500 ? "denied" : null;
    const tokens = (await res.json()) as OAuthTokenResponse;
    if (!tokens.access_token) return "denied";
    return {
      ...record,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? record.refreshToken,
      idToken: tokens.id_token ?? record.idToken,
      expiresAt: tokenExpiry(tokens),
    };
  } catch {
    return null;
  }
}

// ── Codex Responses model (Vercel AI SDK) ────────────────────────────────

/**
 * A Codex-backed gpt-5.5 model. `getAuth` supplies fresh credentials per
 * request (wire it to the DO's single-flight token refresh), so the model
 * created here is reusable across turns.
 */
export function createChatGPTModel(getAuth: () => Promise<CodexAuth>): LanguageModel {
  const openai = createOpenAI({
    baseURL: CODEX_BASE_URL,
    apiKey: "sign-in-with-chatgpt", // placeholder; real auth is injected by the fetch
    fetch: codexFetch(getAuth),
  });
  return openai.responses(CHATGPT_MODEL);
}

/** A fetch that authenticates and adapts requests for the ChatGPT Codex API. */
function codexFetch(getAuth: () => Promise<CodexAuth>): typeof fetch {
  return async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const rawUrl =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(rawUrl);
    if (!url.searchParams.has("client_version"))
      url.searchParams.set("client_version", CLIENT_VERSION);

    const auth = await getAuth();
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("authorization", `Bearer ${auth.accessToken}`);
    headers.set("chatgpt-account-id", auth.accountId);
    headers.set("openai-beta", OPENAI_BETA);
    headers.set("originator", ORIGINATOR);
    headers.set("user-agent", USER_AGENT);
    headers.set("session_id", crypto.randomUUID());

    let body = init?.body;
    if (typeof body === "string" && url.pathname.endsWith("/responses")) {
      body = normalizeResponsesBody(body);
    }

    return fetch(url.href, {
      method: init?.method ?? "POST",
      headers,
      body,
      signal: init?.signal ?? null,
    });
  };
}

/**
 * The ChatGPT Codex backend runs stateless (`store: false`). Omitting any of
 * the following yields a stream with no assistant text:
 *  - reasoning must be configured (Codex models always reason);
 *  - `include` must request encrypted reasoning content to carry it across
 *    turns without server-side storage;
 *  - input items must not carry server-side ids or `item_reference` entries;
 *  - `max_output_tokens` / `max_completion_tokens` are rejected.
 */
function normalizeResponsesBody(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  if (!isRecord(parsed)) return text;
  const out: Record<string, unknown> = { ...parsed };

  out["store"] = false;
  out["reasoning"] = {
    effort: "medium",
    summary: "auto",
    ...(isRecord(out["reasoning"]) ? out["reasoning"] : {}),
  };
  out["text"] = {
    verbosity: "medium",
    ...(isRecord(out["text"]) ? out["text"] : {}),
  };
  if (typeof out["instructions"] !== "string") out["instructions"] = DEFAULT_INSTRUCTIONS;

  const include = new Set<string>(
    Array.isArray(out["include"])
      ? out["include"].filter((v): v is string => typeof v === "string")
      : [],
  );
  include.add(REASONING_ENCRYPTED_CONTENT);
  out["include"] = [...include];

  if (Array.isArray(out["input"])) out["input"] = filterCodexInput(out["input"]);

  delete out["max_output_tokens"];
  delete out["max_completion_tokens"];
  return JSON.stringify(out);
}

/** Strips server-side ids and `item_reference` items the stateless API rejects. */
function filterCodexInput(input: unknown[]): unknown[] {
  return input
    .filter((item) => !(isRecord(item) && item["type"] === "item_reference"))
    .map((item) => {
      if (isRecord(item) && "id" in item) {
        const { id: _id, ...rest } = item;
        return rest;
      }
      return item;
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
