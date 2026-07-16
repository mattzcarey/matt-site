// The capability broker handed to a fork's dynamic app worker as env.SYSTEM —
// its ONLY binding. Generated code has no egress and no direct storage; every
// resource request goes through here, scoped to the owning fork by
// ctx.props.forkId (set at getEntrypoint time via ctx.exports loopback).
//
// API (any hostname; system.local by convention):
//   GET/PUT/DELETE /kv/<key>  fork-scoped key/value state (capped)
//   GET /site/<path>          read-only site content: the fork's workspace
//                             file at that exact path when it exists (e.g.
//                             /site/pages/foo/index.html), else the original
//                             prerendered site (ASSETS)

import { WorkerEntrypoint } from "cloudflare:workers";
import { getAgentByName } from "agents";

interface BrokerProps {
  forkId?: string;
}

const KEY_RE = /^[a-zA-Z0-9:._-]{1,128}$/;

const SITE_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

export class SystemBroker extends WorkerEntrypoint<Env> {
  override async fetch(request: Request): Promise<Response> {
    const forkId = (this.ctx.props as BrokerProps | undefined)?.forkId;
    if (!forkId) return new Response("No fork", { status: 403 });
    const url = new URL(request.url);

    if (url.pathname.startsWith("/site/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405 });
      }
      if (url.pathname.includes("..")) return new Response("Not found", { status: 404 });
      // The broker path IS the workspace path (/site/...): the fork's own
      // files win, the original prerendered site is the fallback.
      const agent = await getAgentByName(this.env.USERAPP, forkId);
      const content = await agent.previewFile(url.pathname);
      if (content !== null) {
        const ext = url.pathname.slice(url.pathname.lastIndexOf(".") + 1).toLowerCase();
        return new Response(request.method === "HEAD" ? null : content, {
          headers: { "content-type": SITE_TYPES[ext] ?? "text/plain; charset=utf-8" },
        });
      }
      const path = url.pathname.slice("/site".length);
      return this.env.ASSETS.fetch(`https://assets.local${path}`, { method: request.method });
    }

    if (url.pathname.startsWith("/kv/")) {
      const key = url.pathname.slice("/kv/".length);
      if (!KEY_RE.test(key)) return new Response("Bad key", { status: 400 });
      const agent = await getAgentByName(this.env.USERAPP, forkId);
      if (request.method === "GET") {
        const value = await agent.appKvGet(key);
        return value === null
          ? new Response("Not found", { status: 404 })
          : new Response(value, { headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      if (request.method === "PUT") {
        const result = await agent.appKvPut(key, await request.text());
        return result.ok
          ? new Response(null, { status: 204 })
          : new Response(result.error, { status: 413 });
      }
      if (request.method === "DELETE") {
        await agent.appKvDelete(key);
        return new Response(null, { status: 204 });
      }
      return new Response("Method not allowed", { status: 405 });
    }

    return new Response("Not found", { status: 404 });
  }
}
