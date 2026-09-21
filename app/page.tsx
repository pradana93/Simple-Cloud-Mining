import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Gauge,
  Pickaxe,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { getCachedPlans, getCachedPayouts, getCachedSettings, getCachedStats, type PayoutEntry } from "@/lib/catalog";
import type { Plan, SiteSettings } from "@/lib/types";
import { formatCrypto } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const revalidate = 60;

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-500/15 text-gold-300">
        {icon}
      </span>
      <span>
        <span className="block font-display text-lg font-bold leading-none text-white">{value}</span>
        <span className="mt-1 block text-xs text-slate-400">{label}</span>
      </span>
    </div>
  );
}

export default async function HomePage() {
  const [s, plans, stats, payouts]: [
    SiteSettings,
    Plan[],
    { miners: number; totalDeposits: number; totalPaid: number },
    { deposits: PayoutEntry[]; withdrawals: PayoutEntry[] },
  ] = await Promise.all([
    getCachedSettings(),
    getCachedPlans(),
    getCachedStats(),
    getCachedPayouts(),
  ]);
  const paid = plans.filter((p) => Number(p.price) > 0);
  const free = plans.find((p) => Number(p.price) === 0);
  const ticker = [...payouts.withdrawals.slice(0, 8)];
  const tickerItems = ticker.length ? [...ticker, ...ticker] : [];

  return (
    <div className="space-y-16 py-10 sm:py-14">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900/60 px-6 py-12 sm:px-12 sm:py-16">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="absolute -right-20 -top-20 h-72 w-72 animate-floaty rounded-full bg-gold-500/20 blur-[100px]" aria-hidden="true" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-sky-500/15 blur-[100px]" aria-hidden="true" />
        <div className="relative">
          <Badge variant="gold" className="mb-5">
            <Sparkles size={12} /> Flagship cloud mining · {s.currency_code}
          </Badge>
          <h1 className="font-display max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Mine <span className="gold-text">{s.currency_name}</span> like the professionals.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            {s.siteslogan}. Real hashrate, transparent on-chain payouts and earnings that
            accrue every minute — no hardware, no noise, no maintenance.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-7 font-display text-base font-bold text-ink-950 shadow-[0_8px_30px_-8px_rgba(245,179,1,0.6)] transition-all hover:brightness-110"
            >
              Start mining free <ArrowRight size={18} />
            </Link>
            <Link
              href="/payouts"
              className="glass inline-flex h-12 items-center px-7 font-display text-base font-semibold text-white transition-colors hover:border-gold-500/40"
            >
              Live payouts
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Users size={20} />} value={String(stats.miners)} label="Active miners" />
            <Stat icon={<Gauge size={20} />} value={String(plans.length)} label="Hashrate plans" />
            <Stat
              icon={<TrendingUp size={20} />}
              value={`${formatCrypto(stats.totalPaid, s.currency_decimals)}`}
              label={`${s.currency_code} paid out`}
            />
            <Stat
              icon={<Wallet size={20} />}
              value={`${formatCrypto(stats.totalDeposits, s.currency_decimals)}`}
              label={`${s.currency_code} staked`}
            />
          </div>
        </div>
      </section>

      {/* PAYOUT TICKER */}
      {tickerItems.length > 0 && (
        <section aria-label="Latest payouts" className="overflow-hidden">
          <div className="flex w-max animate-marquee gap-3">
            {tickerItems.map((w, i) => (
              <div key={i} className="glass flex items-center gap-2.5 rounded-full py-2 pl-3 pr-5 text-sm">
                <BadgeCheck size={16} className="shrink-0 text-emerald-400" />
                <span className="font-semibold text-white">
                  {formatCrypto(Number(w.amount), s.currency_decimals)} {s.currency_code}
                </span>
                <span className="text-slate-500">paid {w.status?.toLowerCase() ?? ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PLANS */}
      <section id="plans" className="scroll-mt-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold-400">Hashrate marketplace</p>
            <h2 className="font-display mt-2 text-3xl font-bold text-white sm:text-4xl">Choose your miner</h2>
          </div>
          <Link href="/faq" className="text-sm font-semibold text-slate-400 hover:text-gold-300">
            How mining works →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((p, idx) => {
            const isFree = Number(p.price) === 0;
            const isPopular = !isFree && idx === 1;
            return (
              <div
                key={p.id}
                className={`card-hover relative flex flex-col rounded-3xl p-7 ${
                  isPopular
                    ? "gold-ring bg-gradient-to-b from-gold-500/[0.12] to-ink-900"
                    : "glass"
                }`}
              >
                {isPopular && (
                  <Badge variant="gold" className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most popular
                  </Badge>
                )}
                {isFree && (
                  <Badge variant="green" className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Free forever
                  </Badge>
                )}
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-gold-300 ring-1 ring-white/10">
                    <Pickaxe size={22} />
                  </span>
                  <span className="font-display text-xs font-bold uppercase tracking-widest text-slate-500">
                    {p.version ?? ""}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-xl font-bold text-white">{p.plan_name}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-bold text-white">
                    {isFree ? "Free" : formatCrypto(Number(p.price), s.currency_decimals)}
                  </span>
                  {!isFree && <span className="text-sm font-semibold text-slate-400">{s.currency_code}</span>}
                </div>
                <dl className="mt-5 space-y-2.5 border-t border-white/10 pt-5 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-400">Daily yield</dt><dd className="font-semibold text-emerald-300">+{formatCrypto(Number(p.point_per_day ?? 0), s.currency_decimals)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Hashrate</dt><dd className="font-semibold text-white">{String(p.speed)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Contract</dt><dd className="font-semibold text-white">{p.duration} days</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Profit</dt><dd className="font-semibold text-gold-300">{p.profit ?? "—"}%</dd></div>
                </dl>
                <Link
                  href={isFree ? "/register" : `/purchase/${p.id}`}
                  className={`mt-6 inline-flex h-11 items-center justify-center rounded-xl font-display text-sm font-bold transition-all ${
                    isPopular
                      ? "bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950 hover:brightness-110"
                      : "border border-slate-700 text-white hover:border-gold-500/60"
                  }`}
                >
                  {isFree ? "Claim free miner" : "Deploy miner"}
                </Link>
              </div>
            );
          })}
          {plans.length === 0 && (
            <Card className="md:col-span-3">
              <CardContent className="py-10 text-center text-sm text-slate-400">
                Plans are syncing — check back in a minute.
              </CardContent>
            </Card>
          )}
        </div>
        {free && paid.length > 0 && (
          <p className="mt-5 text-center text-sm text-slate-500">
            New here? Claim the <span className="font-semibold text-emerald-300">Free Plan</span> first —
            it mines {formatCrypto(Number(free.point_per_day ?? 0), s.currency_decimals)} {s.currency_code}/day with zero deposit.
          </p>
        )}
      </section>

      {/* WHY */}
      <section>
        <h2 className="font-display text-center text-3xl font-bold text-white sm:text-4xl">
          Why miners choose <span className="gold-text">{s.sitename}</span>
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {[
            { icon: <Zap size={22} />, t: "Earnings every minute", d: "Hashrate accrues continuously and lands in your balance automatically." },
            { icon: <ShieldCheck size={22} />, t: "Transparent payouts", d: "Every deposit and withdrawal is published on the live payouts feed." },
            { icon: <Users size={22} />, t: `${s.aff_comission}% affiliate rewards`, d: "Earn lifetime commission every time your referrals upgrade." },
          ].map((f) => (
            <Card key={f.t} className="card-hover p-7">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
                {f.icon}
              </span>
              <h3 className="font-display mt-4 text-lg font-bold text-white">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden rounded-3xl border border-gold-500/25 bg-gradient-to-br from-gold-500/[0.12] via-ink-900 to-ink-900 px-6 py-12 text-center sm:px-12">
        <div className="absolute left-1/2 top-0 h-40 w-[36rem] -translate-x-1/2 rounded-full bg-gold-500/20 blur-[100px]" aria-hidden="true" />
        <h2 className="font-display relative text-3xl font-bold text-white sm:text-4xl">
          Your rig is already running.
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-slate-400">
          Create an account and the free miner starts hashing instantly.
        </p>
        <Link
          href="/register"
          className="relative mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-8 font-display text-base font-bold text-ink-950 transition-all hover:brightness-110"
        >
          Claim free hashrate <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
