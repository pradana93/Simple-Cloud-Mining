import Link from "next/link";
import { ArrowLeft, BadgeCheck, Coins, Timer } from "lucide-react";
import { getCachedSettings } from "@/lib/catalog";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatCrypto } from "@/lib/utils";
import { PurchaseButton } from "@/components/purchase-button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PurchasePage({ params }: { params: { planId: string } }) {
  const s = await getCachedSettings();
  type PurchasePlan = { id: number; plan_name: string; price: number; version: string | null; point_per_day: number | null; duration: number };
  let plan: PurchasePlan | null = null;
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("plans").select("*").eq("id", Number(params.planId)).maybeSingle();
    plan = (data as PurchasePlan | null) ?? null;
  } catch {
    plan = null;
  }
  if (!plan) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
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
      <div className="glass rounded-3xl p-7 sm:p-9">
        <Badge variant="gold">Order summary</Badge>
        <h1 className="font-display mt-3 text-3xl font-bold text-white">{plan.plan_name}</h1>
        <p className="mt-1 text-sm text-slate-400">{plan.version ?? ""} · {plan.duration}-day contract</p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            ["Price", `${formatCrypto(Number(plan.price), s.currency_decimals)} ${s.currency_code}`],
            ["Daily yield", `+${formatCrypto(Number(plan.point_per_day ?? 0), s.currency_decimals)}`],
            ["Duration", `${plan.duration} days`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{k}</p>
              <p className="font-display mt-1 text-sm font-bold text-white sm:text-base">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2.5 rounded-2xl bg-white/[0.03] p-5 text-sm ring-1 ring-white/10">
          <p className="flex items-center gap-2 text-slate-300"><Coins size={15} className="text-gold-300" /> Pay {s.coin_cur1} → credited {s.coin_cur2}</p>
          <p className="flex items-center gap-2 text-slate-300"><BadgeCheck size={15} className="text-emerald-400" /> Miner activates automatically after CoinPayments confirms</p>
          <p className="flex items-center gap-2 text-slate-300"><Timer size={15} className="text-sky-400" /> Mode: {s.coin_mode === "api" ? "instant invoice" : "hosted gateway"}</p>
        </div>
        <div className="mt-6">
          <PurchaseButton planId={Number(params.planId)} />
        </div>
      </div>
    </div>
  );
}
