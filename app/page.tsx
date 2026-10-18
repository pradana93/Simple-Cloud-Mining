import Link from "next/link";
import { Activity } from "lucide-react";
import { getCachedPlans, getCachedPayouts, getCachedSettings, getCachedStats } from "@/lib/catalog";
import { getMoneyCfg } from "@/lib/currency";
import { formatMoney, moneyUnit } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { PlanExplorer } from "@/components/plan-explorer";

export const revalidate = 60;

function Metric({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="min-w-0 border-t-2 border-gold-500/70 pt-3">
      <div className="font-mono break-words text-xl font-medium tabular-nums text-white sm:text-2xl">{children}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}

export default async function HomePage() {
  const [s, plans, stats, payouts] = await Promise.all([
    getCachedSettings(),
    getCachedPlans(),
    getCachedStats(),
    getCachedPayouts(),
  ]);
  const cfg = await getMoneyCfg();

  return (
    <div className="space-y-20 py-10 sm:py-14">
      <section className="pt-2">
        <div className="max-w-3xl">
          <Reveal>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Mine <span className="gold-text">{s.currency_name}</span> from a console, not a
              warehouse.
            </h1>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              {s.siteslogan}. Buy a hashrate plan, watch it accrue, and withdraw on-chain. No
              hardware to host or maintain.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/register"
                className="tap cta-glow inline-flex h-12 items-center rounded-xl bg-gold-500 px-7 font-display text-base font-bold text-ink-950 hover:bg-gold-400"
              >
                Claim free hashrate
              </Link>
              <Link
                href="/payouts"
                className="text-sm font-semibold text-slate-300 underline-offset-4 hover:text-gold-300 hover:underline"
              >
                See live payouts
              </Link>
            </div>
          </Reveal>
        </div>
        <Reveal delay={220}>
          <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
            <Metric label="Active miners">
              <CountUp value={stats.miners} />
            </Metric>
            <Metric label="Hashrate plans">
              <CountUp value={plans.length} />
            </Metric>
            <Metric label={`${moneyUnit(cfg)} paid out`}>
              <CountUp value={stats.totalPaid} decimals={s.currency_decimals} cfg={cfg} />
            </Metric>
            <Metric label={`${moneyUnit(cfg)} staked`}>
              <CountUp value={stats.totalDeposits} decimals={s.currency_decimals} cfg={cfg} />
            </Metric>
          </div>
        </Reveal>
      </section>

      {payouts.withdrawals.length > 0 && (
        <Reveal>
          <section aria-label="Recent settlements" className="grid gap-6 md:grid-cols-[1fr_1.6fr]">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Recent settlements</h2>
              <p className="mt-2 text-sm text-slate-400">
                Withdrawals are published here as they clear, newest first.
              </p>
            </div>
            <ol className="divide-y divide-white/10 border-y border-white/10">
              {payouts.withdrawals.slice(0, 6).map((w, i) => (
                <li key={i} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-mono tabular-nums text-white">
                    {formatMoney(Number(w.amount), cfg)}
                  </span>
                  <span className="text-slate-400">{w.status ? w.status.toLowerCase() : "pending"}</span>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section id="plans" className="scroll-mt-24">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Hashrate plans</h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
                Pick a plan to see its projected yield. Every plan accrues daily and can be
                withdrawn once it clears.
              </p>
            </div>
            <Link
              href="/faq"
              className="text-sm font-semibold text-slate-300 underline-offset-4 hover:text-gold-300 hover:underline"
            >
              How mining works
            </Link>
          </div>
          <PlanExplorer plans={plans} currencyCode={s.currency_code} decimals={s.currency_decimals} priceCurrency={s.price_currency} cfg={cfg} />
        </section>
      </Reveal>

      <Reveal>
        <section className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <Card className="p-6 sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
              <Activity size={22} />
            </span>
            <h2 className="font-display mt-5 text-2xl font-bold text-white">Earnings accrue every minute</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              Hashrate is credited continuously and settles into your balance automatically, so the
              number moves while you watch it.
            </p>
          </Card>
          <div className="space-y-4">
            <div className="panel card-hover rounded-2xl p-6">
              <h3 className="font-display text-base font-bold text-white">On-chain payouts</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Every deposit and withdrawal is published on the live payouts feed.
              </p>
            </div>
            <div className="panel card-hover rounded-2xl p-6">
              <h3 className="font-display text-base font-bold text-white">
                {s.aff_comission}% affiliate rewards
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Earn lifetime commission each time a referral upgrades.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="rounded-3xl border border-white/10 px-6 py-10 sm:px-12 sm:py-14">
          <h2 className="font-display max-w-lg text-3xl font-bold text-white sm:text-4xl">
            Create an account and the free miner starts immediately.
          </h2>
          <Link
            href="/register"
            className="tap mt-7 inline-flex h-12 items-center rounded-xl bg-gold-500 px-8 font-display text-base font-bold text-ink-950 hover:bg-gold-400"
          >
            Claim free hashrate
          </Link>
        </section>
      </Reveal>
    </div>
  );
}
