import { z } from "zod";
import { bridgeRequest } from "@/lib/wordpress-blog";
import { blogSource } from "@/lib/blog-source";
export const dynamic = "force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{indexnowKey:string}>}) {
  const {indexnowKey}=await params;
  if(blogSource()!=="wordpress" || !/^[a-zA-Z0-9-]{8,128}\.txt$/u.test(indexnowKey)) return new Response("Không tìm thấy.",{status:404});
  try { const data=z.object({key:z.string(),host:z.string()}).parse(await bridgeRequest("/indexnow-key")); if(!data.key || indexnowKey!==data.key+".txt") return new Response("Không tìm thấy.",{status:404}); return new Response(data.key,{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-cache"}}); }
  catch { return new Response("Key chưa sẵn sàng.",{status:503}); }
}
