import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  FileCheck2,
  FilePlus2,
  FileText,
  SearchX,
} from "lucide-react";
import { getAdminStats } from "@/lib/blog-repository";

const primaryMetrics = [
  { key: "total", label: "Tổng bài", icon: FileText },
  { key: "draft", label: "Bản nháp", icon: FilePlus2 },
  { key: "scheduled", label: "Đặt lịch", icon: CalendarClock },
  { key: "published", label: "Đã đăng", icon: FileCheck2 },
  { key: "archived", label: "Lưu trữ", icon: Archive },
] as const;

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-amber-700">Content Studio</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Tổng quan bài viết
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Theo dõi tiến độ xuất bản và các trường SEO cần bổ sung.
          </p>
        </div>
        <Link href="/admin/posts/new" className="admin-button">
          <FilePlus2 size={18} />
          Tạo bài mới
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {primaryMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.key}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <Icon size={20} className="text-amber-700" />
              <p className="mt-5 text-3xl font-semibold tabular-nums">
                {stats[metric.key]}
              </p>
              <p className="mt-1 text-sm text-slate-600">{metric.label}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold">Chất lượng SEO</h2>
          <p className="mt-1 text-sm text-slate-600">
            Các bài cần hoàn thiện trước lần xuất bản tiếp theo.
          </p>
        </div>
        <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
          {[
            {
              label: "Thiếu SEO title",
              value: stats.missingSeoTitle,
              icon: SearchX,
            },
            {
              label: "Thiếu meta description",
              value: stats.missingSeoDescription,
              icon: AlertTriangle,
            },
            {
              label: "Thiếu alt ảnh",
              value: stats.missingImageAlt,
              icon: FileCheck2,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-white p-6">
                <div className="flex items-center justify-between">
                  <Icon size={20} className="text-slate-500" />
                  <span className="text-2xl font-semibold tabular-nums">
                    {item.value}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600">{item.label}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
