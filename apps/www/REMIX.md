# Remix studio (`/remix`)

A "little Think" bolted onto the personal site: every visitor can fork the page
and restyle it with AI, but **the content stays Matt's**. Inspired by
[`cjol/per-user-fork-studio`](https://github.com/cjol/per-user-fork-studio),
adapted per the brief: no Artifacts, no sandbox, on the main worker, content
locked.

## How it differs from the cjol demo

| cjol/per-user-fork-studio | this |
| --- | --- |
| Artifacts git host + per-user repos | none — forks are ephemeral, no artifacts |
| Worker Loader runs each fork's server code (a sandbox) | **no Worker Loader / no sandbox** — the fork is a client bundle run in the visitor's browser |
| AI edits everything, incl. content/behaviour | AI edits **presentation only**; content is injected read-only and lock-checked |
| Separate `fork-studio` worker | lives on the **main site worker** at `/remix` |
| cookie login + named forks | anonymous `localStorage` id, mirrored to a cookie for routing |

## Architecture

```
GET /                 -> static Astro site (served by the ASSETS binding, untouched)
GET /remix            -> studio: build the fork's client app, serve it + overlay
GET /remix/app.js     -> the worker-bundler'd client bundle (runs in the browser)
POST /api/remix/agent -> Think agent restyles the files (SSE)  [needs env.AI]
GET  /api/remix/state -> version history
POST /api/remix/revert, /api/remix/reset
```

- **No sandbox.** The remix app is 100% client-side. `worker-bundler`'s
  `createApp()` bundles `src/app.ts` into a browser asset; the worker serves that
  asset and the browser runs it. `_server.ts` exists only because `createApp()`
  requires a server entry — its output is never loaded/executed.
- **Per-user state = a Durable Object** (`UserApp extends Think`), keyed by the
  visitor's `localStorage` id. It holds the fork's files in a `Workspace` and its
  version history in DO storage. Ephemeral; "Discard remix" wipes it.
- **Content lock.** The real content lives in `src/studio/content.ts`
  (`SITE_CONTENT`). `index.html` carries a `__SITE_CONTENT__` placeholder inside
  `<script id="site-content">`; the host swaps in the canonical JSON **at serve
  time**, so the fork never holds the content bytes. Three guards enforce it:
  1. the agent system prompt forbids touching content and requires rendering from
     `#site-content`;
  2. `contentLockError()` rejects any build that drops the injection point, the
     `#site-content` element, or the client that reads it;
  3. content is re-injected fresh on every render.

  This is a *reasonable* lock for a playground, not a hard security boundary: the
  AI still writes the render code, so a determined prompt could in theory render
  the injected data oddly. If you want an absolute lock, render the content HTML
  host-side into a fixed slot and let the AI theme only via CSS (noted below).

## Files

- `src/worker.ts` — worker entry; exports `UserApp`, routes `/remix*`, delegates the rest to `ASSETS`.
- `src/studio/router.ts` — `/remix` + `/api/remix/*` routing, fork-id cookie.
- `src/studio/user-app.ts` — the DO: seed, build (`createApp`), serve, agent edit, versions/revert, content-lock check.
- `src/studio/base-app.ts` — the seed files every fork starts from (`index.html`, `styles.css`, `src/app.ts`, `_server.ts`).
- `src/studio/content.ts` — `SITE_CONTENT` (the locked content) + `canonicalStrings`.
- `src/studio/overlay.ts` — the injected fork/customize panel.
- `src/studio/config.ts` — models, system prompt, constants.

## Models

Both run through the `AI` binding (no external key, all Workers AI). Chosen from a
latency benchmark of recent coding models (median of 3 runs on a "restyle this
CSS" prompt, 500 tokens):

| model | median | tok/s | role |
| --- | --- | --- | --- |
| `@cf/zai-org/glm-4.7-flash` | 8.6s | 58 | **Fast** (fastest by 2x) |
| `@cf/moonshotai/kimi-k2.6` | 17.6s | 28 | |
| `@cf/zai-org/glm-5.2` | 21.6s | 19 | |
| `@cf/moonshotai/kimi-k2.7-code` | 37.2s | 12 | **Capable** (code specialist) |

Swap in `src/studio/config.ts`. If the 37s Capable latency is too slow for the
UI, `@cf/moonshotai/kimi-k2.6` (17.6s) is a good faster alternative.

## Run / deploy

```bash
pnpm --filter @matt-site/www dev        # needs `wrangler login` (AI binding is remote)
pnpm --filter @matt-site/www deploy
```

Validated locally without AI (base render, worker-bundler build in workerd,
content injection, per-user DO seeding, version state, static routes intact). The
AI edit loop is wired identically to the cjol reference but needs Cloudflare auth
to exercise (it calls a paid model), so run `wrangler login` then `wrangler dev`,
or deploy, to try "Generate new version".

## Notes / next

- The worker is ~5 MB gzipped (worker-bundler ships esbuild-wasm). Fine on a paid
  plan; keep an eye on the 10 MB limit.
- Deferred from the cjol demo: admin/base editing, "pull base updates" (forks are
  ephemeral so upstream merge is less relevant), naming forks.
- Harder content lock option: host-render the content into a fixed slot, AI themes
  via CSS only.
```
