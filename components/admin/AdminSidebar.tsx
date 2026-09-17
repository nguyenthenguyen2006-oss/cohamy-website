"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Download,
  FilePlus2,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { downloadBlogCsvTemplate } from "@/components/admin/ImportCsvDialog";

const links = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/posts", label: "Bài viết", icon: Files },
  { href: "/admin/posts/new", label: "Tạo bài mới", icon: FilePlus2 },
];

export function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const navigation = (
    <>
      <div className="flex h-20 items-center justify-between border-b border-slate-800 px-5">
        <Image
          src="/images/logo/cohamy-logo.png"
          alt="Cohamy"
          width={130}
          height={44}
          className="h-10 w-auto rounded-md bg-white object-contain px-2"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Đóng menu"
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Quản trị">
        {links.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-amber-300 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            downloadBlogCsvTemplate();
            setOpen(false);
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <Download size={18} strokeWidth={1.8} />
          Tải CSV mẫu
        </button>
      </nav>
      <div className="border-t border-slate-800 p-4">
        <p className="truncate px-2 text-xs text-slate-400">Đăng nhập bởi</p>
        <p className="truncate px-2 text-sm font-medium text-slate-100">
          {username}
        </p>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <LogOut size={18} strokeWidth={1.8} />
          {loggingOut ? "Đang thoát..." : "Đăng xuất"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở menu"
        className="fixed left-4 top-4 z-30 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 shadow-sm lg:hidden"
      >
        <Menu size={20} />
      </button>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-slate-950 lg:flex">
        {navigation}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col bg-slate-950">
            {navigation}
          </aside>
        </div>
      ) : null}
    </>
  );
}
