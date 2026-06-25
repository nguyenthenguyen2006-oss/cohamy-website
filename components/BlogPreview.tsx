"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getFeaturedBlogPosts } from "@/lib/blog";
import { BlogCard } from "@/components/BlogCard";
import { MotionWrapper } from "@/components/MotionWrapper";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";
import { Tilt3D } from "@/components/ui/Tilt3D";
import type { Locale } from "@/lib/types";

interface BlogPreviewProps {
  locale: Locale;
}

export function BlogPreview({ locale }: BlogPreviewProps) {
  const t = useTranslations("home.blog");
  const posts = getFeaturedBlogPosts().slice(0, 3);

  return (
    <section className="relative overflow-hidden bg-[#FFF4D8] py-20">
      <DecorativeOrbs variant="gold" density="light" />
      <div className="relative mx-auto max-w-6xl px-6">
        <MotionWrapper className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="type-display-md">{t("title")}</h2>
            <p className="type-body-lg mt-3 text-[#4A2418]/70">{t("subtitle")}</p>
            <div className="section-divider mt-5 max-w-[100px]" />
          </div>
          <Link
            href="/blog"
            className="btn-3d hidden rounded-full border border-[#4A2418]/15 bg-white/70 px-5 py-2 text-sm text-[#D9A441] backdrop-blur-sm md:block"
          >
            {t("viewAll")} →
          </Link>
        </MotionWrapper>

        <div className="grid gap-6 md:grid-cols-3">
          {posts.map((post, index) => (
            <MotionWrapper key={post.id} delay={index * 0.1} className="h-full">
              <Tilt3D intensity={9} className="h-full">
                <BlogCard post={post} className="h-full shadow-[0_14px_40px_-22px_rgba(42,18,12,0.22)]" />
              </Tilt3D>
            </MotionWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}