// Main worker for mattzcarey.com.
//
// The static site (built by Astro into ./dist) is served automatically by the
// Static Assets layer before this worker runs. This worker only handles the
// remix studio routes (/remix + /api/remix/*); anything else that reaches it is
// delegated back to the assets binding (e.g. the 404 page).

import { handleStudio } from "./studio/router";

export { UserApp } from "./studio/user-app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const studio = await handleStudio(request, env);
    if (studio) return studio;
    return env.ASSETS.fetch(request);
  },
};
