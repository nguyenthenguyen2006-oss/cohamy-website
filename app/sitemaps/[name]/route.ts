import siteSitemap from "@/lib/site-sitemap";
import { getAllPublicPosts } from "@/lib/blog-repository";
import { buildBlogSitemapEntries } from "@/lib/blog-seo";
import { blogSource } from "@/lib/blog-source";
import { wordpressSitemapShard, xmlEscape, xmlResponse, sitemapUnavailable } from "@/lib/wordpress-sitemap";
export const dynamic = "force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{name:string}>}) {
  const {name}=await params;
  try {
    let items:{url:string;modified:string}[];
    if(name==="static.xml") items=(await siteSitemap()).map(item=>({url:item.url,modified:item.lastModified ? new Date(item.lastModified).toISOString() : ""}));
    else if(name==="legacy.xml" && blogSource()!=="wordpress") items=buildBlogSitemapEntries(await getAllPublicPosts()).map(item=>({url:item.url,modified:new Date(item.lastModified!).toISOString()}));
    else if(/^content-\d+\.xml$/u.test(name) && blogSource()==="wordpress") { const shard=await wordpressSitemapShard(Number(name.slice(8,-4))); if(!shard) return new Response("Không tìm thấy sitemap.",{status:404}); items=shard.items; }
    else return new Response("Không tìm thấy sitemap.",{status:404});
    return xmlResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+items.map(item=>`<url><loc>${xmlEscape(item.url)}</loc>${item.modified?`<lastmod>${xmlEscape(item.modified)}</lastmod>`:""}</url>`).join("")+"</urlset>");
  } catch { return sitemapUnavailable(); }
}
