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

- `src/worker.ts` — entry; exports `UserApp`, routes `/auth/*` +
  `/oauth/cloudflare[/callback]` + `/api/remix/*`,
  injects the theme into HTML asset responses, passes everything else through.
- `src/studio/router.ts` — the API handlers.
- `src/studio/auth.ts` — BYO-model sign-in: Cloudflare OAuth (code + PKCE),
  ChatGPT device-code flow, logout (see PLANS/byo-auth.md).
- `src/studio/cookies.ts` — fork-cookie parsing + HMAC-signed cookie payloads.
- `src/studio/models.ts` — per-tier model construction (Codex SSE aggregation,
  Workers AI REST, free binding).
- `src/studio/user-app.ts` — the DO: seed page snapshots, agent edit (SSE),
  theme versions, revert, reset, auth tokens + single-flight refresh.
- `src/studio/overlay.ts` — the site-styled floating widget.
- `src/studio/config.ts` — models, agent system prompt, constants.

## Model tiers (bring your own account)

A restyle is a **single model call** (request + current theme + real page
markup → complete new stylesheet) — no tool loop, capped at 120s. Three tiers:

- **ChatGPT** — device-code sign-in against the public Codex client; restyles
  run on `chatgpt.com/backend-api/codex` and spend the user's plan quota.
  Experimental: the model slug + `OpenAI-Beta` header in `config.ts` are best
  guesses pending a manual curl with a real token.
- **Cloudflare** — auth-code + PKCE against `dash.cloudflare.com/oauth2/*`
  (self-serve OAuth client; `CF_OAUTH_CLIENT_SECRET` wrangler secret);
  restyles run over the Workers AI REST API billed to the user's account.
- **Free** — the default: `@cf/openai/gpt-oss-20b` on the `env.AI` binding
  (~10-16s per turn), capped at 10 restyles per fork per day. `@cf/` slugs use
  the binding; any other id in `MODEL` goes to the OpenAI API via the
  `OPENAI_API_KEY` secret (`.env` for local dev).

Tokens live only in the fork's Durable Object (never in cookies or the
browser); refresh is single-flight inside the DO because both providers rotate
refresh tokens. Sign-in also sets an HttpOnly `remix_auth` grant cookie bound
to the fork id, so a leaked localStorage id alone can't spend a user's tokens.

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

- Free-tier restyles spend Workers AI tokens on the account (capped per fork
  per day); signed-in restyles bill the visitor.
- The worker now fronts all asset requests (`run_worker_first: true`); unforked
  traffic is a single `env.ASSETS.fetch` passthrough.
- Cloudflare tier setup (dash, one-time): create the self-serve OAuth client,
  set `CF_OAUTH_CLIENT_SECRET` via `wrangler secret`, verify the publisher DNS
  TXT record, flip the client public.
- Possible next: share-a-theme links, account picker for multi-account CF
  grants, let the agent also write a scoped JS file (would weaken the content
  lock).
