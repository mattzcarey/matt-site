// Cookie parsing and HMAC-signed cookie payloads, shared by the studio router
// and the auth routes. The signing key is derived from the OAuth client secret
// (the one secret this worker holds); rotating that secret only invalidates
// in-flight transaction cookies and paid-tier grant cookies — signed-in
// sessions live in the fork's Durable Object, not in cookies.

import { FORK_COOKIE } from "./config";

const enc = new TextEncoder();

export function getCookie(request: Request, name: string): string | null {
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

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

export async function sha256b64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return b64url(new Uint8Array(digest));
}

function signingKey(env: Env): Promise<CryptoKey> {
  const secret = env.CF_OAUTH_CLIENT_SECRET;
  if (!secret) {
    // Fail closed: signing with a known constant would make every cookie
    // signature forgeable.
    throw new Error("CF_OAUTH_CLIENT_SECRET is unset — refusing to sign/verify auth cookies");
  }
  return crypto.subtle.importKey(
    "raw",
    enc.encode(`remix-auth:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// Signed payloads always carry `iat`; verification enforces a max age so a
// stolen transaction cookie cannot be replayed indefinitely.
export async function signPayload<T extends { iat: number }>(
  env: Env,
  payload: T,
): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign("HMAC", await signingKey(env), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(mac))}`;
}

export async function verifyPayload<T extends { iat: number }>(
  env: Env,
  value: string,
  maxAgeMs: number,
): Promise<T | null> {
  const dot = value.indexOf(".");
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  const mac = b64urlToBytes(value.slice(dot + 1));
  if (!mac) return null;
  const ok = await crypto.subtle.verify("HMAC", await signingKey(env), mac, enc.encode(body));
  if (!ok) return null;
  const raw = b64urlToBytes(body);
  if (!raw) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(raw)) as T;
    if (typeof payload.iat !== "number" || Date.now() - payload.iat > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { path: string; maxAge: number },
): string {
  return `${name}=${value}; Path=${opts.path}; Max-Age=${opts.maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(name: string, path: string): string {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
