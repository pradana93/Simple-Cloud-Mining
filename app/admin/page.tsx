import { CreditCard, Hourglass, Package, TrendingDown, TrendingUp, Users } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function Tile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="panel card-hover rounded-3xl p-6">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <span className={accent}>{icon}</span> {label}
      </div>
      <p className="font-mono mt-2 truncate text-2xl font-medium tabular-nums text-white sm:text-3xl">{value}</p>
    </div>
  );
}

export default async function AdminHome() {
  let stats = { users: 0, plans: 0, deposits: 0, withdrawals: 0, pendingTx: 0 };
  try {
    const admin = createAdminSupabase();
    const [u, p, d, w, t] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("plans").select("id", { count: "exact", head: true }),
      admin.from("user_deposits").select("amount").limit(5000),
      admin.from("user_withdrawal").select("amount").limit(5000),
      admin.from("transactions_history").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    const sum = (rows: unknown) =>
      ((rows ?? []) as Array<{ amount: number }>).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    stats = {
      users: (u as { count: number | null }).count ?? 0,
      plans: (p as { count: number | null }).count ?? 0,
      deposits: sum((d as { data: unknown }).data),
      withdrawals: sum((w as { data: unknown }).data),
      pendingTx: (t as { count: number | null }).count ?? 0,
    };
  } catch {
    // No service key during build; show zeros.
  }
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-white">Fleet overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tile icon={<Users size={15} />} label="Miners" value={String(stats.users)} accent="text-gold-400" />
        <Tile icon={<Package size={15} />} label="Plans live" value={String(stats.plans)} accent="text-gold-300" />
        <Tile icon={<Hourglass size={15} />} label="Pending invoices" value={String(stats.pendingTx)} accent="text-gold-300" />
        <Tile icon={<TrendingUp size={15} />} label="Deposits in" value={stats.deposits.toFixed(4)} accent="text-emerald-400" />
        <Tile icon={<TrendingDown size={15} />} label="Withdrawals out" value={stats.withdrawals.toFixed(4)} accent="text-red-400" />
        <Tile icon={<CreditCard size={15} />} label="Net flow" value={(stats.deposits - stats.withdrawals).toFixed(4)} accent="text-gold-300" />
      </div>
    </div>
  );
}
