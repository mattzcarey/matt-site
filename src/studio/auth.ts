// BYO-model auth for the remix studio (see PLANS/byo-auth.md).
//
// Two sign-in tiers on top of the free one:
//   - Cloudflare: standard auth-code + PKCE against dash.cloudflare.com via a
//     self-serve public OAuth client; restyles bill the user's Workers AI.
//   - ChatGPT: device-code flow against auth.openai.com imitating the public
//     Codex client; restyles spend the user's ChatGPT plan quota.
//
// Tokens live only in the visitor's UserApp Durable Object — never in cookies,
// never in the browser. In-flight OAuth state rides short-lived HMAC-signed
// cookies; a successful sign-in also sets the HttpOnly `remix_auth` grant
// cookie so a leaked localStorage fork id alone cannot spend tokens.

import { getAgentByName } from "agents";
import {
  AUTH_COOKIE,
  CF_API_BASE,
  CF_OAUTH_AUTHORIZE_URL,
  CF_OAUTH_CLIENT_ID,
  CF_OAUTH_REVOKE_URL,
  CF_OAUTH_SCOPES,
  CF_OAUTH_TOKEN_URL,
  CHATGPT_VERIFY_URL,
  CODEX_CLIENT_ID,
  OPENAI_ISSUER,
} from "./config";
import {
  b64urlToBytes,
  clearCookie,
  forkIdFrom,
  getCookie,
  randomToken,
  serializeCookie,
  sha256b64url,
  signPayload,
  verifyPayload,
} from "./cookies";

export interface AuthRecord {
  provider: "chatgpt" | "cloudflare";
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expiresAt: number;
  label: string;
  chatgptAccountId?: string;
  cfAccountId?: string;
  // Set when a refresh was definitively denied upstream; forces re-sign-in.
  invalid?: boolean;
}

interface OAuthTokens {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

interface CfTx {
  state: string;
  verifier: string;
  forkId: string;
  returnTo: string;
  iat: number;
}

interface DeviceTx {
  deviceAuthId: string;
  userCode: string;
  forkId: string;
  interval: number;
  lastPoll: number;
  iat: number;
}

interface GrantCookie {
  forkId: string;
  iat: number;
}

const CF_TX_COOKIE = "rx_oauth_tx";
const CF_TX_PATH = "/auth/cloudflare";
const CF_TX_MAX_AGE = 600;
const DEVICE_TX_COOKIE = "rx_device_tx";
const DEVICE_TX_PATH = "/auth/chatgpt";
const DEVICE_TX_MAX_AGE = 900;
const GRANT_MAX_AGE = 30 * 24 * 3600;
// If the token response omits expires_in and the access token isn't a JWT.
const FALLBACK_TOKEN_TTL_S = 1800;

function decodeJwtPayload(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const part = token.split(".").at(1);
  if (!part) return null;
  const raw = b64urlToBytes(part);
  if (!raw) return null;
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenExpiry(tokens: OAuthTokens): number {
  if (typeof tokens.expires_in === "number" && tokens.expires_in > 0) {
    return Date.now() + tokens.expires_in * 1000;
  }
  const exp = decodeJwtPayload(tokens.access_token)?.exp;
  if (typeof exp === "number") return exp * 1000;
  return Date.now() + FALLBACK_TOKEN_TTL_S * 1000;
}

// POSTs to auth routes must come from our own pages.
function isSameOrigin(request: Request, url: URL): boolean {
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return false;
  return true;
}

// return_to is only ever a same-origin path.
function sanitizeReturnTo(value: string | null): string {
  if (value && value.length <= 512 && /^\/(?!\/)\S*$/.test(value)) return value;
  return "/";
}

function cfBasicAuth(env: Env): string {
  return `Basic ${btoa(`${CF_OAUTH_CLIENT_ID}:${env.CF_OAUTH_CLIENT_SECRET ?? ""}`)}`;
}

async function grantCookieFor(env: Env, forkId: string): Promise<string> {
  const grant = await signPayload(env, { forkId, iat: Date.now() } satisfies GrantCookie);
  return serializeCookie(AUTH_COOKIE, grant, { path: "/", maxAge: GRANT_MAX_AGE });
}

// Paid tiers require the HttpOnly grant cookie set at sign-in, bound to the
// fork id, so a leaked localStorage id alone cannot spend a user's tokens.
export async function hasPaidGrant(request: Request, env: Env, forkId: string): Promise<boolean> {
  const raw = getCookie(request, AUTH_COOKIE);
  if (!raw) return false;
  const grant = await verifyPayload<GrantCookie>(env, raw, GRANT_MAX_AGE * 1000);
  return grant?.forkId === forkId;
}

// Refresh a stored auth record. Both providers rotate refresh tokens on use;
// the caller (the DO, single-flight) must persist the returned pair before
// letting another request refresh. "denied" means the grant is dead (re-auth
// needed); null means a transient failure — try again later.
export async function refreshAuthRecord(
  env: Env,
  record: AuthRecord,
): Promise<AuthRecord | "denied" | null> {
  try {
    const res =
      record.provider === "cloudflare"
        ? await fetch(CF_OAUTH_TOKEN_URL, {
            method: "POST",
            headers: {
              authorization: cfBasicAuth(env),
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: record.refreshToken,
            }),
          })
        : await fetch(`${OPENAI_ISSUER}/oauth/token`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              client_id: CODEX_CLIENT_ID,
              grant_type: "refresh_token",
              refresh_token: record.refreshToken,
            }),
          });
    if (!res.ok) return res.status >= 400 && res.status < 500 ? "denied" : null;
    const tokens = (await res.json()) as OAuthTokens;
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

// ── route handlers ────────────────────────────────────────────────────

async function startCloudflare(url: URL, env: Env, forkId: string): Promise<Response> {
  const state = randomToken();
  const verifier = randomToken();
  const tx: CfTx = {
    state,
    verifier,
    forkId,
    returnTo: sanitizeReturnTo(url.searchParams.get("return_to")),
    iat: Date.now(),
  };
  const cookie = serializeCookie(CF_TX_COOKIE, await signPayload(env, tx), {
    path: CF_TX_PATH,
    maxAge: CF_TX_MAX_AGE,
  });
  const authorize = new URL(CF_OAUTH_AUTHORIZE_URL);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", CF_OAUTH_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", new URL("/auth/cloudflare/callback", url).toString());
  authorize.searchParams.set("scope", CF_OAUTH_SCOPES);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", await sha256b64url(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  return new Response(null, {
    status: 302,
    headers: { location: authorize.toString(), "set-cookie": cookie },
  });
}

async function cloudflareCallback(
  request: Request,
  url: URL,
  env: Env,
  forkId: string,
): Promise<Response> {
  const raw = getCookie(request, CF_TX_COOKIE);
  const tx = raw ? await verifyPayload<CfTx>(env, raw, CF_TX_MAX_AGE * 1000) : null;
  const state = url.searchParams.get("state");
  // State and fork binding are checked before any token-endpoint call, so an
  // attacker-crafted callback URL can't fixate their account onto this fork.
  if (!tx || !state || tx.state !== state || tx.forkId !== forkId) {
    return new Response("Invalid or expired sign-in state. Please try again.", { status: 400 });
  }

  const back = sanitizeReturnTo(tx.returnTo);
  const redirectBack = (extraCookie?: string) => {
    const headers = new Headers({ location: new URL(back, url).toString() });
    headers.append("set-cookie", clearCookie(CF_TX_COOKIE, CF_TX_PATH));
    if (extraCookie) headers.append("set-cookie", extraCookie);
    return new Response(null, { status: 302, headers });
  };

  // Enterprise orgs can block public OAuth apps; user may also deny consent.
  // Either way land back on the page — the widget stays on the free tier.
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("error")) return redirectBack();

  const tokenRes = await fetch(CF_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: cfBasicAuth(env),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: new URL("/auth/cloudflare/callback", url).toString(),
      code_verifier: tx.verifier,
    }),
  }).catch(() => null);
  if (!tokenRes?.ok) return redirectBack();
  const tokens = (await tokenRes.json().catch(() => null)) as OAuthTokens | null;
  if (!tokens?.access_token || !tokens.refresh_token) return redirectBack();

  // The consent screen scopes the grant to the account(s) the user picked,
  // so this usually returns exactly one; auto-pick the first.
  const acctRes = await fetch(`${CF_API_BASE}/accounts`, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  }).catch(() => null);
  const accounts = acctRes?.ok
    ? ((await acctRes.json().catch(() => null)) as {
        result?: Array<{ id?: string; name?: string }>;
      } | null)
    : null;
  const account = accounts?.result?.at(0);
  if (!account?.id) return redirectBack();

  const agent = await getAgentByName(env.USERAPP, forkId);
  await agent.setAuth({
    provider: "cloudflare",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokenExpiry(tokens),
    label: account.name ?? account.id,
    cfAccountId: account.id,
  });
  return redirectBack(await grantCookieFor(env, forkId));
}

async function startChatgpt(env: Env, forkId: string): Promise<Response> {
  const res = await fetch(`${OPENAI_ISSUER}/api/accounts/deviceauth/usercode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: CODEX_CLIENT_ID }),
  }).catch(() => null);
  const data = res?.ok
    ? ((await res.json().catch(() => null)) as {
        device_auth_id?: string;
        user_code?: string;
        interval?: number | string;
      } | null)
    : null;
  if (!data?.device_auth_id || !data.user_code) {
    return Response.json({ error: "Couldn't start ChatGPT sign-in. Try again." }, { status: 502 });
  }
  const interval = Math.min(Math.max(Number(data.interval) || 5, 1), 60);
  const tx: DeviceTx = {
    deviceAuthId: data.device_auth_id,
    userCode: data.user_code,
    forkId,
    interval,
    lastPoll: 0,
    iat: Date.now(),
  };
  return Response.json(
    { user_code: data.user_code, verify_url: CHATGPT_VERIFY_URL, interval },
    {
      headers: {
        "set-cookie": serializeCookie(DEVICE_TX_COOKIE, await signPayload(env, tx), {
          path: DEVICE_TX_PATH,
          maxAge: DEVICE_TX_MAX_AGE,
        }),
      },
    },
  );
}

// The widget's poll relay. Reads only the signed cookie (never body params),
// so this endpoint can't be used to brute-force other people's user codes.
async function pollChatgpt(request: Request, env: Env, forkId: string): Promise<Response> {
  const raw = getCookie(request, DEVICE_TX_COOKIE);
  const tx = raw ? await verifyPayload<DeviceTx>(env, raw, DEVICE_TX_MAX_AGE * 1000) : null;
  if (!tx || tx.forkId !== forkId) {
    return Response.json({ error: "Sign-in expired — start again." }, { status: 400 });
  }
  const now = Date.now();
  // Enforce the upstream poll interval server-side (small slack for jitter).
  if (now - tx.lastPoll < tx.interval * 1000 - 250) {
    return Response.json({ pending: true }, { status: 429 });
  }

  const pollRes = await fetch(`${OPENAI_ISSUER}/api/accounts/deviceauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_auth_id: tx.deviceAuthId, user_code: tx.userCode }),
  }).catch(() => null);
  // 403/404 while the user hasn't approved yet; treat upstream 429 as pending.
  if (!pollRes || [403, 404, 429].includes(pollRes.status)) {
    const bumped = await signPayload(env, { ...tx, lastPoll: now } satisfies DeviceTx);
    return Response.json(
      { pending: true },
      {
        headers: {
          "set-cookie": serializeCookie(DEVICE_TX_COOKIE, bumped, {
            path: DEVICE_TX_PATH,
            maxAge: DEVICE_TX_MAX_AGE,
          }),
        },
      },
    );
  }
  const failed = (message: string, status: number) =>
    Response.json(
      { error: message },
      { status, headers: { "set-cookie": clearCookie(DEVICE_TX_COOKIE, DEVICE_TX_PATH) } },
    );
  if (!pollRes.ok) return failed("ChatGPT sign-in failed — start again.", 502);

  const approval = (await pollRes.json().catch(() => null)) as {
    authorization_code?: string;
    code_verifier?: string;
  } | null;
  if (!approval?.authorization_code || !approval.code_verifier) {
    return failed("ChatGPT sign-in failed — start again.", 502);
  }

  const tokenRes = await fetch(`${OPENAI_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: approval.authorization_code,
      client_id: CODEX_CLIENT_ID,
      code_verifier: approval.code_verifier,
      redirect_uri: `${OPENAI_ISSUER}/deviceauth/callback`,
    }),
  }).catch(() => null);
  const tokens = tokenRes?.ok ? ((await tokenRes.json().catch(() => null)) as OAuthTokens) : null;
  if (!tokens?.access_token || !tokens.refresh_token) {
    return failed("ChatGPT sign-in failed — start again.", 502);
  }

  const claims = decodeJwtPayload(tokens.id_token) ?? {};
  const authClaims = (claims["https://api.openai.com/auth"] ?? {}) as Record<string, unknown>;
  const accountId = authClaims.chatgpt_account_id;
  if (typeof accountId !== "string" || !accountId) {
    return failed("ChatGPT sign-in failed — start again.", 502);
  }
  const plan = authClaims.chatgpt_plan_type;
  const email = claims.email;
  const parts: string[] = [];
  if (typeof email === "string" && email) parts.push(email);
  if (typeof plan === "string" && plan) parts.push(plan.charAt(0).toUpperCase() + plan.slice(1));
  const label = parts.join(" · ") || "ChatGPT";

  const agent = await getAgentByName(env.USERAPP, forkId);
  await agent.setAuth({
    provider: "chatgpt",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    expiresAt: tokenExpiry(tokens),
    label,
    chatgptAccountId: accountId,
  });
  const headers = new Headers();
  headers.append("set-cookie", clearCookie(DEVICE_TX_COOKIE, DEVICE_TX_PATH));
  headers.append("set-cookie", await grantCookieFor(env, forkId));
  return Response.json({ ok: true, label }, { headers });
}

async function logout(env: Env, forkId: string): Promise<Response> {
  const agent = await getAgentByName(env.USERAPP, forkId);
  const record = await agent.clearAuth();
  if (record?.provider === "cloudflare") {
    // Best-effort revocation; ChatGPT has no public revoke for this client
    // (users can revoke from ChatGPT Settings → Security).
    const pairs: Array<[string, string]> = [
      [record.refreshToken, "refresh_token"],
      [record.accessToken, "access_token"],
    ];
    for (const [token, hint] of pairs) {
      if (!token) continue;
      await fetch(CF_OAUTH_REVOKE_URL, {
        method: "POST",
        headers: {
          authorization: cfBasicAuth(env),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token, token_type_hint: hint }),
      }).catch(() => undefined);
    }
  }
  return Response.json({ ok: true }, { headers: { "set-cookie": clearCookie(AUTH_COOKIE, "/") } });
}

// ── dispatcher (called from worker.ts before the studio API) ──────────

export async function handleAuth(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/auth/")) return null;

  // All auth routes operate on an existing fork.
  const forkId = forkIdFrom(request);
  if (!forkId) {
    return request.method === "GET"
      ? Response.redirect(new URL("/", url).toString(), 302)
      : Response.json({ error: "Start remixing first." }, { status: 401 });
  }
  if (request.method === "POST" && !isSameOrigin(request, url)) {
    return Response.json({ error: "Cross-origin request refused." }, { status: 403 });
  }

  if (url.pathname === "/auth/cloudflare" && request.method === "GET") {
    return startCloudflare(url, env, forkId);
  }
  if (url.pathname === "/auth/cloudflare/callback" && request.method === "GET") {
    return cloudflareCallback(request, url, env, forkId);
  }
  if (url.pathname === "/auth/chatgpt" && request.method === "POST") {
    return startChatgpt(env, forkId);
  }
  if (url.pathname === "/auth/chatgpt/callback" && request.method === "POST") {
    return pollChatgpt(request, env, forkId);
  }
  if (url.pathname === "/auth/logout" && request.method === "POST") {
    return logout(env, forkId);
  }
  return Response.json({ error: "Unknown auth route." }, { status: 404 });
}
