import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Receipt } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMoneyCfg } from "@/lib/currency";
import { formatMoney, type MoneyCfg } from "@/lib/money";
import { formatCrypto } from "@/lib/utils";
import { accrueOwnPlans, type AccrualRow } from "@/lib/accrue-user";
import { isTwoFactorEnabled } from "@/lib/two-factor";
import { Badge } from "@/components/ui/badge";
import { TwoFactorPanel } from "@/components/2fa/two-factor-panel";
import { PasswordPanel } from "@/components/account/password-panel";

export const dynamic = "force-dynamic";

type PlanHistoryRow = {
  id: number;
  status: string;
  created_at: string;
  expire_date: string | null;
  last_sum: string | null;
  plan:
    | {
        id: number;
        plan_name: string;
        point_per_day: number | null;
        earning_rate: number | null;
        duration: number;
        price: number;
      }
    | Array<{
        id: number;
        plan_name: string;
        point_per_day: number | null;
        earning_rate: number | null;
        duration: number;
        price: number;
      }>
    | null;
};

function statusVariant(s: string): "green" | "gold" | "red" | "slate" {
  const v = s.toLowerCase();
  if (["paid", "success"].includes(v)) return "green";
  if (["pending", "waiting", "processing"].includes(v)) return "gold";
  if (["canceled", "cancelled"].includes(v)) return "red";
  return "slate";
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 text-sm last:border-0">
      <span className="text-slate-400">{k}</span>
      <span className="text-right font-medium text-slate-100">{v}</span>
    </div>
  );
}

export default async function AccountPage() {
  const supabase = createServerSupabase();
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center sm:py-16">
        <h1 className="font-display text-3xl font-bold text-white">Sign in required</h1>
        <Link href="/login" className="mt-6 inline-flex h-11 items-center rounded-xl bg-gold-500 px-6 font-display text-sm font-bold text-ink-950 transition-colors hover:bg-gold-400">
          Sign in
        </Link>
      </div>
    );
  }
  const empty = { data: [] as Array<Record<string, number | string | null>> };
  let referrals = empty;
  let aff = empty;
  let deposits = empty;
  let withdrawals = empty;
  let pending = empty;
  let accrualRows: Array<AccrualRow & { status?: string }> = [];
  let planHistory: PlanHistoryRow[] = [];
  let cfg: MoneyCfg | null = null;
  let twoFactorOn = false;
  try {
    const [money, tfa, r1, r2, r3, r4, r5, ar] = await Promise.all([
      getMoneyCfg(),
      isTwoFactorEnabled(userId).catch(() => false),
      supabase.from("profiles").select("username,created_at").eq("reference_user_id", userId).order("created_at", { ascending: false }),
      supabase.from("affiliate_history").select("*").eq("user_id", userId).order("date", { ascending: false }),
      supabase.from("user_deposits").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("user_withdrawal").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("transactions_history").select("*").eq("user_id", userId).neq("status", "paid").order("date", { ascending: false }),
      supabase
        .from("user_plan_history")
        .select("id,status,created_at,expire_date,last_sum,plan:plans(id,plan_name,point_per_day,earning_rate,duration,price)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    cfg = money;
    twoFactorOn = tfa;
    referrals = (r1 as typeof empty);
    aff = (r2 as typeof empty);
    deposits = (r3 as typeof empty);
    withdrawals = (r4 as typeof empty);
    pending = (r5 as typeof empty);
    accrualRows = (((ar as { data: unknown }).data ?? []) as Array<AccrualRow & { status?: string }>);
    planHistory = accrualRows as unknown as PlanHistoryRow[];
  } catch {
    // render empty sections
  }
  if (!cfg) cfg = await getMoneyCfg();
  await accrueOwnPlans(userId, { rows: accrualRows.filter((row) => row.status === "active") });

  const sections: Array<{ title: string; rows: Array<Record<string, number | string | null>>; render: (r: Record<string, number | string | null>, i: number) => React.ReactNode; emptyText: string }> = [
    {
      title: `Referrals (${referrals.data.length})`,
      rows: referrals.data,
      emptyText: "No referrals yet. Share your link from the Affiliate page.",
      render: (r, i) => <Row key={i} k={String(r.username)} v={r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : ""} />,
    },
    {
      title: "Affiliate earnings",
      rows: aff.data,
      emptyText: "No affiliate earnings yet.",
      render: (r, i) => (
        <Row key={i} k={formatMoney(Number(r.amount), cfg)} v={<Badge variant={statusVariant(String(r.status ?? ""))}>{String(r.status)}</Badge>} />
      ),
    },
    {
      title: "Plan purchases",
      rows: deposits.data,
      emptyText: "No plan purchases yet.",
      render: (r, i) => (
        <Row key={i} k={formatMoney(Number(r.amount), cfg)} v={<Badge variant={statusVariant(String(r.status ?? ""))}>{String(r.status)}</Badge>} />
      ),
    },
    {
      title: "Withdrawals",
      rows: withdrawals.data,
      emptyText: "No withdrawals yet.",
      render: (r, i) => (
        <Row key={i} k={formatMoney(Number(r.amount), cfg)} v={<Badge variant={statusVariant(String(r.status ?? ""))}>{String(r.status)}</Badge>} />
      ),
    },
  ];

  return (
    <div className="space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Account history</h1>
        </div>
        <Link href="/dashboard" className="panel inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-slate-200">
          <ArrowLeft size={15} /> Console
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PasswordPanel />
        <TwoFactorPanel enabled={twoFactorOn} />
      </div>

      <div className="panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div>
          <h2 className="font-display text-base font-bold text-white">Casino fairness</h2>
          <p className="mt-1 text-sm text-slate-400">
            Check any settled casino round against the seed that signed it.
          </p>
        </div>
        <Link
          href="/games/verify"
          className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-gold-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          Verify a bet <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((sec) => (
          <div key={sec.title} className="panel rounded-2xl p-5">
            <h2 className="font-display mb-2 text-base font-bold text-white">{sec.title}</h2>
            {sec.rows.length === 0 ? (
              <p className="py-3 text-sm text-slate-400">{sec.emptyText}</p>
            ) : (
              <div>{sec.rows.map(sec.render)}</div>
            )}
          </div>
        ))}
      </div>

      <div className="panel rounded-2xl p-5">
        <h2 className="font-display mb-2 text-base font-bold text-white">Plan payouts</h2>
        <p className="mb-3 text-xs leading-relaxed text-slate-400">
          Each paid plan pays a fixed daily credit until its end date. Expected total is the full
          published payout; it does not change if the crypto price moves.
        </p>
        {planHistory.length === 0 ? (
          <p className="py-3 text-sm text-slate-400">No plans yet.</p>
        ) : (
          planHistory.map((row) => {
            const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
            if (!plan) return null;
            const total = Number(plan.point_per_day ?? 0) * Number(plan.duration);
            return (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2.5 text-sm last:border-0">
                <div>
                  <p className="font-medium text-slate-100">{plan.plan_name}</p>
                  <p className="text-xs text-slate-400">
                    {row.expire_date ? `Ends ${new Date(row.expire_date).toLocaleDateString()}` : "No end date"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-slate-200">
                    {formatCrypto(total, cfg.decimals)} {cfg.code}
                  </p>
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="panel rounded-2xl p-5">
        <h2 className="font-display mb-2 flex items-center gap-2 text-base font-bold text-white">
          <Receipt size={16} className="text-gold-300" /> Open invoices
        </h2>
        {pending.data.length === 0 ? (
          <p className="py-3 text-sm text-slate-400">No open invoices.</p>
        ) : (
          pending.data.map((t) => (
            <div key={String(t.hash)} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2.5 text-sm last:border-0">
              <Link href={`/invoice/${t.hash}`} className="font-mono text-gold-300 hover:text-gold-400">
                {String(t.hash).slice(0, 20)}…
              </Link>
              <span className="text-slate-300">{formatMoney(Number(t.amount), cfg)}</span>
              <Badge variant={statusVariant(String(t.status ?? ""))}>{String(t.status)}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
