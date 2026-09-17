import { verifyWebhook } from "@/lib/wordpress-webhook";
import { performance } from "node:perf_hooks";
export const runtime="nodejs";
export async function GET(request:Request) {
  if(!verifyWebhook("",request.headers.get("X-Cohamy-Timestamp"),request.headers.get("X-Cohamy-Signature"),process.env.WORDPRESS_WEBHOOK_SECRET || ""))return Response.json({error:"SIGNATURE_REJECTED"},{status:401});
  const memory=process.memoryUsage(); const usage=performance.eventLoopUtilization();
  const ready=memory.heapUsed<768*1024*1024 && usage.utilization<0.85;
  return Response.json({ready,reason:ready?"ready":"memory_or_event_loop_pressure",heap_mb:Math.round(memory.heapUsed/1024/1024),event_loop_utilization:usage.utilization},{status:ready?200:503,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex"}});
}
