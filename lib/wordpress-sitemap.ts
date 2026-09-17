import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { bridgeRequest, WordPressError, WORDPRESS_BLOG_TAG } from "@/lib/wordpress-blog";
import { wordpressUrl } from "@/lib/blog-source";
export const sitemapIndexSchema = z.object({revision:z.string().uuid(),items:z.array(z.object({shard_id:z.coerce.number().int().nonnegative(),revision:z.string().uuid(),modified:z.string().datetime(),count:z.coerce.number().int().min(1).max(5000)}))});
const shardSchema = z.object({revision:z.string().uuid(),items:z.array(z.object({url:z.url(),modified:z.string().datetime()})).max(5000)});
export async function wordpressSitemapIndex() { return sitemapIndexSchema.parse(await bridgeRequest("/sitemaps")); }
const cachedShard = unstable_cache(async (base:string,id:number,revision:string) => {
  const data = shardSchema.parse(await bridgeRequest(`/sitemaps?shard=${id}&revision=${revision}`,undefined,base));
  if (data.revision !== revision) throw new WordPressError("WORDPRESS_REVISION_CHANGED",409); return data;
}, ["cohamy-sitemap-shard"], {tags:[WORDPRESS_BLOG_TAG],revalidate:300});
export async function wordpressSitemapShard(id:number) {
  for(let attempt=0;attempt<3;attempt++) {
    const index = await wordpressSitemapIndex(); const entry = index.items.find(item=>item.shard_id===id); if(!entry) return undefined;
    try { return await cachedShard(wordpressUrl(),id,entry.revision); } catch(error) { if(!(error instanceof WordPressError) || error.status!==409) throw error; }
  }
  throw new WordPressError("WORDPRESS_SITEMAP_BUSY",503);
}
export function xmlEscape(input:string):string { return input.replace(/[<>&"']/gu,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"})[c]!); }
export function xmlResponse(body:string) {
  if(Buffer.byteLength(body,"utf8")>50*1024*1024) throw new Error("SITEMAP_XML_LIMIT_EXCEEDED");
  return new Response(body,{headers:{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"no-cache, max-age=0"}});
}
export function sitemapUnavailable() { return new Response("Nguồn sitemap tạm thời không kết nối được.",{status:503,headers:{"Retry-After":"30","Cache-Control":"no-store","X-Robots-Tag":"noindex"}}); }
