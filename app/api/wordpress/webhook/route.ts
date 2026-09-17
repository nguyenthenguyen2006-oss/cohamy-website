import { revalidatePath } from "next/cache";
import { invalidateBlogCache } from "@/lib/blog-repository";
import { blogSource } from "@/lib/blog-source";
import { reserveWebhook, verifyWebhook, webhookSchema } from "@/lib/wordpress-webhook";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.WORDPRESS_WEBHOOK_SECRET || "";
  if (blogSource() !== "wordpress" || secret.length < 32) return Response.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 1024 * 1024) return new Response(null, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 1024 * 1024) return new Response(null, { status: 413 });
  if (!verifyWebhook(body, request.headers.get("x-cohamy-timestamp"), request.headers.get("x-cohamy-signature"), secret)) return Response.json({ error: "INVALID_SIGNATURE_OR_TIMESTAMP" }, { status: 401 });
  let event;
  try { event = webhookSchema.parse(JSON.parse(body)); }
  catch { return Response.json({ error: "INVALID_EVENT" }, { status: 400 }); }
  let reservation: Awaited<ReturnType<typeof reserveWebhook>> = null;
  try {
    reservation = await reserveWebhook(event.event_id);
    if (!reservation) return Response.json({ error: "REPLAY_REJECTED" }, { status: 409 });
    invalidateBlogCache();
    // next-intl rewrites public Vietnamese paths to these actual route destinations.
    revalidatePath("/[locale]/blog/[slug]", "page");
    revalidatePath("/[locale]/blog", "page");
    revalidatePath("/[locale]/pages/[slug]", "page");
    revalidatePath("/[locale]/noi-dung/[slug]", "page");
    revalidatePath("/[locale]", "page");
    revalidatePath("/sitemap.xml");
    revalidatePath("/sitemaps/[name]", "page");
    await reservation.complete();
    console.info("[wordpress-webhook]", event.event_id, event.revision, event.post_ids);
    return Response.json({ accepted: true, event_id: event.event_id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (reservation) await reservation.release();
    console.error("[wordpress-webhook] invalidation failed", error);
    return Response.json({ error: "INVALIDATION_FAILED" }, { status: 503 });
  }
}
