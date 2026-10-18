import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  Coins,
  Download,
  Gift,
  Hourglass,
  Percent,
  Pickaxe,
  Scale,
  Share2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CountUp } from "@/components/motion/count-up";
import { Badge } from "@/components/ui/badge";
import { planEconomics } from "@/lib/plan-math";
import { getFxTable } from "@/lib/fx";
import { formatFiat } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  username: string | null;
  email: string | null;
  balance: number | null;
  affiliate_earns: number | null;
  is_admin: boolean | null;
  created_at: string | null;
};
type DepositRow = { user_id: string; amount: number; created_at: string | null };

const num = (v: unknown) => Number(v ?? 0);
const DAY = 86_400_000;
const WINDOW = 14;

function signed(symbol: string, v: number, decimals: number) {
  return `${v < 0 ? "-" : ""}${symbol}${Math.abs(v).toFixed(decimals)}`;
}

// 14-day bars over a bounded scale. The daily numbers are also printed as text,
// so the shape is a readout, not the only place the figure lives.
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

function Readout({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="flex items-center gap-2 text-sm text-slate-300">
        <span className="text-gold-400">{icon}</span>
        {label}
      </span>
      <span className="font-mono flex items-center gap-2 text-sm tabular-nums text-white">{value}</span>
    </div>
  );
}

export default async function AdminHome() {
  const admin = createAdminSupabase();
  let profiles: UserRow[] = [];
  let rigs: Array<{ user_id: string; status: string | null; plan_id: number }> = [];
  let plans: Array<{
    id: number;
    plan_name: string;
    is_default: boolean | null;
    price: number | null;
    point_per_day: number | null;
    duration: number | null;
  }> = [];
  let withdrawals: Array<{ user_id: string; amount: number; status: string | null }> = [];
  let deposits: DepositRow[] = [];
  let pendingInvoices = 0;
  let code = "DOGE";
  let symbol = "Ð";
  let decimals = 8;
  let priceCurrency = "USD";
  let cryptoToPrice = 0;
  let failed = false;
  try {
    const [p, r, pl, w, d, t, s] = await Promise.all([
      admin.from("profiles").select("id,username,email,balance,affiliate_earns,is_admin,created_at"),
      admin.from("user_plan_history").select("user_id,status,plan_id"),
      admin.from("plans").select("id,plan_name,is_default,price,point_per_day,duration"),
      admin.from("user_withdrawal").select("user_id,amount,status"),
      admin.from("user_deposits").select("user_id,amount,created_at"),
      admin.from("transactions_history").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("settings").select("currency_code,currency_symbol,currency_decimals,price_currency").order("id").limit(1).maybeSingle(),
    ]);
    if ([p, r, pl, w, d, t, s].some((x) => (x as { error?: unknown }).error)) failed = true;
    profiles = ((p.data ?? []) as UserRow[]);
    rigs = ((r.data ?? []) as typeof rigs);
    plans = ((pl.data ?? []) as typeof plans);
    withdrawals = ((w.data ?? []) as typeof withdrawals);
    deposits = ((d.data ?? []) as DepositRow[]);
    pendingInvoices = (t.count ?? 0);
    const st = s.data as { currency_code?: string; currency_symbol?: string; currency_decimals?: number; price_currency?: string } | null;
    if (st?.currency_code) code = st.currency_code;
    if (st?.currency_symbol) symbol = st.currency_symbol;
    if (st?.currency_decimals != null) decimals = st.currency_decimals;
    if (st?.price_currency) priceCurrency = st.price_currency.toUpperCase();
    if (priceCurrency !== code.toUpperCase()) {
      const table = await getFxTable(code);
      cryptoToPrice = table?.rates[priceCurrency] ?? 0;
    } else {
      cryptoToPrice = 1;
    }
  } catch {
    failed = true;
  }

  const weekAgo = Date.now() - 7 * DAY;
  const freePlanIds = new Set(plans.filter((p) => p.is_default).map((p) => p.id));
  const totalUsers = profiles.length;
  const within = (iso: string | null, from: number, to = Number.POSITIVE_INFINITY) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= from && t < to;
  };
  const newThisWeek = profiles.filter((u) => within(u.created_at, weekAgo)).length;
  const newPriorWeek = profiles.filter((u) => within(u.created_at, weekAgo - 7 * DAY, weekAgo)).length;
  const weekDelta = newThisWeek - newPriorWeek;
  const activeRigs = rigs.filter((r) => r.status === "active").length;
  const freeGranted = rigs.filter((r) => freePlanIds.has(r.plan_id)).length;
  const accrued = profiles.reduce((s, u) => s + num(u.balance), 0);
  const affiliate = profiles.reduce((s, u) => s + num(u.affiliate_earns), 0);
  const paidOut = withdrawals.filter((w) => (w.status ?? "").toUpperCase() === "SUCCESS").reduce((s, w) => s + num(w.amount), 0);
  const depositsIn = deposits.reduce((s, d) => s + num(d.amount), 0);
  const netFlow = depositsIn - paidOut;

  // Real per-day series, bucketed to local midnight so a day means a calendar day.
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const start = midnight.getTime() - (WINDOW - 1) * DAY;
  const bucket = (iso: string | null) => {
    if (!iso) return -1;
    const t = new Date(iso);
    t.setHours(0, 0, 0, 0);
    return Math.round((t.getTime() - start) / DAY);
  };
  const memberSeries = new Array(WINDOW).fill(0) as number[];
  for (const u of profiles) {
    const i = bucket(u.created_at);
    if (i >= 0 && i < WINDOW) memberSeries[i] += 1;
  }
  const depositSeries = new Array(WINDOW).fill(0) as number[];
  for (const d of deposits) {
    const i = bucket(d.created_at);
    if (i >= 0 && i < WINDOW) depositSeries[i] += num(d.amount);
  }
  const members14 = memberSeries.reduce((a, b) => a + b, 0);
  const deposits14 = depositSeries.reduce((a, b) => a + b, 0);

  const catalogue = plans
    .filter((p) => !p.is_default)
    .map((p) => ({
      p,
      e: planEconomics({ price: p.price ?? 0, point_per_day: p.point_per_day ?? 0, duration: p.duration ?? 0, cryptoToPrice }),
    }));
  const avgMargin = catalogue.length ? catalogue.reduce((s, c) => s + c.e.ownerMarginPct, 0) / catalogue.length : 0;
  const money = (v: number) => `${symbol}${v.toFixed(decimals)}`;
  const priceMoney = (v: number) => formatFiat(v, priceCurrency);
  const signedPrice = (v: number) => `${v < 0 ? "-" : ""}${formatFiat(Math.abs(v), priceCurrency)}`;

  const rigCount = new Map<string, number>();
  for (const r of rigs) if (r.status === "active") rigCount.set(r.user_id, (rigCount.get(r.user_id) ?? 0) + 1);
  const paidByUser = new Map<string, number>();
  for (const w of withdrawals) if ((w.status ?? "").toUpperCase() === "SUCCESS") paidByUser.set(w.user_id, (paidByUser.get(w.user_id) ?? 0) + num(w.amount));
  const depByUser = new Map<string, number>();
  for (const d of deposits) depByUser.set(d.user_id, (depByUser.get(d.user_id) ?? 0) + num(d.amount));

  const members = profiles
    .map((u) => ({
      u,
      rigs: rigCount.get(u.id) ?? 0,
      paid: paidByUser.get(u.id) ?? 0,
      deposited: depByUser.get(u.id) ?? 0,
    }))
    .sort((a, b) => num(b.u.balance) - num(a.u.balance));

  const flowTone = netFlow < 0 ? "text-red-300" : netFlow === 0 ? "text-white" : "text-emerald-300";
  const FlowIcon = netFlow < 0 ? TrendingDown : TrendingUp;
  const flowWord = netFlow < 0 ? "Deficit" : netFlow === 0 ? "Balanced" : "Surplus";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={"Members & rewards"}
        description="Who joined, and what the platform credited back. Net flow is money in minus money out; the readouts carry the running totals."
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel rounded-2xl p-6 ring-1 ring-gold-500/25 lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <ArrowLeftRight size={14} className="text-gold-400" /> Net flow ({code})
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <span className={cn("font-mono text-3xl font-bold tabular-nums sm:text-4xl", flowTone)}>
              {signed(symbol, netFlow, decimals)}
            </span>
            <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", flowTone)}>
              <FlowIcon size={14} /> {flowWord}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Deposits in minus payouts out, all time.</p>
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/5">
            <div className="bg-[#0d1117] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Download size={13} className="text-emerald-400" /> Deposits in
              </div>
              <p className="font-mono mt-1.5 text-lg font-semibold tabular-nums text-emerald-300">{money(depositsIn)}</p>
            </div>
            <div className="bg-[#0d1117] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Wallet size={13} className="text-gold-300" /> Paid out
              </div>
              <p className="font-mono mt-1.5 text-lg font-semibold tabular-nums text-white">{money(paidOut)}</p>
            </div>
          </div>
        </div>

        <div className="panel rounded-2xl p-6">
          <h2 className="font-display text-sm font-semibold text-white">Last {WINDOW} days</h2>
          <div className="mt-4 space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">New members</span>
                <span className="font-mono tabular-nums text-slate-200">{members14}</span>
              </div>
              <div className="mt-2">
                <Bars values={memberSeries} accent="bg-gold-500" label={`New members per day, last ${WINDOW} days`} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Deposits</span>
                <span className="font-mono tabular-nums text-slate-200">{money(deposits14)}</span>
              </div>
              <div className="mt-2">
                <Bars values={depositSeries} accent="bg-emerald-500" label={`Deposits per day, last ${WINDOW} days`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="panel rounded-2xl px-5 py-2">
        <div className="divide-y divide-white/5">
          <Readout icon={<Users size={15} />} label="Total members" value={<CountUp value={totalUsers} />} />
          <Readout
            icon={<UserPlus size={15} />}
            label="New this week"
            value={
              <>
                <CountUp value={newThisWeek} />
                {weekDelta !== 0 && (
                  <span className={cn("text-xs font-normal", weekDelta > 0 ? "text-emerald-300" : "text-red-300")}>
                    {weekDelta > 0 ? "+" : ""}
                    {weekDelta} vs last week
                  </span>
                )}
              </>
            }
          />
          <Readout icon={<Pickaxe size={15} />} label="Active rigs" value={<CountUp value={activeRigs} />} />
          <Readout icon={<Gift size={15} />} label="Free miners granted" value={<CountUp value={freeGranted} />} />
          <Readout icon={<Coins size={15} />} label={`Accrued to members (${code})`} value={money(accrued)} />
          <Readout icon={<Share2 size={15} />} label={`Affiliate earnings (${code})`} value={money(affiliate)} />
          <Readout icon={<Hourglass size={15} />} label="Pending invoices" value={<CountUp value={pendingInvoices} />} />
        </div>
      </section>

      <section className="panel overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-lg font-bold text-white">Owner economics</h2>
          <p className="mt-1 text-xs text-slate-400">Money in versus money out, plus the margin each active plan sells at.</p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
          <div className="bg-[#0d1117] p-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Scale size={14} className="text-gold-400" /> Gross margin ({code})
            </div>
            <p className={cn("font-mono mt-2 flex items-center gap-1.5 text-xl font-semibold tabular-nums", flowTone)}>
              <FlowIcon size={14} /> {signed(symbol, netFlow, decimals)}
            </p>
          </div>
          <div className="bg-[#0d1117] p-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Wallet size={14} className="text-gold-400" /> Member balances held ({code})
            </div>
            <p className="font-mono mt-2 text-xl font-semibold tabular-nums text-gold-300">{money(accrued)}</p>
          </div>
          <div className="bg-[#0d1117] p-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Percent size={14} className="text-gold-400" /> Avg plan margin
            </div>
            <p className="font-mono mt-2 text-xl font-semibold tabular-nums text-emerald-300">{avgMargin.toFixed(1)}%</p>
          </div>
          <div className="bg-[#0d1117] p-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Coins size={14} className="text-gold-400" /> Plans selling
            </div>
            <p className="font-mono mt-2 text-xl font-semibold tabular-nums text-white">{catalogue.length}</p>
          </div>
        </div>
        {catalogue.length > 0 && (
          <div className="overflow-x-auto px-6 py-2 text-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-3 pr-4 font-medium">Plan</th>
                  <th className="py-3 pr-4 font-medium">Price</th>
                  <th className="py-3 pr-4 font-medium">Pays out</th>
                  <th className="py-3 pr-4 font-medium">Profit/sale</th>
                  <th className="py-3 pr-4 font-medium">Margin</th>
                  <th className="py-3 pr-4 font-medium">Member ROI</th>
                </tr>
              </thead>
              <tbody>
                {catalogue.map(({ p, e }) => (
                  <tr key={p.id} className="border-t border-white/5 transition-colors hover:bg-white/[0.03]">
                    <td className="py-3 pr-4 font-medium text-white">{p.plan_name}</td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">{priceMoney(p.price ?? 0)}</td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-slate-300">{money(e.payoutToUser)}</td>
                    <td className={cn("font-mono py-3 pr-4 tabular-nums", e.ownerProfit < 0 ? "text-red-300" : "text-emerald-300")}>
                      <span className="inline-flex items-center gap-1">
                        {e.ownerProfit < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                        {signedPrice(e.ownerProfit)}
                      </span>
                    </td>
                    <td className={cn("font-mono py-3 pr-4 tabular-nums", e.ownerMarginPct < 0 ? "text-red-300" : "text-emerald-300")}>
                      {e.ownerMarginPct < 0 ? "" : "+"}
                      {e.ownerMarginPct.toFixed(1)}%
                    </td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-slate-300">
                      {e.userRoiPct >= 0 ? "+" : ""}
                      {e.userRoiPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">What each member received</h2>
            <p className="mt-1 text-xs text-slate-400">Sorted by accrued balance, highest first.</p>
          </div>
          <Link href="/admin/users" className="text-xs font-semibold text-gold-300 hover:text-gold-200">
            All members
          </Link>
        </div>
        {members.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={22} className="mx-auto text-slate-400" />
            <p className="mt-3 text-sm text-slate-200">No members yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Accounts appear here after the first signup, and each one is issued a free rig automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto px-6 py-2 text-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-3 pr-4 font-medium">Member</th>
                  <th className="py-3 pr-4 font-medium">Joined</th>
                  <th className="py-3 pr-4 font-medium">Rigs</th>
                  <th className="py-3 pr-4 font-medium">Accrued</th>
                  <th className="py-3 pr-4 font-medium">Paid out</th>
                  <th className="py-3 pr-4 font-medium">Affiliate</th>
                  <th className="py-3 pr-4 font-medium">Deposited</th>
                </tr>
              </thead>
              <tbody>
                {members.slice(0, 25).map((m) => (
                  <tr key={m.u.id} className="border-t border-white/5 transition-colors hover:bg-white/[0.03]">
                    <td className="py-3 pr-4">
                      <span className="font-medium text-white">{m.u.username ?? "unknown"}</span>
                      {m.u.is_admin && (
                        <Badge variant="gold" className="ml-2">
                          admin
                        </Badge>
                      )}
                      <span className="block text-xs text-slate-400">{m.u.email ?? ""}</span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {m.u.created_at ? new Date(m.u.created_at).toLocaleDateString() : ""}
                    </td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">{m.rigs}</td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-emerald-300">{num(m.u.balance).toFixed(decimals)}</td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">{m.paid.toFixed(decimals)}</td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">{num(m.u.affiliate_earns).toFixed(decimals)}</td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">{m.deposited.toFixed(decimals)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
