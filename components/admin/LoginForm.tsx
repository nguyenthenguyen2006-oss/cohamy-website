"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, UserRound } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(
          result.error === "TOO_MANY_ATTEMPTS"
            ? "Đã thử sai quá nhiều lần. Vui lòng đợi 10 phút."
            : result.error === "ADMIN_CREDENTIALS_NOT_CONFIGURED"
              ? "Máy chủ chưa cấu hình tài khoản quản trị."
              : "Tên đăng nhập hoặc mật khẩu không đúng.",
        );
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="username" className="admin-label">
          Tên đăng nhập
        </label>
        <div className="relative">
          <UserRound
            aria-hidden
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            className="admin-input pl-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="admin-label">
          Mật khẩu
        </label>
        <div className="relative">
          <LockKeyhole
            aria-hidden
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="admin-input pl-11"
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className="admin-button w-full">
        {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
