import Link from "next/link";
import { ArrowLeft, BadgeCheck, Coins, ShieldCheck, Timer } from "lucide-react";
import { getCachedSettings } from "@/lib/catalog";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMoneyCfg } from "@/lib/currency";
import { formatFiat } from "@/lib/money";
import { planEconomics } from "@/lib/plan-math";
import { availableCoins, availableCoinsForPrice } from "@/lib/cryptapi";
import { formatCrypto } from "@/lib/utils";
import { PurchaseButton } from "@/components/purchase-button";
import { paidLadder, type LadderPlan } from "@/lib/ladder";

export const dynamic = "force-dynamic";

function PlanComparison({
  plans,
  currentId,
  cryptoToPrice,
  priceCurrency,
  code,
  decimals,
}: {
  plans: LadderPlan[];
  currentId: number;
  cryptoToPrice: number;
  priceCurrency: string;
  code: string;
  decimals: number;
}) {
  const rows = paidLadder(plans, cryptoToPrice);
  if (rows.length < 2) return null;
  return (
    <div className="mt-5 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
      <h2 className="font-display text-base font-bold text-white">Compare every tier</h2>
      <p className="mt-1 text-xs text-slate-400">
        Same rate and terms for every plan. Totals use today&apos;s {code} rate and are not a guarantee.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="py-2 pr-3 font-medium">Plan</th>
              <th className="py-2 pr-3 font-medium">Price</th>
              <th className="py-2 pr-3 font-medium">Term</th>
              <th className="py-2 pr-3 font-medium">Per day</th>
              <th className="py-2 pr-3 font-medium">Total back</th>
              <th className="py-2 font-medium">Return</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={row.id === currentId ? "border-t border-white/10 bg-gold-500/[0.06] text-white" : "border-t border-white/10 text-slate-300"}
              >
                <td className="py-2 pr-3 font-semibold">{row.plan_name}</td>
                <td className="font-mono py-2 pr-3">{formatFiat(row.price, priceCurrency)}</td>
                <td className="py-2 pr-3">{row.duration} days</td>
                <td className="font-mono py-2 pr-3">{formatCrypto(Number(row.point_per_day ?? 0), decimals)} {code}</td>
                <td className="font-mono py-2 pr-3">{formatCrypto(row.totalReturn, decimals)} {code}</td>
                <td className="font-mono py-2 text-emerald-300">+{row.roiPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
  const supabase = createServerSupabase();
  const [s, cfg, auth, plans] = await Promise.all([
    getCachedSettings(),
    getMoneyCfg(),
    supabase.auth.getUser().catch(() => ({ data: { user: null } })),
    Promise.all([
      supabase.from("plans").select("*").eq("id", Number(planId)).maybeSingle(),
      supabase
        .from("plans")
        .select("id,plan_name,price,point_per_day,duration")
        .gt("price", 0)
        .order("price"),
    ]),
  ]);
  let plan: PurchasePlan | null = null;
  let ladderPlans: LadderPlan[] = [];
  let firstPurchaseEligible = false;
  try {
    const [{ data }, { data: ladder }] = plans;
    plan = (data as PurchasePlan | null) ?? null;
    ladderPlans = (ladder ?? []) as LadderPlan[];

    const user = auth.data.user;
    if (user) {
      const { count } = await supabase
        .from("transactions_history")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "paid");
      firstPurchaseEligible = (count ?? 0) === 0;
    }
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

  const listPrice = Number(plan.price);
  const discountPct = Math.max(0, Number(s.first_purchase_discount_percent ?? 0));
  const discount =
    firstPurchaseEligible && discountPct > 0
      ? Math.min(listPrice, Number(((listPrice * discountPct) / 100).toFixed(2)))
      : 0;
  const price = Number((listPrice - discount).toFixed(2));
  const daily = Number(plan.point_per_day ?? 0);
  const duration = Number(plan.duration);
  const free = price <= 0;
  const configuredCoins = availableCoins(s.pay_coins, s);
  const coins = free ? [] : await availableCoinsForPrice(s.pay_coins, s, price, s.price_currency);
  const hiddenForMinimum = Math.max(0, configuredCoins.length - coins.length);
  const usdtListed = s.pay_coins
    .toUpperCase()
    .split(",")
    .map((coin) => coin.trim())
    .includes("USDT");
  const usdtConfigured = Boolean(s.cryptapi_usdt_trc20_address?.trim());
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
              <p className="text-[11px] font-medium text-slate-400">Starter access</p>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-300">Paid reward plan</p>
          <h1 className="font-display mt-2 text-3xl font-bold text-white">{plan.plan_name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {plan.version ? `${plan.version} · ` : ""}Starts after your payment is confirmed.
          </p>

          {discount > 0 && (
            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                First plan offer
              </p>
              <p className="mt-1 text-sm text-slate-200">
                {discountPct.toFixed(0)}% off your first paid plan: pay{" "}
                <span className="font-semibold text-white">{formatFiat(price, s.price_currency)}</span>{" "}
                instead of{" "}
                <span className="line-through text-slate-400">{formatFiat(listPrice, s.price_currency)}</span>.
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Applies once per account, on the first confirmed paid plan.
              </p>
            </div>
          )}

          <div className="mt-6 grid gap-3 text-center sm:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-medium text-slate-400">One-time price</p>
              <p className="font-display mt-1 text-base font-bold text-white">
                {formatFiat(price, s.price_currency)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Set in {s.price_currency}
                {cfg.mode === "fiat" && cfg.fiatCurrency !== s.price_currency
                  ? ` · ≈${formatFiat(price * cfg.priceToDisplay, cfg.fiatCurrency)}`
                  : ""}
              </p>
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

          {(() => {
            const ladder = paidLadder(ladderPlans, cfg.cryptoToPrice);
            const currentIndex = ladder.findIndex((row) => row.id === plan.id);
            const next = currentIndex >= 0 ? ladder[currentIndex + 1] : null;
            if (!next) return null;
            return (
              <div className="mt-5 rounded-2xl border border-gold-500/20 bg-gold-500/[0.05] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-300">
                  Considering the next tier
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">
                  <span className="font-semibold text-white">{next.plan_name}</span> costs{" "}
                  {formatFiat(next.price, s.price_currency)} and returns{" "}
                  <span className="font-mono text-emerald-300">
                    {formatFiat(next.totalReturn, s.price_currency)}
                  </span>{" "}
                  over {next.duration} days (+{next.roiPct.toFixed(1)}%).
                </p>
                <Link
                  href={`/purchase/${next.id}`}
                  className="mt-2 inline-block text-xs font-semibold text-gold-300 hover:text-gold-400"
                >
                  Compare {next.plan_name}
                </Link>
              </div>
            );
          })()}

          <PlanComparison
            plans={ladderPlans}
            currentId={plan.id}
            cryptoToPrice={cfg.cryptoToPrice}
            priceCurrency={s.price_currency}
            code={s.currency_code}
            decimals={s.currency_decimals}
          />

          <div className="mt-5 space-y-3 rounded-2xl bg-white/[0.03] p-5 text-sm ring-1 ring-white/10">
            <p className="flex items-center gap-2 text-slate-300">
              <Coins size={15} className="text-gold-300" /> Choose the coin you already hold.
            </p>
            <p className="flex items-center gap-2 text-slate-300">
              <Timer size={15} className="text-gold-400" /> The next screen shows the exact amount and
              a 20-minute payment window.
            </p>
            <p className="flex items-center gap-2 text-slate-300">
              <BadgeCheck size={15} className="text-emerald-400" /> The plan activates automatically
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
            {usdtListed && !coins.some((coin) => coin.code === "USDT") && (
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                {usdtConfigured
                  ? "USDT TRC20 has a network minimum above this plan's price, so it is hidden for this plan. Choose another coin."
                  : "USDT TRC20 needs a separate receiving address and is temporarily unavailable."}
              </p>
            )}
            {hiddenForMinimum > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Some coins are hidden because this plan is below their network minimum. Choose one
                of the coins shown above.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

