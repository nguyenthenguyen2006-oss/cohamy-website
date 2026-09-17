import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdminSession } from "@/lib/admin-session";
import { ADMIN_ROBOTS } from "@/lib/search-engine-policy";
import { blogSource, wordpressUrl } from "@/lib/blog-source";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị | Cohamy",
  robots: ADMIN_ROBOTS,
};

export default async function AdminLoginPage() {
  if (blogSource() === "wordpress") redirect(`${wordpressUrl()}/wp-admin/`);
  if (await getAdminSession()) redirect("/admin");

  return (
    <main className="grid min-h-[100dvh] bg-slate-950 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/products/cohamy-gift-jar-collection.jpg"
          alt=""
          fill
          priority
          className="object-cover opacity-70"
          sizes="55vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 max-w-2xl p-12 text-slate-50">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            Cohamy Content Studio
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Quản lý bài viết và SEO trong một nơi.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">
            Soạn nội dung, lên lịch xuất bản và theo dõi chất lượng metadata
            cho toàn bộ 5 ngôn ngữ.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-slate-50 px-5 py-12 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] sm:p-9">
          <Image
            src="/images/logo/cohamy-logo.png"
            alt="Cohamy"
            width={154}
            height={56}
            className="h-12 w-auto object-contain"
          />
          <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-950">
            Chào mừng trở lại
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Đăng nhập bằng tài khoản quản trị được cấu hình trên máy chủ.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
