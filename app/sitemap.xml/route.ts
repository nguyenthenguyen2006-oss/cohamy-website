import { blogSource } from "@/lib/blog-source";
import { SITE_URL } from "@/lib/seo";
import { wordpressSitemapIndex, xmlEscape, xmlResponse, sitemapUnavailable } from "@/lib/wordpress-sitemap";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const items = [{url:SITE_URL+"/sitemaps/static.xml",modified:""}];
    if(blogSource()==="wordpress") { const index=await wordpressSitemapIndex(); items.push(...index.items.map(item=>({url:SITE_URL+`/sitemaps/content-${item.shard_id}.xml`,modified:item.modified}))); }
    else items.push({url:SITE_URL+"/sitemaps/legacy.xml",modified:""});
    return xmlResponse('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+items.map(item=>`<sitemap><loc>${xmlEscape(item.url)}</loc>${item.modified?`<lastmod>${xmlEscape(item.modified)}</lastmod>`:""}</sitemap>`).join("")+"</sitemapindex>");
  } catch { return sitemapUnavailable(); }
}
