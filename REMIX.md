# Remix (in-place site restyling)

Every visitor can restyle mattzcarey.com with AI — **the real site, in place, on
whatever page they're on**. The words stay Matt's; the look becomes theirs.
Inspired by [`cjol/per-user-fork-studio`](https://github.com/cjol/per-user-fork-studio),
reduced to its essence for a prerendered static site.

## How it works

The site is fully prerendered by Astro. A fork's only artifact is a **`theme.css`**
held in that visitor's Durable Object. The worker runs in front of the static
assets (`run_worker_first`) and:

```
no fork cookie   -> assets pass through untouched (fast path)
forked visitor   -> same real HTML, with <style id="remix-theme"> injected
                    after the site's own CSS (HTMLRewriter, no caching)
/api/remix/*     -> the studio API: agent (SSE), state, revert, reset
/remix           -> 301 to / (the old studio page is gone)
```

- **Content lock is architectural.** The only thing the AI can produce is CSS;
  the HTML never passes through it. No integrity checker needed. (Caveat: CSS can
  still hide or pseudo-element-decorate text — it's a playground, not a security
  boundary.)
- **No sandbox, no bundler.** Nothing is built or executed: the theme is plain
  CSS injected at serve time. (The earlier iteration bundled a separate mini-app
  with worker-bundler; that's gone, and the worker shrank ~5x.)
- **Per-visitor state = a Durable Object** (`UserApp extends Think`), keyed by a
  `localStorage` id mirrored into the `remix_fork` cookie. Holds the theme
  version history (capped at 25) and the agent's Workspace, which is seeded with
  snapshots of the real prerendered pages (`/site/pages/*.html`) so the agent
  writes selectors against actual markup. `theme.css` is the one file that
  matters — the agent can scribble anywhere in its workspace, only committed
  theme CSS is ever served.
- **The widget** (`src/studio/overlay.ts`) is baked into every page via
  `Layout.astro` and styled to match the site: white/`#111010` surfaces, neutral
  grays, Kaisei Tokumin serif headings, dark mode via `prefers-color-scheme`.
  The whole flow happens in the panel on the current page: start remixing →
  describe a look → page reloads restyled. History with per-version revert and
  a discard link.

## Files

- `src/worker.ts` — entry; exports `UserApp`, routes `/api/remix/*`, injects the
  theme into HTML asset responses, passes everything else through.
- `src/studio/router.ts` — the API handlers + fork-cookie parsing.
- `src/studio/user-app.ts` — the DO: seed page snapshots, agent edit (SSE),
  theme versions, revert, reset.
- `src/studio/overlay.ts` — the site-styled floating widget.
- `src/studio/config.ts` — models, agent system prompt, constants.

## Models

Both via the `AI` binding (no key): Fast = `@cf/zai-org/glm-4.7-flash`
(most consistent in benchmarks), Capable = `@cf/moonshotai/kimi-k2.7-code`
(slower, strongest coder). Swap in `src/studio/config.ts`.

## Run / deploy

```bash
pnpm dev        # astro dev (site only)
pnpm preview    # astro build && wrangler dev (full worker; needs wrangler auth)
pnpm deploy     # build first: pnpm build && wrangler deploy
```

Validated end-to-end locally (wrangler dev, real Workers AI call): anonymous
passthrough, fork seeding, AI restyle (~30s fast model), theme injection on
every page with `cache-control: private, no-store`, revert, reset.

## Notes / next

- Every "Restyle this site" spends Workers AI tokens on the account.
- The worker now fronts all asset requests (`run_worker_first: true`); unforked
  traffic is a single `env.ASSETS.fetch` passthrough.
- Possible next: rate-limit generates per fork, share-a-theme links, let the
  agent also write a scoped JS file (would weaken the content lock).
