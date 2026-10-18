"use client";

import { useState } from "react";
import { cn, formatCrypto } from "@/lib/utils";
import { formatMoney, type MoneyCfg } from "@/lib/money";

const HORIZONS = [7, 30, 90] as const;

// A straight projection of the balance at the current hashrate. The horizon is
// switchable in place; nothing here animates. It is a projection, not a record
// of past earnings (which are not stored per day).
export function ProjectionChart({
  start,
  perDay,
  decimals,
  target,
  cfg,
}: {
  start: number;
  perDay: number;
  decimals: number;
  target?: number | null;
  cfg?: MoneyCfg;
}) {
  const [days, setDays] = useState<number>(30);
  const fmt = (v: number) => (cfg ? formatMoney(v, cfg, decimals) : formatCrypto(v, decimals));

  const W = 680;
  const H = 200;
  const padL = 64;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const bottom = H - padB;
  const end = start + perDay * days;

  const candidates = [start, end, target ?? start, 0];
  let yMax = Math.max(...candidates);
  let yMin = Math.min(...candidates);
  if (yMax === yMin) yMax = yMin + 1;
  const span = yMax - yMin || 1;
  yMax += span * 0.06;
  yMin = Math.max(0, yMin - span * 0.08);
  const range = yMax - yMin || 1;

  const x = (d: number) => padL + (d / days) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - yMin) / range) * (H - padT - padB);

  const line = `M ${x(0)} ${y(start)} L ${x(days)} ${y(end)}`;
  const area = `${line} L ${x(days)} ${bottom} L ${x(0)} ${bottom} Z`;
  const showTarget = target != null && target > yMin && target < yMax;
  const gridVals = [yMax, yMin + range / 2, yMin];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          At <span className="font-mono tabular-nums text-slate-300">{fmt(perDay)}</span> per day
        </p>
        <div role="tablist" aria-label="Projection horizon" className="flex rounded-xl border border-slate-700 p-1">
          {HORIZONS.map((h) => (
            <button
              key={h}
              role="tab"
              aria-selected={days === h}
              onClick={() => setDays(h)}
              className={cn(
                "tap min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                days === h ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
              )}
            >
              +{h}d
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Projected ${days} day balance from ${fmt(start)} to ${fmt(end)}, at ${fmt(perDay)} per day`}
      >
        <defs>
          <linearGradient id="projection-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5b301" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#f5b301" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="rgba(148,163,184,0.14)" />
            <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontSize="10" className="fill-slate-500">
              {fmt(v)}
            </text>
          </g>
        ))}

        {showTarget && (
          <g>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(target as number)}
              y2={y(target as number)}
              stroke="rgba(16,185,129,0.55)"
              strokeDasharray="4 4"
            />
            <text x={W - padR} y={y(target as number) - 6} textAnchor="end" fontSize="10" className="fill-emerald-300">
              withdrawals unlock
            </text>
          </g>
        )}

        <path d={area} fill="url(#projection-fill)" />
        <path d={line} fill="none" stroke="#f5b544" strokeWidth="2" />
        <circle cx={x(0)} cy={y(start)} r="3.5" fill="#f5b544" />

        <text x={x(0)} y={H - 10} fontSize="10" className="fill-slate-500">
          now
        </text>
        <text x={x(days / 2)} y={H - 10} textAnchor="middle" fontSize="10" className="fill-slate-500">
          +{Math.round(days / 2)}d
        </text>
        <text x={x(days)} y={H - 10} textAnchor="end" fontSize="10" className="fill-slate-500">
          +{days}d
        </text>
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
        <div className="rounded-2xl bg-white/5 px-3 py-3">
          <p className="text-[11px] text-slate-400">Per day</p>
          <p className="font-mono mt-1 text-sm font-medium tabular-nums text-white">{fmt(perDay)}</p>
        </div>
        <div className="rounded-2xl bg-white/5 px-3 py-3">
          <p className="text-[11px] text-slate-400">In {days} days</p>
          <p className="font-mono mt-1 text-sm font-medium tabular-nums text-white">{fmt(end)}</p>
        </div>
        <div className="rounded-2xl bg-white/5 px-3 py-3">
          <p className="text-[11px] text-slate-400">Growth</p>
          <p className="font-mono mt-1 text-sm font-medium tabular-nums text-emerald-300">
            +{fmt(perDay * days)}
          </p>
        </div>
      </div>
    </div>
  );
}
