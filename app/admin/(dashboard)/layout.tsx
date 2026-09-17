import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdminPage } from "@/lib/admin-auth";
import { ADMIN_ROBOTS } from "@/lib/search-engine-policy";

export const metadata: Metadata = {
  title: {
    default: "Quản trị nội dung | Cohamy",
    template: "%s | Cohamy Admin",
  },
  robots: ADMIN_ROBOTS,
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const username = await requireAdminPage();
  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-950">
      <AdminSidebar username={username} />
      <main className="min-w-0 px-4 pb-12 pt-20 sm:px-6 lg:ml-64 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
