import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  let stats = { users: 0, plans: 0, deposits: 0, withdrawals: 0, pendingTx: 0 };
  try {
    const admin = createAdminSupabase();
    const [u, p, d, w, t] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("plans").select("id", { count: "exact", head: true }),
      admin.from("user_deposits").select("amount"),
      admin.from("user_withdrawal").select("amount"),
      admin.from("transactions_history").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    const sum = (rows: Array<{ amount: number }> | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);
    stats = { users: u.count ?? 0, plans: p.count ?? 0, deposits: sum(d.data), withdrawals: sum(w.data), pendingTx: t.count ?? 0 };
  } catch {
    // missing service key during build — show zeros
  }
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Admin dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Users</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.users}</CardContent></Card>
        <Card><CardHeader><CardTitle>Plans</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.plans}</CardContent></Card>
        <Card><CardHeader><CardTitle>Pending TX</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.pendingTx}</CardContent></Card>
        <Card><CardHeader><CardTitle>Total deposits</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.deposits.toFixed(8)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Total withdrawals</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.withdrawals.toFixed(8)}</CardContent></Card>
      </div>
      <p className="text-sm text-zinc-500">Ported from admin/Home + Statistics_model. Admin writes use the service-role API; protect /admin with your own check (is_admin flag) before production.</p>
    </div>
  );
}
