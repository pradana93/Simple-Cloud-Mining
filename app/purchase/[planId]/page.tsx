import Link from "next/link";
import { ArrowLeft, BadgeCheck, Coins, ShieldCheck, Timer } from "lucide-react";
import { getCachedSettings } from "@/lib/catalog";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMoneyCfg } from "@/lib/currency";
import { formatFiat, formatPrice } from "@/lib/money";
import { planEconomics } from "@/lib/plan-math";
import { availableCoins } from "@/lib/cryptapi";
import { formatCrypto } from "@/lib/utils";
import { PurchaseButton } from "@/components/purchase-button";

export const dynamic = "force-dynamic";

type PurchasePlan = {
  id: number;
  plan_name: string;
  price: number;
  version: string | null;
  point_per_day: number | null;
  duration: number;
};

export default async function PurchasePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const s = await getCachedSettings();
  const cfg = await getMoneyCfg();
  const coins = availableCoins(s.pay_coins, s);
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
        <Link href="/#plans" className="mt-4 inline-block text-sm font-semibold text-gold-300">
          Back to plans
        </Link>
      </div>
    );
  }

  const price = Number(plan.price);
  const daily = Number(plan.point_per_day ?? 0);
  const duration = Number(plan.duration);
  const free = price <= 0;
  const econ = planEconomics({
    price,
    point_per_day: daily,
    duration,
    cryptoToPrice: cfg.cryptoToPrice,
  });
  const fiatHint = (value: number) =>
    cfg.mode === "fiat" && cfg.rate > 0 ? `≈${formatFiat(value * cfg.rate, cfg.fiatCurrency)}` : null;
  const crypto = (value: number) =>
    `${formatCrypto(value, s.currency_decimals).replace(/\.?0+$/, "")} ${s.currency_code}`;

  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-14">
      <Link
        href="/#plans"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-gold-300"
      >
        <ArrowLeft size={15} /> Back to plans
      </Link>

      {free ? (
        <div className="panel rounded-3xl p-7 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-300">Starter plan</p>
          <h1 className="font-display mt-2 text-3xl font-bold text-white">{plan.plan_name}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            This plan is free. No payment, card, or wallet connection is needed. It activates when
            you create an account.
          </p>
          <div className="mt-6 grid gap-3 text-center sm:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-medium text-slate-400">Price</p>
              <p className="font-display mt-1 text-base font-bold text-white">Free</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-medium text-slate-400">Daily credit</p>
              <p className="font-display mt-1 text-base font-bold text-emerald-300">
                +{crypto(daily)}
              </p>
              {fiatHint(daily) && <p className="mt-1 text-xs text-slate-400">{fiatHint(daily)}</p>}
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-medium text-slate-400">Plan term</p>
              <p className="font-display mt-1 text-base font-bold text-white">{duration} days</p>
            </div>
          </div>
          <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-400">
            The {duration}-day term is how long the free starter plan stays active. It is not a paid
            contract. Paid plans are optional and only change the daily credit and term.
          </p>
          <Link
            href="/register"
            className="tap mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 font-display text-base font-bold text-ink-950 hover:bg-gold-400"
          >
            Create free account
          </Link>
        </div>
      ) : (
        <div className="panel rounded-3xl p-7 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-300">Paid hashrate plan</p>
          <h1 className="font-display mt-2 text-3xl font-bold text-white">{plan.plan_name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {plan.version ? `${plan.version} · ` : ""}Starts after your payment is confirmed.
          </p>

          <div className="mt-6 grid gap-3 text-center sm:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-medium text-slate-400">One-time price</p>
              <p className="font-display mt-1 text-base font-bold text-white">
                {formatPrice(price, cfg)}
              </p>
              <p className="mt-1 text-xs text-slate-400">Set in {s.price_currency}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-medium text-slate-400">Daily credit</p>
              <p className="font-display mt-1 text-base font-bold text-emerald-300">
                +{crypto(daily)}
              </p>
              {fiatHint(daily) && <p className="mt-1 text-xs text-slate-400">{fiatHint(daily)}</p>}
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-medium text-slate-400">Plan term</p>
              <p className="font-display mt-1 text-base font-bold text-white">{duration} days</p>
              <p className="mt-1 text-xs text-slate-400">Fixed daily rate</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-gold-500/20 bg-gold-500/[0.05] p-5">
            <h2 className="font-display text-base font-bold text-white">What you pay, what you get</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
              <li>
                You pay{" "}
                <span className="font-semibold text-white">{formatFiat(price, s.price_currency)}</span>{" "}
                in the coin you choose.
              </li>
              <li>
                You receive{" "}
                <span className="font-semibold text-white">{crypto(daily)}</span> per day for{" "}
                {duration} days.
              </li>
              <li>
                Projected total:{" "}
                <span className="font-semibold text-white">{crypto(econ.payoutToUser)}</span>. This
                is the plan&apos;s published rate, not a market prediction or a guarantee.
              </li>
            </ul>
          </div>

          <div className="mt-5 space-y-3 rounded-2xl bg-white/[0.03] p-5 text-sm ring-1 ring-white/10">
            <p className="flex items-center gap-2 text-slate-300">
              <Coins size={15} className="text-gold-300" /> Choose the coin you already hold.
            </p>
            <p className="flex items-center gap-2 text-slate-300">
              <Timer size={15} className="text-gold-400" /> The next screen shows the exact amount and
              a 20-minute payment window.
            </p>
            <p className="flex items-center gap-2 text-slate-300">
              <BadgeCheck size={15} className="text-emerald-400" /> The miner activates automatically
              after the network confirms your payment.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-100">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-amber-300" />
              Send only the selected coin on the correct network. Do not send from an exchange that
              deducts a fee. Underpayments are not credited. We never ask for your wallet private key.
            </p>
          </div>

          <div className="mt-6">
            {coins.length > 0 ? (
              <PurchaseButton planId={Number(planId)} coins={coins} />
            ) : (
              <p className="rounded-2xl bg-white/[0.03] p-4 text-sm text-slate-400 ring-1 ring-white/10">
                Checkout is temporarily unavailable.{" "}
                <Link href="/contact" className="font-semibold text-gold-300">
                  Contact support
                </Link>
                .
              </p>
            )}
            {!coins.some((coin) => coin.code === "USDT") &&
              s.pay_coins
                .toUpperCase()
                .split(",")
                .map((coin) => coin.trim())
                .includes("USDT") && (
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  USDT TRC20 needs a separate receiving address and is temporarily unavailable.
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
