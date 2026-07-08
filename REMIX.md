# Remix

Visitors can create a private remix of the page they are viewing. Each browser
gets a `UserApp` Durable Object containing a Think workspace and
content-addressed version history.

```text
Sign in with ChatGPT → describe a change → UserApp (Think) → GPT-5.5 tools
                     → live preview → commit
```

Remixing runs on the visitor's own ChatGPT plan: `gpt-5.5` via the Codex
Responses API, billed to them. Sign-in uses OpenAI's **device-code flow** — the
widget shows a code, the visitor enters it at `auth.openai.com/codex/device`,
and the worker polls until it's approved. Tokens are held only in the fork's
Durable Object and never reach the browser. There is no free model and no API
key; the only "constants" are the public Codex CLI client id and endpoints,
hardcoded in `src/studio/chatgpt.ts`.

> Sign-in requires "device code login" enabled in ChatGPT Settings → Security.

Pages are copy-on-read: `/site/pages/<route>/index.html` is copied from ASSETS
when the agent first reads or edits it. Copying context does not count as a
remix. The agent can edit:

- `/site/theme.css` for styling;
- `/site/pages/**` for structure and content;
- `/site/fork.js` for behavior.

Workspace writes hot-reload the initiating tab. CSS is sent inline, HTML morphs
the current document, and JS disposes/re-imports. Failed turns restore the last
committed version. Served remixes are private, uncacheable, and noindexed.

## Main modules

- `src/studio/chatgpt.ts` — Sign in with ChatGPT: OAuth device flow, token
  refresh, and the gpt-5.5 Codex Responses model (Vercel AI SDK).
- `src/studio/user-app.ts` — Think agent, workspace, live preview, history, and
  the per-fork ChatGPT session (device flow + single-flight token refresh).
- `src/studio/versions.ts` — content-addressed history and materialization.
- `src/studio/serving.ts` — page overlay and serve-time invariants.
- `src/studio/overlay.ts` / `hotreload.ts` — floating UI (sign-in + prompt) and
  live updates.
- `src/studio/router.ts` / `src/worker.ts` — HTTP routing, `/api/remix/auth/*`
  device-flow endpoints, and asset serving.

## The ChatGPT egress caveat

`chatgpt.com/backend-api/codex` (the model endpoint, not auth) can reject direct
Cloudflare Worker subrequests via WAF/bot protection. Local `wrangler dev`
egresses from your machine, so the full flow works locally. In production, if
gpt-5.5 requests are blocked, route them through a private Cloudflare Container
(the proven prior approach) — the auth flow and request normalization here stay
the same; only the egress hop changes.

## Development

```bash
pnpm preview   # astro build && wrangler dev  → http://localhost:8787
pnpm check     # astro build && tsc && wrangler deploy --dry-run
pnpm deploy
```
