export interface BlogRouteEntry {
  id: string;
}

export function blogSlug(post: BlogRouteEntry): string {
  return post.id.replace(/\.(?:md|mdx)$/i, "");
}

export function blogHtmlPath(post: BlogRouteEntry): string {
  return `/blog/${blogSlug(post)}`;
}

export function blogMarkdownPath(post: BlogRouteEntry): string {
  return `${blogHtmlPath(post)}.md`;
}

export function legacyBlogRedirect(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "");

  if (path === "/blog/give-your-agent-a-computer") {
    return "/blog/agent-computer";
  }
  if (
    path === "/blog/give-your-agent-a-computer.md" ||
    path === "/md/blog/give-your-agent-a-computer.md"
  ) {
    return "/blog/agent-computer.md";
  }
  if (pathname.endsWith(".md/") && path.startsWith("/blog/")) {
    return path;
  }

  return null;
}
