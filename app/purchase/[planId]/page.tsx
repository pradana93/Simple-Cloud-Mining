import Link from "next/link";
import { ArrowLeft, BadgeCheck, Coins, Timer } from "lucide-react";
import { getCachedSettings } from "@/lib/catalog";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMoneyCfg } from "@/lib/currency";
import { formatMoney, formatPrice } from "@/lib/money";
import { coinOptions } from "@/lib/checkout";
import { PurchaseButton } from "@/components/purchase-button";

export const dynamic = "force-dynamic";

export default async function PurchasePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const s = await getCachedSettings();
  const cfg = await getMoneyCfg();
  type PurchasePlan = { id: number; plan_name: string; price: number; version: string | null; point_per_day: number | null; duration: number };
  let plan: PurchasePlan | null = null;
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("plans").select("*").eq("id", Number(planId)).maybeSingle();
    plan = (data as PurchasePlan | null) ?? null;
  } catch {
    plan = null;
  }
  if (!plan) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center sm:py-16">
        <h1 className="font-display text-2xl font-bold text-white">Plan not found</h1>
        <Link href="/#plans" className="mt-4 inline-block text-sm font-semibold text-gold-300">← Back to plans</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-14">
      <Link href="/dashboard" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-gold-300">
        <ArrowLeft size={15} /> Back to console
      </Link>
      <div className="panel rounded-3xl p-7 sm:p-9">
        <h1 className="font-display text-3xl font-bold text-white">{plan.plan_name}</h1>
        <p className="mt-1 text-sm text-slate-400">{plan.version ?? ""} · {plan.duration}-day contract</p>
        <div className="mt-6 grid gap-3 text-center sm:grid-cols-3">
          {[
            ["Price", formatPrice(Number(plan.price), cfg)],
            ["Daily yield", `+${formatMoney(Number(plan.point_per_day ?? 0), cfg)}`],
            ["Duration", `${plan.duration} days`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-medium text-slate-400">{k}</p>
              <p className="font-display mt-1 break-words text-sm font-bold text-white sm:text-base">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2.5 rounded-2xl bg-white/[0.03] p-5 text-sm ring-1 ring-white/10">
          <p className="flex items-center gap-2 text-slate-300"><Coins size={15} className="text-gold-300" /> {s.coin_mode === "api" ? "Pick the coin you hold, credited" : "Pay with any coin CoinPayments accepts, credited"} in {s.currency_code}</p>
          <p className="flex items-center gap-2 text-slate-300"><BadgeCheck size={15} className="text-emerald-400" /> Miner activates automatically after CoinPayments confirms</p>
          <p className="flex items-center gap-2 text-slate-300"><Timer size={15} className="text-gold-400" /> Mode: {s.coin_mode === "api" ? "instant invoice" : "hosted gateway"}</p>
          <p className="border-t border-white/10 pt-2.5 text-xs text-slate-400">
            The plan is priced in {s.price_currency} and billed at checkout. CoinPayments converts it, so you can settle in the coin you hold.
          </p>
        </div>
        <div className="mt-6">
          <PurchaseButton planId={Number(planId)} coins={s.coin_mode === "api" ? coinOptions(s.pay_coins) : []} />
        </div>
      </div>
    </div>
  );
}
