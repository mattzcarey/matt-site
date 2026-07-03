# Remix (in-place site restyling)

Every visitor can restyle mattzcarey.com with AI — **the real site, in place, on
whatever page they're on**. The words stay Matt's; the look becomes theirs.
Inspired by [`cjol/per-user-fork-studio`](https://github.com/cjol/per-user-fork-studio),
reduced to its essence for a prerendered static site.

## How it works

The site is fully prerendered by Astro. Each visitor's fork is a Durable Object
holding a Workspace (`theme.css` + page snapshots) and a content-addressed
version history. The worker runs in front of the static assets
(`run_worker_first`) and serves copy-on-write:

```
no fork cookie   -> assets pass through untouched (fast path)
forked visitor   -> getServed(path): ASSETS by default, the fork's workspace
                    shadows agent-edited paths; ONE serve-time invariants pass
                    (theme injection, widget survival, noindex, href rebase)
/auth/* + /oauth/cloudflare[/callback] -> BYO-model sign-in
/api/remix/*     -> the studio API: agent (SSE), previews, state, revert, reset
/remix-assets/*  -> files served from the fork's workspace (fork.js)
/remix           -> 301 to / (the old studio page is gone)
```

- **Every tier can edit everything.** Write tools are allowlisted to the
  fork's `/site/` workspace; tiers differ only in model and billing. Page
  files are a **copy-on-read** mirror of the live site: they materialize from
  the static assets the first time the agent reads or edits them, so there is
  no snapshot tool and no fork-time page seeding — first touch always gets
  fresh markup. Reverting to a version without a page evicts its copy and
  serving falls back to the real site.
- **Hot reload.** The tool loop streams workspace change events over SSE: CSS
  rides the stream inline and repaints instantly; HTML notifies and the client
  fetches the preview and morphs the live DOM (idiomorph-lite, widget/script
  ignore-set); fork.js disposes and re-imports. Failed turns roll the workspace
  back and the client reverts.
- **Per-visitor state = a Durable Object** (`UserApp extends Think`), keyed by a
  `localStorage` id mirrored into the `remix_fork` cookie. Versions are
  content-addressed manifests (`ver/<id>` → path→hash, `blob/<hash>` → bytes,
  capped at 25) over a workspace seeded with snapshots of the real prerendered
  pages (`/site/pages/...`) so the agent writes selectors against actual markup.
- **The widget** (`src/studio/overlay.ts`) is baked into every page via
  `Layout.astro` and styled to match the site: white/`#111010` surfaces, neutral
  grays, Kaisei Tokumin serif headings, dark mode via `prefers-color-scheme`.
  The whole flow happens in the panel on the current page: start remixing →
  pick a model (sign in or free) → describe a look → watch the page restyle
  live. History with per-version revert and a discard link.

## Files

- `src/worker.ts` — entry; exports `UserApp`, routes `/auth/*` +
  `/oauth/cloudflare[/callback]` + `/api/remix/*` + `/remix-assets/*`, serves
  pages copy-on-write, passes everything else through.
- `src/studio/router.ts` — the API handlers + workspace file serving.
- `src/studio/serving.ts` — `getServed` types + the serve-time invariants pass.
- `src/studio/versions.ts` — content-addressed version storage (manifests,
  blobs, revert/rollback materialization, GC).
- `src/studio/hotreload.ts` — the client hot-reload script (CSS swap, DOM
  morph, JS re-import), spliced into the widget IIFE.
- `src/studio/auth.ts` — BYO-model sign-in: Cloudflare OAuth (code + PKCE),
  ChatGPT device-code flow, logout (see PLANS/byo-auth.md).
- `src/studio/cookies.ts` — fork-cookie parsing + HMAC-signed cookie payloads.
- `src/studio/models.ts` — per-tier model construction (Codex SSE aggregation,
  Workers AI REST, free binding).
- `src/studio/user-app.ts` — the DO: seed page snapshots, tool loop + fallback
  agent edit (SSE), versions, revert, reset, auth tokens + single-flight
  refresh.
- `src/studio/overlay.ts` — the site-styled floating widget.
- `src/studio/config.ts` — model tiers, write allowlist, system prompts,
  auth constants.

## Model tiers (bring your own account)

A restyle is a Think tool loop when the tier's model can drive one (read theme,
read markup, write the complete stylesheet — every write hot-reloads), with a
single-call fallback (request + current theme + real page markup → complete
new stylesheet), capped at 120s. Three tiers:

- **ChatGPT** — device-code sign-in against the public Codex client; restyles
  run on `chatgpt.com/backend-api/codex` and spend the user's plan quota.
  Experimental: the model slug + `OpenAI-Beta` header in `config.ts` are best
  guesses pending a manual curl with a real token.
- **Cloudflare** — auth-code + PKCE against `dash.cloudflare.com/oauth2/*`
  (self-serve OAuth client; `CF_OAUTH_CLIENT_SECRET` wrangler secret);
  restyles run over the Workers AI REST API billed to the user's account, same
  loop/fallback models as the free tier.
- **Free** — the default: `@cf/meta/llama-4-scout-17b-16e-instruct` drives the
  loop (with a text-leak salvage guard); `@cf/openai/gpt-oss-20b` is the
  single-call fallback. Capped at 10 restyles per fork per day. `@cf/` slugs
  use the `env.AI` binding; any other id goes to the OpenAI API via the
  `OPENAI_API_KEY` secret (`.env` for local dev).

Tokens live only in the fork's Durable Object (never in cookies or the
browser); refresh is single-flight inside the DO because both providers rotate
refresh tokens. Sign-in also sets an HttpOnly `remix_auth` grant cookie bound
to the fork id, so a leaked localStorage id alone can't spend a user's tokens.
An expired/denied credential degrades the turn to the free tier with a status
message instead of failing it.

## Run / deploy

```bash
pnpm dev        # astro dev (site only)
pnpm preview    # astro build && wrangler dev (full worker; needs wrangler auth)
pnpm deploy     # build first: pnpm build && wrangler deploy
```

Validated end-to-end locally (wrangler dev, real Workers AI call): anonymous
passthrough, fork seeding, scout-loop restyle with live SSE css events,
iterative restyle, theme injection on every page with
`cache-control: private, no-store`, revert, reset.

## Notes / next

- Free-tier restyles spend Workers AI tokens on the account (capped per fork
  per day); signed-in restyles bill the visitor.
- The worker now fronts all asset requests (`run_worker_first: true`); unforked
  traffic is a single `env.ASSETS.fetch` passthrough.
- Cloudflare tier setup (dash, one-time): create the self-serve OAuth client,
  set `CF_OAUTH_CLIENT_SECRET` via `wrangler secret`, verify the publisher DNS
  TXT record, flip the client public.
- Possible next: share-a-theme links, account picker for multi-account CF
  grants, content-lock advisory checker for BYO page edits.
