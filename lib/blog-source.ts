import "server-only";

export type BlogSource = "sheets" | "legacy" | "wordpress";

export function blogSource(): BlogSource {
  const source = process.env.BLOG_SOURCE?.trim() || "sheets";
  if (source !== "sheets" && source !== "legacy" && source !== "wordpress") {
    throw new Error("BLOG_SOURCE_INVALID");
  }
  return source;
}

export function wordpressUrl(): string {
  const configured = process.env.WORDPRESS_URL?.trim();
  if (!configured) throw new Error("WORDPRESS_NOT_CONFIGURED");
  const url = new URL(configured);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" || process.env.WORDPRESS_ALLOW_LOCAL_HTTP === "true") && url.protocol === "http:") {
    throw new Error("WORDPRESS_HTTPS_REQUIRED");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("WORDPRESS_URL_INVALID");
  }
  return configured.replace(/\/+$/u, "");
}

export function assertLegacyBlogWrites(): void {
  if (blogSource() !== "sheets") throw new Error("LEGACY_BLOG_WRITES_DISABLED");
}
