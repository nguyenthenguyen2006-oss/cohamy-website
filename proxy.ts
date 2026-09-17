import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse, NextRequest } from "next/server";
import { blogSource, wordpressUrl } from "./lib/blog-source";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const intl = createMiddleware(routing);
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Old locale middleware sent CRM links to /vi/crm/...; recover those bookmarks.
  if (/^\/(vi|en|zh|ko|ja)\/(crm|portal)(?:\/|$)/u.test(pathname)) {
    const target = new URL(pathname.replace(/^\/(vi|en|zh|ko|ja)/u, ''), process.env.NEXT_PUBLIC_SITE_URL || request.url);
    target.search = request.nextUrl.search;
    const response = NextResponse.redirect(target, 307);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }
  const article = pathname.match(/^\/(vi|en|zh|ko|ja)\/(bai-viet|blog|noi-dung|pages)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/u);
  const usesWordPressContent = Boolean(article) || /^\/(?:(?:vi|en|zh|ko|ja)(?:\/(?:bai-viet|blog))?|bai-viet|blog)?\/?$/u.test(pathname);
  const isPage = article && ["noi-dung", "pages"].includes(article[2]);
  let origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://cohamy.vn";
  const host = request.headers.get("host") || "";
  if (process.env.WORDPRESS_ALLOW_LOCAL_HTTP === "true" && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/iu.test(host)) origin = `http://${host}`;
  if (blogSource() === "wordpress") {
    try {
      const response = await fetch(`${wordpressUrl()}/wp-json/cohamy/v1/redirect?path=${encodeURIComponent(pathname)}`, {cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error("CMS_UNAVAILABLE");
      const {rule} = z.object({rule:z.object({target:z.string(),code:z.coerce.number().pipe(z.union([z.literal(301),z.literal(302),z.literal(307),z.literal(308),z.literal(410)]))}).nullable()}).parse(await response.json());
      if (rule) {
        if (rule.code === 410) return new NextResponse("Nội dung đã được gỡ.",{status:410,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex"}});
        if (!/^\/(?!\/)/u.test(rule.target) || rule.target === pathname) throw new Error("INVALID_REDIRECT");
        const result=NextResponse.redirect(new URL(rule.target,origin),rule.code); result.headers.set("Cache-Control","no-store"); return result;
      }
    } catch {
      // A CMS error must fail closed on CMS-controlled routes, without hiding static product/contact pages.
      if (usesWordPressContent) return new NextResponse("Nguồn nội dung tạm thời không kết nối được.",{status:503,headers:{"Retry-After":"30","Cache-Control":"no-store","X-Robots-Tag":"noindex"}});
    }
  }
  if (blogSource() === "wordpress" && isPage && article && article[2] !== (article[1] === "vi" ? "noi-dung" : "pages")) {
    const result=NextResponse.redirect(new URL(`/${article[1]}/${article[1] === "vi" ? "noi-dung" : "pages"}/${article[3]}`,origin),301); result.headers.set("Cache-Control","no-store"); return result;
  }
  if (blogSource() === "wordpress" && article && article[2] === (isPage ? (article[1] === "vi" ? "noi-dung" : "pages") : (article[1] === "vi" ? "bai-viet" : "blog"))) {
    try {
      const response = await fetch(`${wordpressUrl()}/wp-json/cohamy/v1/resolve?locale=${article[1]}&slug=${article[3]}&type=${isPage ? "page" : "post"}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("CMS_UNAVAILABLE");
      const result = await response.json() as { to?: string; exists?: boolean };
      if (result.to) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(result.to) || result.to === article[3]) throw new Error("INVALID_REDIRECT");
        // Proxy requires an absolute URL. Production uses the configured public host, never Next's internal localhost.
        const redirect = NextResponse.redirect(new URL(`/${article[1]}/${article[2]}/${result.to}`, origin), 301);
        redirect.headers.set("Cache-Control", "no-store");
        return redirect;
      }
    } catch {
      return new NextResponse("Nguồn bài viết tạm thời không kết nối được. Vui lòng thử lại sau.", { status: 503, headers: { "Retry-After": "30", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
    }
  }
  const forwarded=new Headers(request.headers);
  // Always replace a client-supplied value. No query, IP, cookie or referrer is logged.
  forwarded.set("x-cohamy-public-path",pathname);
  forwarded.set("x-cohamy-request-time",String(Math.floor(Date.now()/1000)));
  forwarded.set("x-cohamy-request-id",randomUUID());
  return intl(new NextRequest(request,{headers:forwarded}));
}

export const config = {
  matcher:
    "/((?!crm(?:/|$)|portal(?:/|$)|admin(?:/|$)|api(?:/|$)|preview(?:/|$)|uploads(?:/|$)|_next(?:/|$)|_vercel(?:/|$)|.*\\..*).*)",
};
