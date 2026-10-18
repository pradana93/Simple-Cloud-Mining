"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { cn, formatCrypto } from "@/lib/utils";

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
}: {
  plans: PlanItem[];
  currencyCode: string;
  decimals: number;
}) {
  const all = useMemo(() => [...plans].sort((a, b) => Number(a.price) - Number(b.price)), [plans]);
  const [sort, setSort] = useState<"price" | "yield">("price");
  const [selectedId, setSelectedId] = useState<number | null>(all[0]?.id ?? null);

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

  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
      <div>
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
                    <div className="font-display font-bold text-white">
                      {p.plan_name}
                      {p.version ? <span className="ml-2 text-xs font-normal text-slate-400">{p.version}</span> : null}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {String(p.speed ?? "")} · {p.duration} days
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono tabular-nums text-white">
                      {free ? "Free" : formatCrypto(Number(p.price), decimals)}
                    </div>
                    {!free && <div className="text-[10px] text-slate-400">{currencyCode}</div>}
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
        <dl className="mt-5 space-y-2.5 text-sm">
          <Row label="Daily yield" value={`+${formatCrypto(Number(sel.point_per_day ?? 0), decimals)} ${currencyCode}`} emerald />
          <Row label="Hashrate" value={String(sel.speed ?? "n/a")} />
          <Row label="Contract" value={`${sel.duration} days`} />
          <Row label="Price" value={isFree ? "Free" : `${formatCrypto(Number(sel.price), decimals)} ${currencyCode}`} />
        </dl>
        <div className="mt-5 rounded-2xl border border-white/10 p-4">
          <div className="text-xs text-slate-400">Projected over {sel.duration} days</div>
          <div className="font-mono mt-1 text-2xl font-medium tabular-nums text-gold-300">
            +{formatCrypto(projected, decimals)} {currencyCode}
          </div>
        </div>
        <Link
          href={isFree ? "/register" : `/purchase/${sel.id}`}
          className="tap mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-gold-500 font-display text-base font-bold text-ink-950 hover:bg-gold-400"
        >
          {isFree ? "Claim free miner" : "Deploy this miner"}
        </Link>
      </div>
    </div>
  );
}
