// Copy-on-write serving for forked visitors.
//
// Pages come from ASSETS by default; the fork's workspace shadows individual
// paths the agent has edited. Whichever HTML is served, ONE serve-time
// HTMLRewriter pass enforces the invariants — theme injection, widget
// survival, hashed-CSS href rebase, noindex — so nothing depends on what any
// model wrote.

import { appOverlay } from "./overlay";

export interface ServedPage {
  source: "fork" | "assets";
  /** Fork-served page HTML (present when source is "fork"). */
  html?: string;
  /** Committed theme CSS; empty string = original site. */
  css: string;
  /** Cache-busting version for /remix-assets/fork.js, when the fork has one. */
  forkJsVersion?: string;
}

/** Normalize a route or pathname to its canonical ".../index.html" form. */
export function normalizeRoute(pathname: string): string {
  let p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (!p.endsWith(".html")) {
    if (!p.endsWith("/")) p += "/";
    p += "index.html";
  }
  return p;
}

// Fork-served pages carry markup snapshotted at fork time, so their single
// content-hashed stylesheet href (/_astro/_slug_.<hash>.css) can go stale on
// a redeploy. Discover the current build's href from ASSETS' /index.html,
// cached per isolate and keyed by its ETag.
let stylesheetHrefCache: { etag: string | null; href: string | null } | undefined;

async function currentStylesheetHref(assets: Fetcher): Promise<string | null> {
  try {
    const res = await assets.fetch(new Request("https://assets.local/index.html"));
    const etag = res.headers.get("etag");
    if (stylesheetHrefCache && stylesheetHrefCache.etag === etag) {
      await res.body?.cancel();
      return stylesheetHrefCache.href;
    }
    const html = await res.text();
    const match = html.match(/href="(\/_astro\/[^"]+\.css)"/);
    stylesheetHrefCache = { etag, href: match ? match[1] : null };
    return stylesheetHrefCache.href;
  } catch {
    return null;
  }
}

/**
 * The serve-time invariants pass. Runs over every HTML response served to a
 * forked visitor (fork-sourced or assets-sourced with a theme):
 *   - injects <style id="remix-theme"> after the site's own CSS;
 *   - injects the fork.js module (cache-busted) when the fork has one;
 * and additionally on fork-served (agent-edited) pages:
 *   - re-appends the remix widget (idempotent: the IIFE guards
 *     window.__remixMounted), so the agent deleting it can't strand a visitor;
 *   - rebases the content-hashed stylesheet href to the current build's;
 *   - forces noindex and marks the page as remixed.
 */
export async function applyInvariants(
  res: Response,
  served: ServedPage,
  assets: Fetcher,
): Promise<Response> {
  // The CSS goes inside a <style> tag; make sure it can't close it early.
  const safeCss = served.css.replace(/<\/style/gi, "");
  let rewriter = new HTMLRewriter();

  if (safeCss.trim()) {
    rewriter = rewriter.on("head", {
      element(el) {
        el.append(`<style id="remix-theme">${safeCss}</style>`, { html: true });
      },
    });
  }
  if (served.forkJsVersion) {
    const v = encodeURIComponent(served.forkJsVersion);
    rewriter = rewriter.on("body", {
      element(el) {
        el.append(`<script type="module" src="/remix-assets/fork.js?v=${v}"></script>`, {
          html: true,
        });
      },
    });
  }

  if (served.source === "fork") {
    rewriter = rewriter
      .on('meta[name="robots"]', {
        element(el) {
          el.setAttribute("content", "noindex, nofollow");
        },
      })
      .on("head", {
        element(el) {
          el.append('<meta name="robots" content="noindex, nofollow">', { html: true });
          el.append('<meta name="remixed" content="true">', { html: true });
        },
      })
      .on("body", {
        element(el) {
          el.append(appOverlay(), { html: true });
        },
      });
    const href = await currentStylesheetHref(assets);
    if (href) {
      rewriter = rewriter.on('link[rel="stylesheet"]', {
        element(el) {
          const current = el.getAttribute("href");
          if (current && /^\/_astro\/[^"]+\.css$/.test(current) && current !== href) {
            el.setAttribute("href", href);
          }
        },
      });
    }
  }

  return rewriter.transform(res);
}
