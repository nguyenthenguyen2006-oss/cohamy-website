import { headers } from "next/headers";
import Link from "next/link";
import { createHmac } from "node:crypto";
import { blogSource, wordpressUrl } from "@/lib/blog-source";

export default async function NotFound() {
  const h=await headers();const path=h.get("x-cohamy-public-path");const timestamp=h.get("x-cohamy-request-time");const requestId=h.get("x-cohamy-request-id");
  const secret=process.env.WORDPRESS_WEBHOOK_SECRET;
  if(blogSource()==="wordpress" && secret && path && timestamp && requestId && /^\/(?!\/)/u.test(path) && path.length<=2000) {
    const body=JSON.stringify({path,request_id:requestId});
    await fetch(`${wordpressUrl()}/wp-json/cohamy/v1/not-found`,{method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(2000),headers:{"Content-Type":"application/json","X-Cohamy-Timestamp":timestamp,"X-Cohamy-Signature":createHmac("sha256",secret).update(timestamp+"."+body).digest("hex")},body}).catch(()=>undefined);
  }
  return <main className="mx-auto max-w-2xl px-6 py-24 text-center"><p className="text-sm">404</p><h1 className="mt-4 font-serif text-4xl">Trang không tồn tại</h1><p className="mt-4">Liên kết có thể đã thay đổi hoặc nội dung đã được gỡ.</p><Link className="btn-primary mt-8 inline-flex" href="/">Về Cohamy</Link></main>;
}
