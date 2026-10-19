import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMoneyCfg } from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import { accrueOwnPlans, type AccrualRow } from "@/lib/accrue-user";
import { isTwoFactorEnabled } from "@/lib/two-factor";
import { Badge } from "@/components/ui/badge";
import { TwoFactorPanel } from "@/components/2fa/two-factor-panel";

export const dynamic = "force-dynamic";

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
  const cfg = await getMoneyCfg();
  const twoFactorOn = await isTwoFactorEnabled(userId);
  const empty = { data: [] as Array<Record<string, number | string | null>> };
  let referrals = empty;
  let aff = empty;
  let deposits = empty;
  let withdrawals = empty;
  let pending = empty;
  let accrualRows: AccrualRow[] = [];
  try {
    const [r1, r2, r3, r4, r5, ar] = await Promise.all([
      supabase.from("profiles").select("username,created_at").eq("reference_user_id", userId).order("created_at", { ascending: false }),
      supabase.from("affiliate_history").select("*").eq("user_id", userId).order("date", { ascending: false }),
      supabase.from("user_deposits").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("user_withdrawal").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("transactions_history").select("*").eq("user_id", userId).neq("status", "paid").order("date", { ascending: false }),
      supabase.from("user_plan_history").select("id,expire_date,last_sum,created_at,plan:plans(earning_rate)").eq("user_id", userId).eq("status", "active"),
    ]);
    referrals = (r1 as typeof empty);
    aff = (r2 as typeof empty);
    deposits = (r3 as typeof empty);
    withdrawals = (r4 as typeof empty);
    pending = (r5 as typeof empty);
    accrualRows = (((ar as { data: unknown }).data ?? []) as AccrualRow[]);
  } catch {
    // render empty sections
  }
  await accrueOwnPlans(userId, { rows: accrualRows });

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
      title: "Deposits",
      rows: deposits.data,
      emptyText: "No deposits yet.",
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

      <TwoFactorPanel enabled={twoFactorOn} />

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
