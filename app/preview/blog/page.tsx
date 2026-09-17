import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getWordPressPreview } from "@/lib/wordpress-blog";
import { BlogArticle } from "@/components/BlogArticle";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getProductById } from "@/lib/products";
import { WordPressPageContent } from "@/components/WordPressPageContent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Xem trước bài viết | Cohamy", robots: { index: false, follow: false }, alternates: { canonical: null, languages: {} } };
export default async function WordPressPreviewPage() {
  const token = (await cookies()).get("cohamy_wp_preview")?.value;
  if (!token) notFound();
  let post;
  try { post = await getWordPressPreview(token); }
  catch { notFound(); }
  const messages = await getMessages({ locale: post.locale });
  return <NextIntlClientProvider locale={post.locale} messages={messages}>
    <Header />
    <div role="status" className="bg-amber-50 border-b border-amber-200 px-6 py-4 text-center text-sm">Xem trước nội bộ • {post.status} • Phiên hết hạn sau tối đa 5 phút. Lưu bài trước khi xem.</div>
    {post.content_type === "page" ? <WordPressPageContent post={post}/> : <BlogArticle post={post} locale={post.locale} featuredProduct={getProductById(post.related_product_ids[0] || "")} />}
    <Footer />
  </NextIntlClientProvider>;
}
