import Link from "next/link";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { BlogArticle } from "@/components/BlogArticle";
import { getAdminPostById, getRelatedPosts } from "@/lib/blog-repository";
import { getProductById } from "@/lib/products";
import type { Locale } from "@/lib/types";

export default async function AdminPostPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getAdminPostById(id);
  if (!post) notFound();
  const [messages, relatedPosts] = await Promise.all([
    getMessages({ locale: post.locale }),
    getRelatedPosts(post),
  ]);

  return (
    <div className="-mx-4 -mb-12 -mt-20 bg-[#FAF6EF] text-[#2A120C] sm:-mx-6 lg:-mx-8 lg:-mt-8">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
        <p>
          Preview nội bộ: <strong>{post.status}</strong>. URL công khai không
          được mở cho draft hoặc archived.
        </p>
        <Link
          href={`/admin/posts/${post.id}`}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold"
        >
          Quay lại chỉnh sửa
        </Link>
      </div>
      <NextIntlClientProvider locale={post.locale} messages={messages}>
        <BlogArticle
          post={post}
          locale={post.locale as Locale}
          relatedPosts={relatedPosts}
          featuredProduct={
            post.related_product_ids[0]
              ? getProductById(post.related_product_ids[0])
              : undefined
          }
        />
      </NextIntlClientProvider>
    </div>
  );
}
