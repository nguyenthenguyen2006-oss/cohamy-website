"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminDashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-amber-300/25 bg-[#171717] p-8 text-slate-100">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400/10 text-amber-300">
        <AlertTriangle size={22} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">
        Không tải được dữ liệu quản trị
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
        Hãy kiểm tra cấu hình Google Sheets, quyền Editor của service account
        và kết nối mạng máy chủ, sau đó thử tải lại.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 hover:bg-amber-300"
      >
        <RefreshCw size={16} />
        Thử lại
      </button>
    </section>
  );
}
