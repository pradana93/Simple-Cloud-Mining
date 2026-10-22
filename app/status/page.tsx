import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCachedSettings } from "@/lib/catalog";

export const revalidate = 30;

type Snapshot = {
  accrualAt: string | null;
  activeRigs: number;
  pendingWithdrawals: number;
  lastPayoutAt: string | null;
  healthy: boolean;
};

async function snapshot(): Promise<Snapshot> {
  try {
    const db = createAdminSupabase();
    const [accrual, rigs, pending, payout] = await Promise.all([
      db.from("user_plan_history").select("last_sum").order("last_sum", { ascending: false }).limit(1).maybeSingle(),
      db.from("user_plan_history").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.from("user_withdrawal").select("id", { count: "exact", head: true }).in("status", ["PENDING", "PROCESSING"]),
      db.from("user_withdrawal").select("date_paid").eq("status", "SUCCESS").order("date_paid", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const accrualAt = (accrual.data as { last_sum: string | null } | null)?.last_sum ?? null;
    const lastPayoutAt = (payout.data as { date_paid: string | null } | null)?.date_paid ?? null;
    const fresh = accrualAt ? Date.now() - new Date(accrualAt).getTime() < 10 * 60 * 1000 : false;
    return {
      accrualAt,
      activeRigs: rigs.count ?? 0,
      pendingWithdrawals: pending.count ?? 0,
      lastPayoutAt,
      healthy: fresh,
    };
  } catch {
    return {
      accrualAt: null,
      activeRigs: 0,
      pendingWithdrawals: 0,
      lastPayoutAt: null,
      healthy: false,
    };
  }
}

function when(value: string | null): string {
  if (!value) return "No data yet";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return new Date(value).toLocaleDateString();
}

export default async function StatusPage() {
  const [data, settings] = await Promise.all([snapshot(), getCachedSettings()]);
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10 sm:py-14">
      <div>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Status</h1>
        <p className="mt-2 text-sm text-slate-400">
          Public operational summary for {settings.sitename}. No account details are shown.
        </p>
      </div>

      <div className={`panel rounded-3xl p-6 ${data.healthy ? "border-emerald-500/30" : "border-amber-500/30"}`}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Accrual engine</p>
        <p className={`font-display mt-1 text-2xl font-bold ${data.healthy ? "text-emerald-300" : "text-amber-300"}`}>
          {data.healthy ? "Operating normally" : "Delayed"}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Last credit posted {when(data.accrualAt)}. A delay here means balances may not have updated
          recently; it does not change the plan rate.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel rounded-2xl p-5">
          <p className="text-[11px] font-medium text-slate-400">Active plans</p>
          <p className="font-mono mt-1 text-2xl tabular-nums text-white">{data.activeRigs}</p>
        </div>
        <div className="panel rounded-2xl p-5">
          <p className="text-[11px] font-medium text-slate-400">Payout queue</p>
          <p className="font-mono mt-1 text-2xl tabular-nums text-white">{data.pendingWithdrawals}</p>
          <p className="mt-1 text-[11px] text-slate-500">pending or processing</p>
        </div>
        <div className="panel rounded-2xl p-5">
          <p className="text-[11px] font-medium text-slate-400">Last completed payout</p>
          <p className="mt-1 text-sm font-semibold text-slate-200">{when(data.lastPayoutAt)}</p>
        </div>
      </div>

      <div className="panel rounded-3xl p-6 text-xs leading-relaxed text-slate-400">
        <p>
          Withdrawals are reviewed and paid by hand. A queue above zero is normal and is not a
          failure. For a specific payment, open the invoice or contact support with the transaction id.
        </p>
        <p className="mt-2">
          This page refreshes every 30 seconds. It is a summary, not a guarantee of future uptime.
        </p>
      </div>
    </div>
  );
}
