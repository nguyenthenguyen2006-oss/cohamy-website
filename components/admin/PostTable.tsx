"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Copy,
  Eye,
  FilePenLine,
  Globe2,
  RotateCcw,
} from "lucide-react";
import type { BlogRow } from "@/lib/blog-schema";

const statusStyles: Record<BlogRow["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-blue-50 text-blue-800",
  published: "bg-emerald-50 text-emerald-800",
  archived: "bg-amber-50 text-amber-900",
};

export function PostTable({ posts }: { posts: BlogRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function duplicate(id: string) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/posts/${id}/duplicate`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        post?: BlogRow;
        error?: string;
      };
      if (!response.ok || !result.post) {
        setError(result.error || "Không thể nhân bản bài.");
        return;
      }
      router.push(`/admin/posts/${result.post.id}`);
      router.refresh();
    } finally {
      setBusyId("");
    }
  }

  async function archive(id: string) {
    if (!window.confirm("Chuyển bài này vào lưu trữ?")) return;
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/posts/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error || "Không thể lưu trữ bài.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId("");
    }
  }

  async function togglePublished(post: BlogRow) {
    setBusyId(post.id);
    setError("");
    try {
      const nextStatus = post.status === "published" ? "draft" : "published";
      const response = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...post, status: nextStatus }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error || "Không thể đổi trạng thái.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId("");
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="text-lg font-semibold">Chưa có bài phù hợp</p>
        <p className="mt-2 text-sm text-slate-500">
          Thử bỏ bớt bộ lọc hoặc tạo bài viết mới.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[1050px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-5 py-3 font-semibold">Bài viết</th>
              <th className="px-4 py-3 font-semibold">Locale</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 font-semibold">Cập nhật</th>
              <th className="px-5 py-3 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posts.map((post) => {
              const busy = busyId === post.id;
              return (
                <tr key={post.id} className={busy ? "opacity-55" : ""}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      {post.cover_image ? (
                        <Image
                          src={post.cover_image}
                          alt=""
                          width={80}
                          height={56}
                          className="h-14 w-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-20 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <FilePenLine size={20} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/admin/posts/${post.id}`}
                          className="line-clamp-1 font-semibold text-slate-950 hover:text-amber-800"
                        >
                          {post.title}
                        </Link>
                        <p className="mt-1 max-w-lg truncate font-mono text-xs text-slate-500">
                          {post.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs uppercase">
                    {post.locale}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusStyles[post.status]}`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(post.updated_at))}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/posts/${post.id}`}
                        title="Sửa"
                        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      >
                        <FilePenLine size={17} />
                      </Link>
                      <Link
                        href={`/admin/posts/${post.id}/preview`}
                        title="Xem trước"
                        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      >
                        <Eye size={17} />
                      </Link>
                      <button
                        type="button"
                        title="Nhân bản"
                        disabled={busy}
                        onClick={() => void duplicate(post.id)}
                        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      >
                        <Copy size={17} />
                      </button>
                      {post.status !== "archived" ? (
                        <>
                          <button
                            type="button"
                            title={
                              post.status === "published"
                                ? "Hủy xuất bản"
                                : "Đăng ngay"
                            }
                            disabled={busy}
                            onClick={() => void togglePublished(post)}
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                          >
                            {post.status === "published" ? (
                              <RotateCcw size={17} />
                            ) : (
                              <Globe2 size={17} />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Lưu trữ"
                            disabled={busy}
                            onClick={() => void archive(post.id)}
                            className="rounded-lg p-2 text-slate-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Archive size={17} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
