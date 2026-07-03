/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

// Wrangler cannot infer deployed secret names from wrangler.jsonc.
interface Env {
  CF_OAUTH_CLIENT_SECRET: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
