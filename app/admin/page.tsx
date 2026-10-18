import {
  ArrowLeftRight,
  Coins,
  Download,
  Gift,
  Hourglass,
  Percent,
  Pickaxe,
  Scale,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { planEconomics } from "@/lib/plan-math";

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

function Tile({
  icon,
  label,
  children,
  accent,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="panel card-hover rounded-3xl border-t-2 border-t-white/10 p-6">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <span className={accent}>{icon}</span> {label}
      </div>
      <p className="font-mono mt-2 truncate text-2xl font-medium tabular-nums text-white sm:text-3xl">
        {children}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const num = (v: unknown) => Number(v ?? 0);

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
  let deposits: Array<{ user_id: string; amount: number }> = [];
  let pendingInvoices = 0;
  let code = "DOGE";
  let symbol = "Ð";
  let decimals = 8;
  try {
    const [p, r, pl, w, d, t, s] = await Promise.all([
      admin.from("profiles").select("id,username,email,balance,affiliate_earns,is_admin,created_at"),
      admin.from("user_plan_history").select("user_id,status,plan_id"),
      admin.from("plans").select("id,plan_name,is_default,price,point_per_day,duration"),
      admin.from("user_withdrawal").select("user_id,amount,status"),
      admin.from("user_deposits").select("user_id,amount"),
      admin.from("transactions_history").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("settings").select("currency_code,currency_symbol,currency_decimals").order("id").limit(1).maybeSingle(),
    ]);
    profiles = (((p as { data: unknown }).data ?? []) as UserRow[]);
    rigs = (((r as { data: unknown }).data ?? []) as typeof rigs);
    plans = (((pl as { data: unknown }).data ?? []) as typeof plans);
    withdrawals = (((w as { data: unknown }).data ?? []) as typeof withdrawals);
    deposits = (((d as { data: unknown }).data ?? []) as typeof deposits);
    pendingInvoices = (t as { count: number | null }).count ?? 0;
    const st = (s as { data: { currency_code?: string; currency_symbol?: string; currency_decimals?: number } | null }).data;
    if (st?.currency_code) code = st.currency_code;
    if (st?.currency_symbol) symbol = st.currency_symbol;
    if (st?.currency_decimals != null) decimals = st.currency_decimals;
  } catch {
    // No service key during build; render zeros.
  }

  const weekAgo = Date.now() - 7 * 86400000;
  const freePlanIds = new Set(plans.filter((p) => p.is_default).map((p) => p.id));
  const totalUsers = profiles.length;
  const newThisWeek = profiles.filter((u) => u.created_at && new Date(u.created_at).getTime() >= weekAgo).length;
  const activeRigs = rigs.filter((r) => r.status === "active").length;
  const freeGranted = rigs.filter((r) => freePlanIds.has(r.plan_id)).length;
  const accrued = profiles.reduce((s, u) => s + num(u.balance), 0);
  const affiliate = profiles.reduce((s, u) => s + num(u.affiliate_earns), 0);
  const paidOut = withdrawals.filter((w) => (w.status ?? "").toUpperCase() === "SUCCESS").reduce((s, w) => s + num(w.amount), 0);
  const depositsIn = deposits.reduce((s, d) => s + num(d.amount), 0);

  const catalogue = plans
    .filter((p) => !p.is_default)
    .map((p) => ({
      p,
      e: planEconomics({ price: p.price ?? 0, point_per_day: p.point_per_day ?? 0, duration: p.duration ?? 0 }),
    }));
  const avgMargin = catalogue.length ? catalogue.reduce((s, c) => s + c.e.ownerMarginPct, 0) / catalogue.length : 0;
  const grossMargin = depositsIn - paidOut;
  const money = (v: number) => `${symbol}${v.toFixed(decimals)}`;

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Members &amp; rewards</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          How many miners joined, and what the platform has credited back to them. Accrued is the
          balance members hold right now; paid out is what has already left the mine.
        </p>
      </div>

      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Tile icon={<Users size={15} />} label="Total members" accent="text-gold-400" hint={`${newThisWeek} joined in the last 7 days`}>
            <CountUp value={totalUsers} />
          </Tile>
          <Tile icon={<Pickaxe size={15} />} label="Active rigs" accent="text-emerald-400" hint="hashing right now">
            <CountUp value={activeRigs} />
          </Tile>
          <Tile icon={<Gift size={15} />} label="Free miners granted" accent="text-gold-300" hint="starter contracts issued">
            <CountUp value={freeGranted} />
          </Tile>
          <Tile icon={<TrendingUp size={15} />} label={`Accrued to members (${code})`} accent="text-emerald-400">
            <CountUp value={accrued} decimals={decimals} />
          </Tile>
          <Tile icon={<Wallet size={15} />} label={`Paid out (${code})`} accent="text-gold-300" hint="settled withdrawals">
            <CountUp value={paidOut} decimals={decimals} />
          </Tile>
          <Tile icon={<Coins size={15} />} label={`Affiliate earnings (${code})`} accent="text-gold-300" hint="commission credited to referrers">
            <CountUp value={affiliate} decimals={decimals} />
          </Tile>
        </div>
      </Reveal>

      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile icon={<UserPlus size={15} />} label="New this week" accent="text-gold-300">
            <CountUp value={newThisWeek} />
          </Tile>
          <Tile icon={<Download size={15} />} label={`Deposits in (${code})`} accent="text-emerald-400">
            <CountUp value={depositsIn} decimals={decimals} />
          </Tile>
          <Tile icon={<ArrowLeftRight size={15} />} label={`Net flow (${code})`} accent="text-gold-300">
            <CountUp value={depositsIn - paidOut} decimals={decimals} />
          </Tile>
          <Tile icon={<Hourglass size={15} />} label="Pending invoices" accent="text-gold-300">
            <CountUp value={pendingInvoices} />
          </Tile>
        </div>
      </Reveal>

      <Reveal>
        <section className="panel overflow-hidden rounded-3xl">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-white">Owner economics</h2>
            <p className="mt-1 text-xs text-slate-400">
              Money in versus money out, plus the margin each active plan sells at.
            </p>
          </div>
          <div className="grid gap-4 border-b border-white/10 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon={<Scale size={15} />} label={`Gross margin (${code})`} accent={grossMargin < 0 ? "text-red-300" : "text-emerald-400"} hint="revenue in − payouts out">
              <CountUp value={grossMargin} decimals={decimals} />
            </Tile>
            <Tile icon={<Wallet size={15} />} label={`Member balances held (${code})`} accent="text-gold-300" hint="outstanding liability">
              <CountUp value={accrued} decimals={decimals} />
            </Tile>
            <Tile icon={<Percent size={15} />} label="Avg plan margin" accent="text-emerald-400" hint="across paid plans">
              {avgMargin.toFixed(1)}%
            </Tile>
            <Tile icon={<Coins size={15} />} label="Plans selling" accent="text-gold-300" hint="paid tiers live">
              {catalogue.length}
            </Tile>
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
                    <tr key={p.id} className="border-t border-white/5">
                      <td className="py-3 pr-4 font-medium text-white">{p.plan_name}</td>
                      <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">
                        {money(p.price ?? 0)}
                      </td>
                      <td className="font-mono py-3 pr-4 tabular-nums text-slate-300">{money(e.payoutToUser)}</td>
                      <td
                        className={
                          "font-mono py-3 pr-4 tabular-nums " +
                          (e.ownerProfit < 0 ? "text-red-300" : "text-emerald-300")
                        }
                      >
                        {money(e.ownerProfit)}
                      </td>
                      <td className="font-mono py-3 pr-4 tabular-nums text-slate-300">{e.ownerMarginPct.toFixed(1)}%</td>
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
      </Reveal>

      <Reveal>
        <section className="panel overflow-hidden rounded-3xl">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-white">What each member received</h2>
            <p className="mt-1 text-xs text-slate-400">Sorted by accrued balance, highest first.</p>
          </div>
          {members.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-400">No members yet. Accounts appear here after signup.</p>
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
                    <tr key={m.u.id} className="border-t border-white/5">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-white">{m.u.username ?? "unknown"}</span>
                        {m.u.is_admin && <span className="ml-2 text-xs text-gold-300">admin</span>}
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
      </Reveal>
    </div>
  );
}
