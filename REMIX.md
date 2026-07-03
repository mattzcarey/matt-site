# Remix

Visitors can create a private remix of the page they are viewing. Each browser
gets a `UserApp` Durable Object containing a Think workspace and
content-addressed version history.

```text
Remix this site → describe a change → UserApp (Think) → GLM-5.2 tools
                → live preview → commit
```

The only model is Workers AI `@cf/zai-org/glm-5.2`. There are no account
sign-ins or third-party credentials.

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

- `src/studio/user-app.ts` — Think agent, workspace, live preview and history.
- `src/studio/models.ts` — GLM-5.2 Workers AI adapter.
- `src/studio/versions.ts` — content-addressed history and materialization.
- `src/studio/serving.ts` — page overlay and serve-time invariants.
- `src/studio/overlay.ts` / `hotreload.ts` — floating UI and live updates.
- `src/studio/router.ts` / `src/worker.ts` — HTTP routing and asset serving.

## Development

```bash
pnpm preview
pnpm check
pnpm deploy
```

Usage is capped at ten changes per fork per day.
