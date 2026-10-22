import { requireAdmin } from "@/lib/auth";
import AdminNav from "@/components/admin-nav";
import { AdminMfaProvider } from "@/components/admin/admin-mfa";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <AdminMfaProvider>
      <div className="grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
        <AdminNav />
        <section className="min-w-0">{children}</section>
      </div>
    </AdminMfaProvider>
  );
}
