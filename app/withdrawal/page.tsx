import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCachedSettings } from "@/lib/catalog";
import { totalMiningRate } from "@/lib/mining";
import { accrueOwnPlans, type AccrualRow } from "@/lib/accrue-user";
import { WithdrawConsole, type MemberWithdrawal } from "@/components/withdraw/withdraw-console";
import { AllowlistManager } from "@/components/withdraw/allowlist-manager";
import type { AllowlistEntry } from "@/lib/allowlist";

export const dynamic = "force-dynamic";

type PlanRef = { earning_rate: number | null };

function planOf(row: AccrualRow): PlanRef | null {
  return Array.isArray(row.plan) ? row.plan[0] : row.plan;
}

export default async function WithdrawalPage() {
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
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gold-500/15 text-gold-300">
          <Wallet size={28} />
        </span>
        <h1 className="font-display mt-6 text-3xl font-bold text-white">Sign in to cash out</h1>
        <p className="mt-3 text-slate-400">Payout requests are tied to your mining balance.</p>
        <div className="mt-7 flex justify-center gap-3">
          <Link href="/login" className="tap inline-flex h-11 items-center rounded-xl bg-gold-500 px-6 font-display text-sm font-bold text-ink-950 hover:bg-gold-400">
            Sign in
          </Link>
          <Link href="/dashboard" className="tap panel inline-flex h-11 items-center rounded-xl px-6 font-display text-sm font-semibold text-white hover:border-gold-500/40">
            Back to console
          </Link>
        </div>
      </div>
    );
  }

  const s = await getCachedSettings();
  let stored = 0;
  let withdrawals: MemberWithdrawal[] = [];
  let activePlans: AccrualRow[] = [];
  let allowlist: AllowlistEntry[] = [];
  try {
    const [p, w, a, l] = await Promise.all([
      supabase.from("profiles").select("balance").eq("id", userId).maybeSingle(),
      supabase
        .from("user_withdrawal")
        .select("id,amount,status,tx,address,created_at,date_paid")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("user_plan_history")
        .select("id,expire_date,last_sum,created_at,plan:plans(earning_rate)")
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("withdrawal_allowlist")
        .select("id,label,currency,address,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);
    stored = Number((p.data as { balance: number } | null)?.balance ?? 0);
    withdrawals = ((w.data ?? []) as MemberWithdrawal[]);
    activePlans = ((a.data ?? []) as AccrualRow[]);
    allowlist = ((l.data ?? []) as AllowlistEntry[]);
  } catch {
    // render with an empty balance and no history
  }

  const { pending } = await accrueOwnPlans(userId, { rows: activePlans });
  const rate = totalMiningRate(activePlans.map((r) => ({ earning_rate: planOf(r)?.earning_rate ?? null })));
  const balance = stored + pending;
  const defaultAddress = withdrawals.find((w) => w.address)?.address ?? "";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="pt-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-gold-300">
          <ArrowLeft size={15} /> Back to console
        </Link>
        <h1 className="font-display mt-4 text-3xl font-bold text-white sm:text-4xl">Withdraw earnings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Cash out to your own wallet. Requests are reviewed by hand before payout.
        </p>
      </div>
      <WithdrawConsole
        balance={balance}
        rate={rate}
        decimals={s.currency_decimals}
        symbol={s.currency_symbol}
        code={s.currency_code}
        network={s.currency_name}
        min={Number(s.min_withdraw)}
        max={Number(s.max_withdraw)}
        defaultAddress={defaultAddress}
        withdrawals={withdrawals}
        allowlist={allowlist}
      />
      <AllowlistManager entries={allowlist} code={s.currency_code} />
    </div>
  );
}
