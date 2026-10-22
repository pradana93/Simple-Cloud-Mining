import {
  AlertTriangle,
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  Percent,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CountUp } from "@/components/motion/count-up";
import { formatFiat } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const WINDOW = 30;

type TxRow = {
  user_id: string | null;
  plan_id: number | null;
  amount: number | null;
  price_amount: number | null;
  status: string | null;
  date: string | null;
};
type PlanRow = { id: number; plan_name: string; price: number | null; is_default: boolean | null };
type ProfileRow = { id: string; created_at: string | null; is_admin: boolean | null };
type WithdrawalRow = { amount: number | null; status: string | null };
type CheckinRow = { day: string | null; amount: number | null };

const num = (v: unknown) => Number(v ?? 0);

function Bars({ values, accent, label }: { values: number[]; accent: string; label: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-14 items-end gap-1" role="img" aria-label={label}>
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm", v === 0 ? "bg-white/5" : accent)}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Stat({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="text-gold-400">{icon}</span>
        {label}
      </div>
      <p className={cn("font-mono mt-2 text-2xl font-semibold tabular-nums", tone ?? "text-white")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default async function AdminAnalytics() {
  const admin = createAdminSupabase();
  let txs: TxRow[] = [];
  let plans: PlanRow[] = [];
  let profiles: ProfileRow[] = [];
  let withdrawals: WithdrawalRow[] = [];
  let checkins: CheckinRow[] = [];
  let priceCurrency = "USD";
  let failed = false;

  try {
    const [t, p, u, w, c, s] = await Promise.all([
      admin.from("transactions_history").select("user_id,plan_id,amount,price_amount,status,date"),
      admin.from("plans").select("id,plan_name,price,is_default"),
      admin.from("profiles").select("id,created_at,is_admin"),
      admin.from("user_withdrawal").select("amount,status"),
      admin.from("checkins").select("day,amount"),
      admin.from("settings").select("price_currency").order("id").limit(1).maybeSingle(),
    ]);
    if ([t, p, u, w, c, s].some((x) => (x as { error?: unknown }).error)) failed = true;
    txs = (t.data ?? []) as TxRow[];
    plans = (p.data ?? []) as PlanRow[];
    profiles = (u.data ?? []) as ProfileRow[];
    withdrawals = (w.data ?? []) as WithdrawalRow[];
    checkins = (c.data ?? []) as CheckinRow[];
    const st = s.data as { price_currency?: string } | null;
    if (st?.price_currency) priceCurrency = st.price_currency.toUpperCase();
  } catch {
    failed = true;
  }

  const price = (v: number) => formatFiat(v, priceCurrency);
  const planName = new Map(plans.map((p) => [p.id, p.plan_name]));

  const paid = txs.filter((t) => (t.status ?? "").toLowerCase() === "paid");
  const priced = paid.filter((t) => t.price_amount != null);
  const unpriced = paid.length - priced.length;
  const revenue = priced.reduce((s, t) => s + num(t.price_amount), 0);
  const pendingCount = txs.filter((t) => (t.status ?? "").toLowerCase() === "pending").length;
  const memberIds = new Set(profiles.filter((p) => !p.is_admin).map((p) => p.id));
  const buyers = new Set(
    paid
      .map((t) => t.user_id)
      .filter((id): id is string => typeof id === "string" && memberIds.has(id))
  ).size;
  const members = memberIds.size;
  const conversion = members > 0 ? (buyers / members) * 100 : 0;
  const arpu = members > 0 ? revenue / members : 0;
  const avgOrder = priced.length > 0 ? revenue / priced.length : 0;

  // Revenue by plan.
  const byPlan = new Map<number, { units: number; revenue: number }>();
  for (const t of priced) {
    const id = t.plan_id ?? -1;
    const entry = byPlan.get(id) ?? { units: 0, revenue: 0 };
    entry.units += 1;
    entry.revenue += num(t.price_amount);
    byPlan.set(id, entry);
  }
  const planRevenue = Array.from(byPlan.entries())
    .map(([id, v]) => ({ id, name: planName.get(id) ?? `Plan ${id}`, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // Signups over the window.
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const start = midnight.getTime() - (WINDOW - 1) * DAY;
  const signupSeries = new Array(WINDOW).fill(0) as number[];
  for (const u of profiles) {
    if (!u.created_at) continue;
    const d = new Date(u.created_at);
    d.setHours(0, 0, 0, 0);
    const i = Math.round((d.getTime() - start) / DAY);
    if (i >= 0 && i < WINDOW) signupSeries[i] += 1;
  }
  const signups30 = signupSeries.reduce((a, b) => a + b, 0);

  // Withdrawal funnel.
  const funnel = new Map<string, { count: number; amount: number }>();
  for (const w of withdrawals) {
    const key = (w.status ?? "unknown").toUpperCase();
    const entry = funnel.get(key) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += num(w.amount);
    funnel.set(key, entry);
  }
  const funnelRows = Array.from(funnel.entries()).sort((a, b) => b[1].amount - a[1].amount);

  // Check-ins.
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAgoIso = new Date(midnight.getTime() - 6 * DAY).toISOString().slice(0, 10);
  const checkinsToday = checkins.filter((c) => c.day === todayIso).length;
  const checkins7 = checkins.filter((c) => (c.day ?? "") >= weekAgoIso).length;
  const checkinPaid = checkins.reduce((s, c) => s + num(c.amount), 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Analytics"
        description="Commerce at a glance: revenue booked, who is paying, and where the money moves. Figures come from stored invoices and payouts."
      />

      {failed && (
        <div className="panel flex items-start gap-3 rounded-2xl border-red-500/30 px-5 py-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-300" />
          <div>
            <p className="text-sm font-medium text-white">Some figures could not be loaded</p>
            <p className="mt-0.5 text-xs text-slate-300">What did load is shown below. Reload to try again.</p>
          </div>
        </div>
      )}

      {unpriced > 0 && (
        <div className="panel flex items-start gap-3 rounded-2xl border-amber-500/30 px-5 py-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-white">{unpriced} paid invoice{unpriced === 1 ? "" : "s"} have no recorded price</p>
            <p className="mt-0.5 text-xs text-slate-300">
              They are excluded from cash collected rather than counted as if the DOGE amount were USD.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<CreditCard size={14} />} label="Cash collected" value={price(revenue)} hint={`${priced.length} priced paid invoice${priced.length === 1 ? "" : "s"}${unpriced > 0 ? `, ${unpriced} unpriced` : ""}`} tone="text-emerald-300" />
        <Stat icon={<Users size={14} />} label="Paying members" value={<CountUp value={buyers} />} hint={`of ${members} member${members === 1 ? "" : "s"}`} />
        <Stat icon={<Percent size={14} />} label="Conversion" value={`${conversion.toFixed(1)}%`} hint="buyers / members" />
        <Stat icon={<TrendingUp size={14} />} label="Avg order" value={price(avgOrder)} hint={`ARPU ${price(arpu)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <section className="panel rounded-2xl p-6 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold text-white">Revenue by plan</h2>
          <p className="mt-1 text-xs text-slate-400">Paid invoices, summed in {priceCurrency}.</p>
          {planRevenue.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">No paid invoices yet. Revenue appears here after the first confirmed payment.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {planRevenue.map((p) => {
                const share = revenue > 0 ? (p.revenue / revenue) * 100 : 0;
                return (
                  <div key={p.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium text-white">{p.name}</span>
                      <span className="font-mono tabular-nums text-slate-200">{price(p.revenue)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-gold-500" style={{ width: `${share}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-slate-400">
                        {p.units} · {share.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel rounded-2xl p-6">
          <h2 className="font-display text-sm font-semibold text-white">Signups, last {WINDOW} days</h2>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">New members</span>
              <span className="font-mono tabular-nums text-slate-200">{signups30}</span>
            </div>
            <div className="mt-2">
              <Bars values={signupSeries} accent="bg-gold-500" label={`Signups per day, last ${WINDOW} days`} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
            <div>
              <p className="text-slate-400">Pending invoices</p>
              <p className="font-mono mt-1 text-lg tabular-nums text-gold-300">{pendingCount}</p>
            </div>
            <div>
              <p className="text-slate-400">Active plans on sale</p>
              <p className="font-mono mt-1 text-lg tabular-nums text-white">{plans.filter((p) => !p.is_default).length}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="panel overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
            <Wallet size={16} className="text-gold-400" />
            <h2 className="font-display text-sm font-semibold text-white">Withdrawal funnel</h2>
          </div>
          {funnelRows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-400">No withdrawal requests yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {funnelRows.map(([status, v]) => (
                <div key={status} className="flex items-center justify-between gap-4 px-6 py-3.5 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <BadgeCheck size={14} className={status === "SUCCESS" ? "text-emerald-400" : status === "CANCELED" ? "text-slate-400" : "text-gold-400"} />
                    <span className="text-slate-200">{status.toLowerCase()}</span>
                    <span className="text-xs text-slate-400">({v.count})</span>
                  </span>
                  <span className="font-mono tabular-nums text-white">{v.amount.toFixed(8)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel rounded-2xl p-6">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CalendarCheck size={14} className="text-gold-400" /> Daily check-ins
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400">Claimed today</p>
              <p className="font-mono mt-1 text-2xl font-semibold tabular-nums text-white">{checkinsToday}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Last 7 days</p>
              <p className="font-mono mt-1 text-2xl font-semibold tabular-nums text-white">{checkins7}</p>
            </div>
          </div>
          <p className="mt-4 border-t border-white/10 pt-4 text-xs text-slate-400">
            Total credited from bonuses: <span className="font-mono tabular-nums text-gold-300">{checkinPaid.toFixed(8)}</span>
          </p>
        </section>
      </div>
    </div>
  );
}
