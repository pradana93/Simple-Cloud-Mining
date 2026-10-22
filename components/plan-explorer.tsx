"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { cn, formatCrypto } from "@/lib/utils";
import { formatFiat, type MoneyCfg } from "@/lib/money";
import { planEconomics } from "@/lib/plan-math";

type PlanItem = {
  id: number;
  plan_name: string;
  price: number;
  point_per_day: number | null;
  duration: number;
  version: string | null;
  speed: string | number | null;
};

function Row({ label, value, emerald }: { label: string; value: string; emerald?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className={cn("font-mono tabular-nums", emerald ? "text-emerald-300" : "text-white")}>{value}</dd>
    </div>
  );
}

export function PlanExplorer({
  plans,
  currencyCode,
  decimals,
  priceCurrency = "USD",
  cfg,
  popularity = {},
  recentPurchases = [],
}: {
  plans: PlanItem[];
  currencyCode: string;
  decimals: number;
  priceCurrency?: string;
  cfg?: MoneyCfg;
  popularity?: Record<number, number>;
  recentPurchases?: Array<{ planId: number; at: string }>;
}) {
  const all = useMemo(() => [...plans].sort((a, b) => Number(a.price) - Number(b.price)), [plans]);
  const [sort, setSort] = useState<"price" | "yield">("price");
  const [selectedId, setSelectedId] = useState<number | null>(all[0]?.id ?? null);
  const crypto = (v: number) =>
    `${formatCrypto(v, decimals).replace(/\.?0+$/, "")} ${currencyCode}`;
  const fiatHint = (v: number) =>
    cfg && cfg.mode === "fiat" && cfg.rate > 0 ? `≈${formatFiat(v * cfg.rate, cfg.fiatCurrency)}` : null;
  const priceOf = (v: number) => formatFiat(v, priceCurrency);
  const priceHint = (v: number) => {
    if (!cfg || v <= 0) return null;
    if (cfg.mode === "fiat" && cfg.fiatCurrency !== priceCurrency && cfg.priceToDisplay > 0) {
      return `≈${formatFiat(v * cfg.priceToDisplay, cfg.fiatCurrency)}`;
    }
    if (cfg.mode === "crypto" && cfg.cryptoToPrice > 0) {
      return `≈${formatCrypto(v / cfg.cryptoToPrice, cfg.decimals)} ${cfg.code}`;
    }
    return null;
  };

  const sorted = useMemo(() => {
    const copy = [...all];
    copy.sort((a, b) =>
      sort === "price"
        ? Number(a.price) - Number(b.price)
        : Number(b.point_per_day ?? 0) - Number(a.point_per_day ?? 0)
    );
    return copy;
  }, [all, sort]);

  if (!all.length) {
    return (
      <div className="panel rounded-2xl p-8 text-sm text-slate-400">
        No plans published yet. Check back shortly.
      </div>
    );
  }

  const sel = sorted.find((p) => p.id === selectedId) ?? sorted[0];
  const isFree = Number(sel.price) === 0;
  const projected = Number(sel.point_per_day ?? 0) * Number(sel.duration);
  const c2p = cfg?.cryptoToPrice ?? 0;
  const econOf = (p: PlanItem) =>
    c2p > 0
      ? planEconomics({
          price: Number(p.price),
          point_per_day: Number(p.point_per_day ?? 0),
          duration: Number(p.duration),
          cryptoToPrice: c2p,
        })
      : null;
  const selEcon = econOf(sel);
  const paid = all.filter((p) => Number(p.price) > 0);
  const next = paid.find((p) => Number(p.price) > Number(sel.price)) ?? null;
  const nextEcon = next ? econOf(next) : null;
  const returns = paid.map((p) => econOf(p)?.userRoiPct).filter((v): v is number => v != null);
  const returnRange =
    returns.length > 0
      ? `Member return ranges from +${Math.min(...returns).toFixed(1)}% to +${Math.max(...returns).toFixed(1)}% across paid tiers.`
      : null;
  const bestValueId = paid.reduce<PlanItem | null>((best, plan) => {
    const e = econOf(plan);
    if (!e) return best;
    if (!best) return plan;
    const bestE = econOf(best);
    return bestE && e.userRoiPct > bestE.userRoiPct ? plan : best;
  }, null)?.id;
  const mostPopularId = Object.entries(popularity).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
      <div>
        {returnRange && (
          <p className="mb-2 text-xs leading-relaxed text-slate-400">{returnRange}</p>
        )}
        {recentPurchases.length > 0 && (
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Recent activity: {recentPurchases.slice(0, 3).map((row) => {
              const plan = all.find((p) => p.id === row.planId);
              return plan ? plan.plan_name : null;
            }).filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mb-3 inline-flex rounded-xl border border-slate-700 p-1" role="tablist" aria-label="Sort plans">
          {(["price", "yield"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={sort === m}
              onClick={() => setSort(m)}
              className={cn(
                "min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                sort === m ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
              )}
            >
              {m === "price" ? "By price" : "By yield"}
            </button>
          ))}
        </div>
        <div className="space-y-3" aria-live="polite">
          {sorted.map((p) => {
            const active = sel.id === p.id;
            const free = Number(p.price) === 0;
            const e = econOf(p);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                aria-pressed={active}
                className={cn(
                  "tap w-full rounded-2xl border p-4 text-left transition-colors",
                  active
                    ? "border-gold-500/60 bg-gold-500/[0.06]"
                    : "border-white/10 bg-ink-900/40 hover:border-gold-500/30"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-display font-bold text-white">
                      {p.plan_name}
                      {p.version ? <span className="text-xs font-normal text-slate-400">{p.version}</span> : null}
                      {p.id === bestValueId && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                          Best return
                        </span>
                      )}
                      {String(p.id) === mostPopularId && (
                        <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-300">
                          Most bought
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {Number(p.speed) > 0 ? `${Number(p.speed)}x speed` : "speed n/a"} ·{" "}
                      {p.duration} days
                    </div>
                    {!free && e && (
                      <div className="mt-1 text-xs text-slate-400">
                        Back{" "}
                        <span className="font-mono text-slate-200">
                          {formatFiat(e.payoutInPrice, priceCurrency)}
                        </span>{" "}
                        · <span className="text-emerald-300">+{e.userRoiPct.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono tabular-nums text-white">
                      {free ? "Free" : priceOf(Number(p.price))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div key={sel.id} className="panel animate-scale-in h-fit rounded-3xl p-6">
        <div className="text-xs text-slate-400">Selected plan</div>
        <h3 className="font-display mt-1 text-2xl font-bold text-white">{sel.plan_name}</h3>
        {isFree && (
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            This is the starter plan. It costs nothing and activates when you create an account. The
            term is the starter plan&apos;s full duration, not a paid contract.
          </p>
        )}
        <dl className="mt-5 space-y-2.5 text-sm">
          <Row label="Daily credit" value={`+${crypto(Number(sel.point_per_day ?? 0))}`} emerald />
          <Row label={isFree ? "Starter access" : "Plan term"} value={`${sel.duration} days`} />
          <Row
            label="Relative speed"
            value={Number(sel.speed) > 0 ? `${Number(sel.speed)}x` : "n/a"}
          />
          <Row label="One-time price" value={isFree ? "Free" : priceOf(Number(sel.price))} />
          {!isFree && selEcon && (
            <>
              <Row label="Total back" value={formatFiat(selEcon.payoutInPrice, priceCurrency)} />
              <Row label="Member return" value={`+${selEcon.userRoiPct.toFixed(1)}%`} emerald />
            </>
          )}
        </dl>
        <p className="mt-2 text-xs text-slate-400">
          {isFree ? "No payment required." : `Price is set in ${priceCurrency}.`}
        </p>
        {!isFree && priceHint(Number(sel.price)) && (
          <p className="mt-1 text-xs text-slate-400">{priceHint(Number(sel.price))}</p>
        )}
        <div className="mt-5 rounded-2xl border border-white/10 p-4">
          <div className="text-xs text-slate-400">Projected over {sel.duration} days</div>
          <div className="font-mono mt-1 text-2xl font-medium tabular-nums text-gold-300">
            +{crypto(projected)}
          </div>
          {fiatHint(projected) && <div className="mt-1 text-xs text-slate-400">{fiatHint(projected)}</div>}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Projection uses the plan&apos;s published daily rate. It is not a market forecast or a
          guarantee.
        </p>
        <Link
          href={isFree ? "/register" : `/purchase/${sel.id}`}
          className="tap mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 font-display text-base font-bold text-ink-950 hover:bg-gold-400"
        >
          {isFree ? "Create free account" : "View payment options"}
        </Link>

        {next && nextEcon && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Next tier
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              <span className="font-semibold text-white">{next.plan_name}</span> at{" "}
              {priceOf(Number(next.price))} returns{" "}
              <span className="font-mono text-emerald-300">
                {formatFiat(nextEcon.payoutInPrice, priceCurrency)}
              </span>{" "}
              (+{nextEcon.userRoiPct.toFixed(1)}%) over {next.duration} days.
            </p>
            <button
              type="button"
              onClick={() => setSelectedId(next.id)}
              className="mt-2 text-xs font-semibold text-gold-300 hover:text-gold-400"
            >
              Compare {next.plan_name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
