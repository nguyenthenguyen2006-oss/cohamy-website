import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyWebhook } from "@/lib/wordpress-webhook";
import { analyzeRankMath } from "@/lib/rank-math-engine.mjs";
export const runtime = "nodejs";
const schema=z.object({rank_math_version:z.string(),base_url:z.url(),url:z.url(),post_type:z.enum(["post","page"]),locale:z.string().regex(/^[a-z]{2}_[A-Z]{2}$/u),title:z.string().max(1000),description:z.string().max(2000),slug:z.string().max(180),content_html:z.string().max(1000000),keywords:z.array(z.string().max(200)).max(10),keyword_is_new:z.array(z.boolean()).max(10),thumbnail:z.string(),thumbnail_alt:z.string(),schemas:z.record(z.string(),z.unknown()),nofollow_external:z.boolean(),nofollow_domains:z.array(z.string()),nofollow_exclusions:z.array(z.string())});
export async function POST(request:Request) {
  const raw=await request.text(); if(raw.length>1200000) return NextResponse.json({error:"REQUEST_TOO_LARGE"},{status:413});
  if(!verifyWebhook(raw,request.headers.get("X-Cohamy-Timestamp"),request.headers.get("X-Cohamy-Signature"),process.env.WORDPRESS_WEBHOOK_SECRET || "")) return NextResponse.json({error:"SIGNATURE_REJECTED"},{status:401});
  try { const parsed=schema.parse(JSON.parse(raw)); if(parsed.keywords.length!==parsed.keyword_is_new.length) return NextResponse.json({error:"KEYWORD_CONTRACT_INVALID"},{status:400}); return NextResponse.json(await analyzeRankMath(parsed)); }
  catch(error) { console.error("[rank-math-analysis]",String(error)); return NextResponse.json({error: String(error)},{status:422}); }
}
