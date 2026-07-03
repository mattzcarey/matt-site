# Remix

Visitors can remix the page they are viewing without changing the public site.
Each browser gets a private `UserApp` Durable Object containing a Think
workspace and content-addressed version history.

## Runtime

```text
anonymous request → static ASSETS
forked HTML       → committed page/CSS/JS overlay → serve-time safety pass
remix prompt      → UserApp (Think) → workspace tools → live SSE preview → commit
```

Pages are copy-on-read: `/site/pages/<route>/index.html` is copied from ASSETS
only when the Think agent first reads or edits it. Copying context does not count
as a remix. The agent can edit:

- `/site/theme.css` for styling;
- `/site/pages/**` for structure and content;
- `/site/fork.js` for behavior.

Workspace writes hot-reload the initiating tab. CSS is sent inline, HTML morphs
the current document, and JS disposes/re-imports. Failed turns restore the last
committed version. Served remixes are private, uncacheable, and noindexed.

## Models

Every prompt uses the same `UserApp extends Think<Env>` agent and tools.
`modelFor(env, auth)` selects exactly one model:

| Sign-in    | Model                           | Billing                      |
| ---------- | ------------------------------- | ---------------------------- |
| none       | `@cf/zai-org/glm-4.7-flash`     | Matt's Workers AI binding    |
| Cloudflare | `@cf/moonshotai/kimi-k2.7-code` | visitor's Cloudflare account |
| ChatGPT    | `gpt-5.5`                       | visitor's ChatGPT plan       |

Cloudflare uses OAuth code + PKCE. ChatGPT uses Codex device auth. Tokens stay in
the fork Durable Object. ChatGPT's zone blocks direct Worker subrequests, so its
Responses stream uses the deployment's private `CodexEgress` Container.

## Main modules

- `src/studio/user-app.ts` — Think agent, workspace, auth state, live preview,
  commit/revert/reset.
- `src/studio/models.ts` — the three model adapters and private Container class.
- `src/studio/auth.ts` / `cookies.ts` — sign-in, refresh and signed grants.
- `src/studio/versions.ts` — content-addressed history and materialization.
- `src/studio/serving.ts` — page overlay and serve-time invariants.
- `src/studio/overlay.ts` / `hotreload.ts` — floating UI and live updates.
- `src/studio/router.ts` / `src/worker.ts` — HTTP routing and asset serving.

## Development

```bash
pnpm preview  # build + full local Worker (remote Workers AI binding)
pnpm check    # build, typecheck, deployment dry-run
pnpm deploy
```

Free usage is capped at ten remixes per fork per day. All providers have the
same workspace capabilities; only model and billing differ.
