import Link from "next/link";
import { Activity } from "lucide-react";
import { getCachedPlans, getCachedPayouts, getCachedSettings, getCachedStats } from "@/lib/catalog";
import { formatCrypto } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export const revalidate = 60;

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t-2 border-gold-500/70 pt-3">
      <div className="font-mono text-2xl font-medium tabular-nums text-white">{value}</div>
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
  const paid = plans.filter((p) => Number(p.price) > 0);
  const free = plans.find((p) => Number(p.price) === 0);

  return (
    <div className="space-y-20 py-10 sm:py-14">
      <section className="pt-2">
        <div className="max-w-3xl">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Mine <span className="gold-text">{s.currency_name}</span> from a console, not a
            warehouse.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            {s.siteslogan}. Buy a hashrate plan, watch it accrue, and withdraw on-chain. No hardware
            to host or maintain.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/register"
              className="cta-glow inline-flex h-12 items-center rounded-xl bg-gold-500 px-7 font-display text-base font-bold text-ink-950 transition-colors hover:bg-gold-400"
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
        </div>
        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
          <Metric value={String(stats.miners)} label="Active miners" />
          <Metric value={String(plans.length)} label="Hashrate plans" />
          <Metric value={formatCrypto(stats.totalPaid, s.currency_decimals)} label={`${s.currency_code} paid out`} />
          <Metric value={formatCrypto(stats.totalDeposits, s.currency_decimals)} label={`${s.currency_code} staked`} />
        </div>
      </section>

      {payouts.withdrawals.length > 0 && (
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
                  {formatCrypto(Number(w.amount), s.currency_decimals)} {s.currency_code}
                </span>
                <span className="text-slate-400">{w.status ? w.status.toLowerCase() : "pending"}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section id="plans" className="scroll-mt-24 grid gap-8 md:grid-cols-[1fr_1.5fr]">
        <div>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Hashrate plans</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Start on the free plan, then scale by buying more hashrate. Every plan accrues daily and
            can be withdrawn once it clears.
          </p>
          {free && (
            <Card className="mt-6 p-6">
              <div className="font-display text-lg font-bold text-white">{free.plan_name}</div>
              <div className="mt-1 font-mono text-sm text-emerald-300">
                +{formatCrypto(Number(free.point_per_day ?? 0), s.currency_decimals)} {s.currency_code}/day
              </div>
              <Link
                href="/register"
                className="mt-4 inline-flex h-11 items-center rounded-xl border border-slate-700 px-5 text-sm font-semibold text-white transition-colors hover:border-gold-500/60"
              >
                Claim free miner
              </Link>
            </Card>
          )}
          <Link
            href="/faq"
            className="mt-4 inline-block text-sm font-semibold text-slate-300 underline-offset-4 hover:text-gold-300 hover:underline"
          >
            How mining works
          </Link>
        </div>
        <div className="space-y-3">
          {paid.map((p) => (
            <div
              key={p.id}
              className="panel flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4"
            >
              <div className="min-w-[8rem]">
                <div className="font-display text-lg font-bold text-white">{p.plan_name}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {String(p.speed)} · {p.duration} days
                </div>
              </div>
              <div className="font-mono text-sm text-emerald-300">
                +{formatCrypto(Number(p.point_per_day ?? 0), s.currency_decimals)}/day
              </div>
              <div className="text-right">
                <div className="font-mono tabular-nums text-white">
                  {formatCrypto(Number(p.price), s.currency_decimals)}
                </div>
                <div className="text-xs text-slate-400">{s.currency_code}</div>
              </div>
              <Link
                href={`/purchase/${p.id}`}
                className="inline-flex h-11 items-center rounded-xl border border-slate-700 px-5 text-sm font-semibold text-white transition-colors hover:border-gold-500/60"
              >
                Deploy
              </Link>
            </div>
          ))}
          {plans.length === 0 && (
            <Card className="p-10 text-center text-sm text-slate-400">
              No plans published yet. Check back shortly.
            </Card>
          )}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Card className="p-8">
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
          <div className="panel rounded-2xl p-6">
            <h3 className="font-display text-base font-bold text-white">On-chain payouts</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Every deposit and withdrawal is published on the live payouts feed.
            </p>
          </div>
          <div className="panel rounded-2xl p-6">
            <h3 className="font-display text-base font-bold text-white">
              {s.aff_comission}% affiliate rewards
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Earn lifetime commission each time a referral upgrades.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 px-6 py-12 sm:px-12">
        <h2 className="font-display max-w-lg text-3xl font-bold text-white sm:text-4xl">
          Create an account and the free miner starts immediately.
        </h2>
        <Link
          href="/register"
          className="mt-7 inline-flex h-12 items-center rounded-xl bg-gold-500 px-8 font-display text-base font-bold text-ink-950 transition-colors hover:bg-gold-400"
        >
          Claim free hashrate
        </Link>
      </section>
    </div>
  );
}
