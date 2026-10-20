"use client";

import { useRef } from "react";
import { Bell, Cherry, Citrus, Grape } from "lucide-react";
import { cn } from "@/lib/utils";
import { clamp01, easeInOutCubic, lerp } from "./anim";
import { diceChance, diceMultiplier } from "@/lib/games/dice";
import { wheelSegments, type WheelRisk } from "@/lib/games/wheel";
import { PLINKO_ROWS, plinkoTable, type PlinkoRisk } from "@/lib/games/plinko";
import { kenoTable } from "@/lib/games/keno";
import { pocketColor, rouletteMultiplier, type RouletteBet } from "@/lib/games/roulette";
import { clamp } from "@/lib/games/util";
import type { BoardProps, Spin } from "./types";

// Controls plus a live stage per game. `spin.phase` drives the motion: "spin"
// is the continuous motion the moment a bet is placed, "land" eases onto the
// result the server returned, and "idle" holds the final frame. Motion always
// reports the object that decides the round: the roll, the coin, the ball, the
// reel. Reduced motion shortens it; it never removes the result.

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function Seg({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-ink-900/80 p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          disabled={disabled}
          className={cn(
            "tap inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400",
            value === o.value ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white",
            disabled && "cursor-not-allowed opacity-50 hover:text-inherit"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative grid min-h-[15rem] place-items-center overflow-hidden rounded-2xl bg-ink-950/60 p-4 ring-1 ring-white/5",
        className
      )}
    >
      {children}
    </div>
  );
}

function Preview({ chance, mult }: { chance: number; mult: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-ink-900/60 px-4 py-3 text-sm ring-1 ring-white/5">
      <span className="text-slate-400">
        Win chance <span className="font-display font-bold text-white">{chance.toFixed(2)}%</span>
      </span>
      <span className="text-slate-400">/</span>
      <span className="text-slate-400">
        Payout <span className="font-display font-bold text-gold-300">{mult.toFixed(2)}x</span>
      </span>
    </div>
  );
}

function DiceBoard({ params, set, last, spin }: BoardProps) {
  const target = clamp(num(params.target, 50), 2, 98);
  const mode: "under" | "over" = params.mode === "over" ? "over" : "under";
  const chance = diceChance({ target, mode }) * 100;
  const mult = diceMultiplier({ target, mode });
  const played = Boolean(last && last.game === "dice");
  const settled = played && spin.phase === "idle";
  const shownTarget = settled ? clamp(num(last?.detail.target, target), 2, 98) : target;
  const shownMode: "under" | "over" =
    settled && last?.detail.mode === "over" ? "over" : settled && last?.detail.mode === "under" ? "under" : mode;
  const displayChance = diceChance({ target: shownTarget, mode: shownMode }) * 100;
  const displayMult = diceMultiplier({ target: shownTarget, mode: shownMode });
  const finalRoll = settled ? num(last?.detail.roll, 0) : 0;
  const spinning = spin.phase === "spin";
  const landing = spin.phase === "land";
  const active = spin.phase !== "idle" || played;
  const locked = spin.phase !== "idle";
  const shownRef = useRef(0);

  let shown = 0;
  if (spinning) {
    // Triangle sweep: continuous at both ends, no modulo wrap from 99 to 0.
    shown = 100 - Math.abs(((spin.clock * 0.36) % 200) - 100);
    shownRef.current = shown;
  } else if (landing) {
    // Start from the frame the sweep was on, then decelerate onto the result.
    shown = lerp(shownRef.current, finalRoll, spin.p);
  } else if (played) {
    shown = finalRoll;
  }

  const width = shownMode === "under" ? shownTarget : 100 - shownTarget;
  const left = shownMode === "under" ? 0 : shownTarget;
  const markerColor = spin.phase !== "idle" ? "bg-gold-300" : last?.won ? "bg-emerald-400" : "bg-red-400";

  return (
    <div className="space-y-5">
      <Seg
        options={[
          { value: "under", label: "Roll under" },
          { value: "over", label: "Roll over" },
        ]}
        value={mode}
        onChange={(v) => set({ mode: v })}
        disabled={locked}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Win chance</span>
          <span className="font-display text-lg font-bold text-white">{chance.toFixed(2)}%</span>
        </div>
        <div className="relative h-11">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
            <div className="h-full rounded-full bg-gold-500/80" style={{ width: `${chance}%` }} />
          </div>
          <input
            type="range"
            min={2}
            max={98}
            step={0.01}
            value={Number(chance.toFixed(2))}
            onChange={(e) => {
              const c = Number(e.target.value);
              set({ target: Number((mode === "under" ? c : 100 - c).toFixed(2)) });
            }}
            disabled={locked}
            aria-label="Win chance"
            aria-valuetext={`${chance.toFixed(2)} percent, pays ${mult.toFixed(2)} times`}
            className="relative h-11 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink-950 [&::-moz-range-thumb]:bg-gold-400 [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink-950 [&::-webkit-slider-thumb]:bg-gold-400 [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(245,179,1,0.18)] disabled:cursor-not-allowed"
          />
        </div>
        <p className="text-xs text-slate-400">
          Higher chance pays less. Roll {shownMode} {shownTarget.toFixed(2)}.
        </p>
      </div>

      <Stage>
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div
              className={cn(
                "font-display text-5xl font-bold tabular-nums sm:text-6xl",
                spin.phase !== "idle"
                  ? "text-gold-300"
                  : played
                    ? last?.won
                      ? "text-emerald-300"
                      : "text-red-300"
                    : "text-white"
              )}
            >
              {active ? shown.toFixed(2) : "00.00"}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {shownMode === "under" ? "roll under" : "roll over"} {shownTarget.toFixed(2)}
            </div>
          </div>
          <div className="relative h-4 rounded-full bg-ink-800 ring-1 ring-white/10" aria-hidden>
            <div
              className="absolute inset-y-0 rounded-full bg-gold-500/35"
              style={{ left: `${left}%`, width: `${width}%` }}
            />
            {active && (
              <div
                className={cn("absolute top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-full", markerColor)}
                style={{ left: `${clamp01(shown / 100) * 100}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-slate-400" aria-hidden>
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      </Stage>
      <Preview chance={displayChance} mult={displayMult} />
    </div>
  );
}

function LimboBoard({ params, set, last, spin }: BoardProps) {
  const target = clamp(num(params.target, 2), 1.01, 1_000_000);
  const played = Boolean(last && last.game === "limbo");
  const settled = played && spin.phase === "idle";
  const shownTarget = settled ? clamp(num(last?.detail.target, target), 1.01, 1_000_000) : target;
  const result = played ? num(last?.detail.result, 1) : null;
  const won = Boolean(last?.won);
  const locked = spin.phase !== "idle";
  const chance = Math.min(98.02, (0.99 / shownTarget) * 100);
  const ceiling = Math.max(shownTarget, result ?? 0, 2);
  const targetPct = (shownTarget / ceiling) * 100;
  const resultPct = result == null ? 0 : (result / ceiling) * 100;
  const waiting = !played;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
          <span>Target multiplier</span>
          <span className="font-display text-lg font-bold text-gold-300">{target.toFixed(2)}x</span>
        </div>
        <input
          type="number"
          min={1.01}
          step={0.01}
          value={target}
          onChange={(e) => set({ target: Number(e.target.value) })}
          disabled={locked}
          className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {[1.5, 2, 3, 5, 10, 25, 100].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ target: m })}
              disabled={locked}
              className="tap inline-flex min-h-11 items-center rounded-lg bg-ink-900/80 px-3 text-sm font-semibold text-slate-300 ring-1 ring-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {m}x
            </button>
          ))}
        </div>
      </div>

      <Stage>
        <div className="w-full max-w-md">
          <div
            key={played ? (last?.seed.nonce ?? 0) : 0}
            className={cn(
              "text-center font-display text-6xl font-bold tabular-nums",
              waiting ? "text-slate-500" : won ? "text-emerald-300" : "text-red-300",
              played && "animate-pop"
            )}
          >
            {result == null ? "..." : `${result.toFixed(2)}x`}
          </div>
          <p className={cn("mt-2 text-center text-sm", waiting ? "text-slate-400" : won ? "text-emerald-200" : "text-red-200")}>
            {waiting
              ? "Drawing the number"
              : won
                ? `Reached your ${shownTarget.toFixed(2)}x target`
                : `Missed your ${shownTarget.toFixed(2)}x target`}
          </p>
          <div className="relative mt-6 h-3 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10" aria-hidden>
            <div
              className="absolute inset-y-0 bg-emerald-500/20"
              style={{ left: `${targetPct}%`, width: `${Math.max(0, 100 - targetPct)}%` }}
            />
            <div className="absolute inset-y-0 w-0.5 bg-gold-400" style={{ left: `${clamp01(targetPct / 100) * 100}%` }} />
            {result != null && (
              <div
                className={cn("absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full", won ? "bg-emerald-300" : "bg-red-300")}
                style={{ left: `${clamp01(resultPct / 100) * 100}%` }}
              />
            )}
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400" aria-hidden>
            <span>1.00x</span>
            <span>{ceiling.toFixed(2)}x</span>
          </div>
        </div>
      </Stage>
      <Preview chance={chance} mult={shownTarget} />
      <p className="text-xs text-slate-400">The number is the server draw. A target is a floor, not a forecast.</p>
    </div>
  );
}

function CoinflipBoard({ params, set, last, spin }: BoardProps) {
  const side = params.side === "tails" ? "tails" : "heads";
  const played = Boolean(last && last.game === "coinflip");
  const outcome = played ? String(last?.detail.outcome) : "heads";
  const face = outcome === "tails" ? 180 : 0;
  const spinning = spin.phase === "spin";
  const landing = spin.phase === "land";
  const angleRef = useRef(0);
  let angle = face;
  if (spinning) {
    angle = spin.clock * 1.8;
    angleRef.current = angle;
  } else if (landing) {
    const start = angleRef.current;
    const end = start + 1080 + (((face - start - 1080) % 360) + 360) % 360;
    angle = lerp(start, end, spin.p);
  }
  const liftRef = useRef(0);

  let lift = 0;
  if (spinning) {
    lift = Math.abs(Math.sin(spin.clock / 170)) * 46;
    liftRef.current = lift;
  } else if (landing) {
    lift = liftRef.current * (1 - spin.p);
  }

  return (
    <div className="space-y-5">
      <Seg
        options={[
          { value: "heads", label: "Heads" },
          { value: "tails", label: "Tails" },
        ]}
        value={side}
        onChange={(v) => set({ side: v })}
        disabled={spin.phase !== "idle"}
      />
      <Stage>
        <div className="flex flex-col items-center gap-4 text-center">
          <div style={{ transform: `translateY(${-lift}px)` }}>
            <div className="grid h-32 w-32 [perspective:900px]">
              <div className="relative [transform-style:preserve-3d]" style={{ transform: `rotateY(${angle}deg)` }}>
                <div className="absolute inset-0 grid place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 ring-4 ring-gold-200/20 [backface-visibility:hidden]">
                  <span className="grid h-24 w-24 place-items-center rounded-full border border-ink-950/20 font-display text-4xl font-bold text-ink-950">
                    H
                  </span>
                </div>
                <div className="absolute inset-0 grid place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-700 ring-4 ring-gold-200/20 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <span className="grid h-24 w-24 place-items-center rounded-full border border-ink-950/20 font-display text-4xl font-bold text-ink-950">
                    T
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div
            className="h-3 w-24 rounded-full bg-black/40 blur-md"
            style={{ opacity: Math.max(0.12, 0.4 - lift / 160), transform: `scaleX(${Math.max(0.45, 1 - lift / 200)})` }}
          />
          {spin.phase === "idle" && played && (
            <p className={cn("animate-pop font-display font-bold", last?.won ? "text-emerald-300" : "text-red-300")}>
              {outcome} {last?.won ? "wins" : "loses"}
            </p>
          )}
        </div>
      </Stage>
      <Preview chance={50} mult={1.98} />
    </div>
  );
}

const WHEEL_FILL = ["#f5b301", "#b45309"];

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function sectorPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const p0 = polar(cx, cy, r, from);
  const p1 = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
}

function WheelBoard({ params, set, last, spin }: BoardProps) {
  const risk = (params.risk === "medium" || params.risk === "high" ? params.risk : "low") as WheelRisk;
  const played = Boolean(last && last.game === "wheel");
  const settled = played && spin.phase === "idle";
  const detailRisk = last?.detail.risk;
  const shownRisk =
    settled && (detailRisk === "low" || detailRisk === "medium" || detailRisk === "high")
      ? (detailRisk as WheelRisk)
      : risk;
  const segments = wheelSegments(shownRisk);
  const total = segments.reduce((s, x) => s + x.weight, 0);
  const rtp = segments.reduce((s, x) => s + x.weight * x.multiplier, 0) / total;
  const index = played ? num(last?.detail.index, 0) : -1;
  const maxMult = Math.max(...segments.map((s) => s.multiplier));
  const maxChance =
    (segments.reduce((s, x) => s + (x.multiplier === maxMult ? x.weight : 0), 0) / total) * 100;

  let acc = 0;
  let center = 0;
  const wedges = segments.map((seg, i) => {
    const from = (acc / total) * 360;
    acc += seg.weight;
    const to = (acc / total) * 360;
    if (i === index) center = (from + to) / 2;
    return { seg, i, from, to };
  });

  const target = -center;
  const rotationRef = useRef(0);
  let rotation = played ? target : 0;
  if (spin.phase === "spin") {
    rotation = spin.clock * 0.72;
    rotationRef.current = rotation;
  } else if (spin.phase === "land") {
    const start = rotationRef.current;
    const startMod = ((start % 360) + 360) % 360;
    const endMod = ((target % 360) + 360) % 360;
    rotation = lerp(start, start + 720 + ((endMod - startMod + 360) % 360), spin.p);
  }

  const ballRef = useRef(0);
  let ballAngle = 0;
  let ballR = 84;
  if (spin.phase === "spin") {
    ballAngle = -spin.clock * 1.5;
    ballRef.current = ballAngle;
    ballR = 94;
  } else if (spin.phase === "land") {
    const start = ballRef.current;
    const mod = ((start % 360) + 360) % 360;
    ballAngle = lerp(start, start - mod - 720, spin.p);
    ballR = lerp(94, 84, spin.p);
  }
  const ball = polar(110, 110, ballR, ballAngle);

  return (
    <div className="space-y-5">
      <Seg
        options={[
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]}
        value={risk}
        onChange={(v) => set({ risk: v })}
        disabled={spin.phase !== "idle"}
      />
      <Stage>
        <div className="grid place-items-center">
          <svg viewBox="0 0 220 220" className="h-60 w-60 sm:h-72 sm:w-72" role="img" aria-label="Weighted prize wheel">
            <circle cx={110} cy={110} r={108} fill="#0b1120" stroke="#1e293b" strokeWidth={3} />
            <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "110px 110px" }}>
              {wedges.map(({ seg, i, from, to }) => {
                const a0 = -90 + from;
                const a1 = -90 + to;
                const mid = -90 + (from + to) / 2;
                const label = polar(110, 110, 77, mid);
                const fill = seg.multiplier > 0 ? WHEEL_FILL[i % WHEEL_FILL.length] : "#0f172a";
                return (
                  <g key={i}>
                    <path d={sectorPath(110, 110, 100, a0, a1)} fill={fill} stroke="#0b1120" strokeWidth={1.5} />
                    <text
                      x={label.x}
                      y={label.y}
                      fill={seg.multiplier > 0 ? "#0b1120" : "#e2e8f0"}
                      fontSize={seg.multiplier > 0 ? 12 : 11}
                      fontWeight={700}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${mid + 90} ${label.x} ${label.y})`}
                    >
                      {seg.multiplier > 0 ? `${seg.multiplier}x` : "0x"}
                    </text>
                    {settled && i === index && (
                      <path
                        d={sectorPath(110, 110, 100, a0, a1)}
                        fill="rgba(245,179,1,0.18)"
                        stroke="#fde68a"
                        strokeWidth={2.5}
                      />
                    )}
                  </g>
                );
              })}
            </g>
            <circle cx={110} cy={110} r={102} fill="none" stroke="#1f2937" strokeWidth={1} />
            <circle cx={110} cy={110} r={20} fill="#0b1120" stroke="#f5b301" strokeWidth={2} />
            <circle cx={110} cy={110} r={5} fill="#f5b301" />
            <path d="M110 2 L118 17 L102 17 Z" fill="#f5b301" />
            <circle cx={ball.x} cy={ball.y} r={5} fill="#f8fafc" stroke="#0b1120" strokeWidth={1} />
            <circle cx={ball.x} cy={ball.y} r={1.6} fill="#f5b301" />
          </svg>
        </div>
        {spin.phase === "idle" && played && (
          <div className="mt-2 animate-pop rounded-full bg-ink-950/90 px-4 py-1.5 font-display text-lg font-bold text-gold-300 ring-1 ring-white/10">
            {last && last.multiplier > 0 ? `${last.multiplier.toFixed(2)}x` : "no win"}
          </div>
        )}
      </Stage>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-900/60 px-4 py-3 text-sm ring-1 ring-white/5">
        <span className="text-slate-400">
          Base return <span className="font-display font-bold text-white">{(rtp * 100).toFixed(1)}%</span>
        </span>
        <span className="text-slate-400">
          Top prize <span className="font-display font-bold text-gold-300">{maxMult.toFixed(2)}x</span> at{" "}
          <span className="font-display font-bold text-white">{maxChance.toFixed(1)}%</span>
        </span>
      </div>
    </div>
  );
}

function fmtMult(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}k`;
  return String(m);
}

const PLINKO_PEG_TOP = 15;
const PLINKO_PEG_BOTTOM = 74;
const PLINKO_SLOT_Y = 92;

function PlinkoBoard({ params, set, last, spin }: BoardProps) {
  const rowsParam = PLINKO_ROWS.includes(num(params.rows, 12) as (typeof PLINKO_ROWS)[number])
    ? num(params.rows, 12)
    : 12;
  const riskParam = (params.risk === "medium" || params.risk === "high" ? params.risk : "low") as PlinkoRisk;
  const played = Boolean(last && last.game === "plinko");
  const settled = played && spin.phase === "idle";
  const rows = settled ? num(last?.detail.rows, rowsParam) : rowsParam;
  const risk = settled && (last?.detail.risk === "medium" || last?.detail.risk === "high") ? last?.detail.risk : settled && last?.detail.risk === "low" ? "low" : riskParam;
  const table = plinkoTable(rows, risk as PlinkoRisk);
  const path = played && Array.isArray(last?.detail.path) ? (last?.detail.path as boolean[]) : [];
  const slot = played ? num(last?.detail.slot, 0) : -1;
  const active = spin.phase !== "idle" || played;
  const locked = spin.phase !== "idle";

  const half = rows / 2;
  const gap = rows > 1 ? (PLINKO_PEG_BOTTOM - PLINKO_PEG_TOP) / (rows - 1) : 0;
  const xAt = (r: number): number => {
    let rights = 0;
    for (let i = 0; i < r; i++) if (path[i]) rights++;
    return half + rights - r / 2;
  };
  const pctX = (x: number): number => ((x + 0.5) / (rows + 1)) * 100;
  const pegTop = (r: number): number => PLINKO_PEG_TOP + r * gap;

  let x = half;
  let y = 5 + Math.sin(spin.clock / 200) * 1.4;
  let squash = 0;
  if (spin.phase === "land") {
    const s = spin.p * (rows + 1);
    if (s <= rows) {
      const r = Math.min(rows - 1, Math.floor(s));
      const f = s - r;
      x = lerp(xAt(r), xAt(r + 1), easeInOutCubic(f));
      y = pegTop(r) + f * gap;
      squash = Math.sin(f * Math.PI);
    } else {
      const f = clamp01(s - rows);
      x = xAt(rows);
      y = lerp(pegTop(rows - 1) + gap, PLINKO_SLOT_Y, easeInOutCubic(f));
      squash = Math.sin(f * Math.PI);
    }
  } else if (spin.phase === "idle" && played) {
    x = xAt(rows);
    y = PLINKO_SLOT_Y;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Seg
          options={PLINKO_ROWS.map((r) => ({ value: String(r), label: `${r} rows` }))}
          value={String(rowsParam)}
          onChange={(v) => set({ rows: Number(v) })}
          disabled={locked}
        />
        <Seg
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
          value={riskParam}
          onChange={(v) => set({ risk: v })}
          disabled={locked}
        />
      </div>
      <Stage>
        <div className="relative h-80 w-full max-w-xl">
          <div
            className="absolute top-2 h-2 w-8 -translate-x-1/2 rounded-full bg-ink-800 ring-1 ring-white/10"
            style={{ left: "50%" }}
            aria-hidden
          />
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: r + 1 }, (_, k) => (
              <span
                key={`${r}-${k}`}
                className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                style={{ left: `${pctX(half + k - r / 2)}%`, top: `${pegTop(r)}%` }}
              />
            ))
          )}

          {active && (
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pctX(x)}%`, top: `${y}%` }}
            >
              <span
                className="block h-3 w-3 rounded-full bg-gold-300 shadow-[0_0_10px_rgba(245,179,1,0.8)] ring-1 ring-gold-100/60"
                style={{ transform: `scale(${1 + squash * 0.3}, ${1 - squash * 0.22})` }}
              />
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 h-12">
            {table.map((m, i) => (
              <span
                key={i}
                className="absolute inset-y-0 px-px"
                style={{ left: `${(i / (rows + 1)) * 100}%`, width: `${100 / (rows + 1)}%` }}
              >
                <span
                  className={cn(
                    "flex h-full items-center justify-center rounded-t-md text-[8px] font-bold leading-none sm:text-[9px]",
                    i === slot && settled
                      ? "bg-gold-500 text-ink-950 ring-1 ring-gold-300"
                      : "bg-ink-900/80 text-slate-300 ring-1 ring-white/10"
                  )}
                >
                  {fmtMult(m)}x
                </span>
              </span>
            ))}
          </div>
        </div>
      </Stage>
      <p className="text-xs text-slate-400">
        Base edge 1% to 3% depending on risk and rows. Site payout settings can adjust the return.
      </p>
    </div>
  );
}

function KenoBoard({ params, set, last, spin }: BoardProps) {
  const picks = Array.isArray(params.picks) ? (params.picks as number[]) : [];
  const table = kenoTable(picks.length || 1);
  const played = Boolean(last && last.game === "keno");
  const draw = played ? ((last?.detail.draw as number[] | undefined) ?? []) : [];
  const shownCount =
    spin.phase === "spin" ? 0 : spin.phase === "land" ? Math.floor(spin.p * 10 + 0.0001) : played ? 10 : 0;
  const shown = draw.slice(0, shownCount);
  const locked = spin.phase !== "idle";
  const toggle = (n: number) => {
    if (locked) return;
    if (picks.includes(n)) set({ picks: picks.filter((x) => x !== n) });
    else if (picks.length < 10) set({ picks: [...picks, n].sort((a, b) => a - b) });
  };
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">
        Pick up to 10 numbers. <span className="font-semibold text-white">{picks.length}</span> chosen.
        {spin.phase === "land" && (
          <span className="ml-2 inline-flex items-center gap-1 font-semibold text-gold-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" />
            Drawing {shown.length} of 10
          </span>
        )}
        {spin.phase === "idle" && played && (
          <span className="ml-2 font-semibold text-gold-300">Last draw: {num(last?.detail.matches, 0)} matched</span>
        )}
      </p>
      <Stage className="place-items-stretch">
        <div className="grid grid-cols-5 gap-1.5 self-center sm:grid-cols-10">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
            const picked = picks.includes(n);
            const hit = shown.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                disabled={locked}
                className={cn(
                  "tap aspect-square min-h-11 rounded-lg text-xs font-bold ring-1",
                  hit
                    ? "animate-pop bg-emerald-500 text-ink-950 ring-2 ring-emerald-300"
                    : picked
                      ? "bg-gold-500 text-ink-950 ring-gold-500"
                      : "bg-ink-900/70 text-slate-300 ring-white/10 hover:text-white",
                  locked && "cursor-not-allowed opacity-70 hover:text-inherit"
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </Stage>
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(table)
            .filter(([, m]) => m > 0)
            .map(([matches, m]) => (
              <span key={matches} className="rounded-lg bg-ink-900/70 px-2 py-1 text-slate-300 ring-1 ring-white/10">
                {matches} match{matches === "1" ? "" : "es"} pays {m}x
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

const ROULETTE_BETS: { value: RouletteBet; label: string }[] = [
  { value: "red", label: "Red" },
  { value: "black", label: "Black" },
  { value: "green", label: "Green" },
  { value: "odd", label: "Odd" },
  { value: "even", label: "Even" },
  { value: "low", label: "1-18" },
  { value: "high", label: "19-36" },
  { value: "number", label: "Number" },
];

// The physical pocket order on a European single-zero wheel. The result is
// still the seed's pocket; this order only changes where the ball has to land.
const EUROPEAN_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22,
  18, 29, 7, 28, 12, 35, 3, 26,
];

function ballPoint(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

function RouletteWheel({
  rotation,
  ballAngle,
  ballR,
  ballVisible,
  highlight,
  won,
}: {
  rotation: number;
  ballAngle: number;
  ballR: number;
  ballVisible: boolean;
  highlight: number | null;
  won: boolean;
}) {
  const N = 37;
  const sec = 360 / N;
  const cx = 120;
  const cy = 120;
  const ball = ballPoint(cx, cy, ballR, ballAngle);
  const highlightIndex = highlight == null ? -1 : EUROPEAN_ORDER.indexOf(highlight);

  return (
    <svg viewBox="0 0 240 240" className="h-64 w-64 sm:h-72 sm:w-72" role="img" aria-label="Roulette wheel">
      <circle cx={cx} cy={cy} r={118} fill="#0b1120" stroke="#1e293b" strokeWidth={2} />
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "120px 120px" }}>
        {EUROPEAN_ORDER.map((num, i) => {
          const from = -90 + i * sec;
          const to = -90 + (i + 1) * sec;
          const color = pocketColor(num);
          const fill = color === "green" ? "#059669" : color === "red" ? "#b91c1c" : "#111827";
          const label = polar(cx, cy, 82, from + sec / 2);
          return (
            <g key={num}>
              <path d={sectorPath(cx, cy, 100, from, to)} fill={fill} stroke="#0b1120" strokeWidth={1} />
              <text
                x={label.x}
                y={label.y}
                fill="#f8fafc"
                fontSize={7}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${i * sec + sec / 2} ${label.x} ${label.y})`}
              >
                {num}
              </text>
              {highlightIndex === i && (
                <path
                  d={sectorPath(cx, cy, 100, from, to)}
                  fill={won ? "rgba(52,211,153,0.25)" : "rgba(245,179,1,0.2)"}
                  stroke={won ? "#6ee7b7" : "#f5b301"}
                  strokeWidth={2.5}
                />
              )}
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={38} fill="#0b1120" stroke="#f5b301" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={30} fill="none" stroke="#1f2937" strokeWidth={1} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const p = polar(cx, cy, 34, a - 90);
          return <circle key={a} cx={p.x} cy={p.y} r={1.6} fill="#f5b301" />;
        })}
      </g>
      <circle cx={cx} cy={cy} r={106} fill="none" stroke="#0b1120" strokeWidth={7} />
      <circle cx={cx} cy={cy} r={101} fill="none" stroke="#1f2937" strokeWidth={1} />
      <path d="M120 2 L128 17 L112 17 Z" fill="#f5b301" />
      {ballVisible && (
        <>
          <circle cx={ball.x} cy={ball.y} r={5.5} fill="#f8fafc" opacity={0.4} />
          <circle cx={ball.x} cy={ball.y} r={4} fill="#f8fafc" />
          <circle cx={ball.x - 1} cy={ball.y - 1} r={1.2} fill="#f5b301" />
        </>
      )}
    </svg>
  );
}

function RouletteBoard({ params, set, last, spin }: BoardProps) {
  const bet = (ROULETTE_BETS.some((b) => b.value === params.bet) ? params.bet : "red") as RouletteBet;
  const number = clamp(num(params.number, 0), 0, 36);
  const played = Boolean(last && last.game === "roulette");
  const pocket = played ? num(last?.detail.pocket, 0) : 0;
  const index = EUROPEAN_ORDER.indexOf(pocket);
  const center = (index + 0.5) * (360 / 37);
  const target = -center;
  const spinning = spin.phase === "spin";
  const landing = spin.phase === "land";
  const rotationRef = useRef(0);
  let rotation = played ? target : 0;
  if (spinning) {
    rotation = spin.clock * 0.72;
    rotationRef.current = rotation;
  } else if (landing) {
    const start = rotationRef.current;
    const startMod = ((start % 360) + 360) % 360;
    const endMod = ((target % 360) + 360) % 360;
    rotation = lerp(start, start + 720 + ((endMod - startMod + 360) % 360), spin.p);
  }

  const ballRef = useRef(0);
  let ballAngle = 0;
  let ballR = 84;
  if (spinning) {
    ballAngle = -spin.clock * 1.45;
    ballRef.current = ballAngle;
    ballR = 106;
  } else if (landing) {
    const start = ballRef.current;
    const mod = ((start % 360) + 360) % 360;
    ballAngle = lerp(start, start - mod - 720, spin.p);
    ballR = lerp(106, 84, spin.p);
  } else if (played) {
    ballAngle = 0;
    ballR = 84;
  }

  const chance = bet === "number" || bet === "green" ? (1 / 37) * 100 : (18 / 37) * 100;
  const settled = spin.phase === "idle" && played;
  const color = pocketColor(pocket);

  return (
    <div className="space-y-5">
      <Seg
        options={ROULETTE_BETS.map((b) => ({ value: b.value, label: b.label }))}
        value={bet}
        onChange={(v) => set({ bet: v })}
        disabled={spin.phase !== "idle"}
      />
      {bet === "number" && (
        <div>
          <p className="mb-2 text-sm text-slate-400">
            Straight number <span className="font-display font-bold text-white">{number}</span>
          </p>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
            {Array.from({ length: 37 }, (_, n) => {
              const c = pocketColor(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => set({ number: n })}
                  disabled={spin.phase !== "idle"}
                  className={cn(
                    "tap aspect-square min-h-11 rounded-lg text-xs font-bold ring-1 disabled:cursor-not-allowed disabled:opacity-60",
                    c === "red" && "bg-red-600/80 text-white ring-red-500/50",
                    c === "black" && "bg-ink-950 text-white ring-white/20",
                    c === "green" && "bg-emerald-600/80 text-white ring-emerald-500/50",
                    number === n && "ring-2 ring-gold-400"
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Stage>
        <div className="flex flex-col items-center gap-3">
          <RouletteWheel
            rotation={rotation}
            ballAngle={ballAngle}
            ballR={ballR}
            ballVisible={!spinning}
            highlight={played && settled ? pocket : null}
            won={Boolean(last?.won)}
          />
          {settled && (
            <div
              className={cn(
                "animate-pop inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-sm font-bold ring-1 ring-white/10",
                last?.won ? "bg-emerald-500 text-ink-950" : "bg-ink-950/90 text-white"
              )}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  color === "red" ? "bg-red-500" : color === "green" ? "bg-emerald-500" : "bg-slate-400"
                )}
              />
              {pocket} {color}
              <span className="text-slate-400">/</span>
              {last && last.multiplier > 0 ? `${last.multiplier.toFixed(2)}x` : "no win"}
            </div>
          )}
        </div>
      </Stage>
      <Preview chance={chance} mult={rouletteMultiplier(bet)} />
    </div>
  );
}

const SLOT_STRIP = ["seven", "bell", "bar", "cherry", "lemon", "grape"];
const SLOT_CELL = 88;

function SlotFace({ symbol }: { symbol: string }) {
  switch (symbol) {
    case "seven":
      return <span className="font-display text-4xl font-black text-gold-300">7</span>;
    case "bell":
      return <Bell size={30} className="text-gold-300" />;
    case "bar":
      return (
        <span className="rounded-md bg-gold-500 px-1.5 py-1 font-display text-[10px] font-black tracking-widest text-ink-950">
          BAR
        </span>
      );
    case "cherry":
      return <Cherry size={30} className="text-red-400" />;
    case "lemon":
      return <Citrus size={30} className="text-gold-300" />;
    case "grape":
      return <Grape size={30} className="text-emerald-300" />;
    default:
      return <span className="text-sm font-bold text-slate-300">{symbol}</span>;
  }
}

function SlotsReel({ symbol, spin, index }: { symbol: string; spin: Spin; index: number }) {
  const strip = [...SLOT_STRIP, ...SLOT_STRIP, ...SLOT_STRIP, ...SLOT_STRIP, symbol];
  const finalIndex = strip.length - 1;
  const period = SLOT_STRIP.length * SLOT_CELL;
  const spinOffsetRef = useRef(0);
  const k = spin.phase === "land" ? clamp01((spin.p - index * 0.12) / 0.7) : spin.phase === "idle" ? 1 : 0;
  let offset = finalIndex * SLOT_CELL;
  if (spin.phase === "spin") {
    offset = (spin.clock * (0.62 + index * 0.07)) % period;
    spinOffsetRef.current = offset;
  } else if (spin.phase === "land") {
    const target = finalIndex * SLOT_CELL;
    const startBase = target - period * 2;
    const base = ((spinOffsetRef.current % period) + period) % period;
    const start = startBase + (((base - startBase) % period) + period) % period;
    offset = lerp(start, target, k);
  }
  return (
    <div className="relative h-[88px] w-[76px] overflow-hidden rounded-xl bg-ink-950 ring-1 ring-white/10">
      <div
        className="absolute inset-x-0 top-0"
        style={{ transform: `translateY(${-offset}px)`, filter: spin.phase === "spin" ? "blur(1.3px)" : "none" }}
      >
        {strip.map((s, i) => (
          <div key={i} className="grid h-[88px] place-items-center">
            <SlotFace symbol={s} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-ink-950 to-transparent" />
    </div>
  );
}

function SlotsBoard({ last, spin }: BoardProps) {
  const played = Boolean(last && last.game === "slots");
  const reels = played ? ((last?.detail.reels as string[] | undefined) ?? []) : [];
  const finals = [0, 1, 2].map((i) => reels[i] ?? "seven");
  const won = played && spin.phase === "idle" && Boolean(last?.won);
  return (
    <div className="space-y-5">
      <Stage>
        <div
          className={cn(
            "relative rounded-2xl bg-ink-900/80 p-2 ring-1 ring-white/10",
            won && "animate-win-glow ring-gold-400/60"
          )}
        >
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <SlotsReel key={i} index={i} symbol={finals[i]} spin={spin} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 h-px -translate-y-1/2 bg-gold-400/50" />
        </div>
        {spin.phase === "idle" && played && (
          <p
            className={cn(
              "mt-4 animate-pop font-display font-bold",
              last && last.multiplier > 0 ? "text-emerald-300" : "text-slate-400"
            )}
          >
            {last && last.multiplier > 0 ? `${last.multiplier.toFixed(2)}x` : "no win"}
          </p>
        )}
      </Stage>
      <p className="text-center text-sm text-slate-400">
        Three of a kind pays on the symbol. Two cherries in a row pay 1.1x. Base 8% house edge, and site payout
        settings can adjust the return.
      </p>
    </div>
  );
}

export function Board(props: BoardProps) {
  switch (props.id) {
    case "dice":
      return <DiceBoard {...props} />;
    case "limbo":
      return <LimboBoard {...props} />;
    case "coinflip":
      return <CoinflipBoard {...props} />;
    case "wheel":
      return <WheelBoard {...props} />;
    case "plinko":
      return <PlinkoBoard {...props} />;
    case "keno":
      return <KenoBoard {...props} />;
    case "roulette":
      return <RouletteBoard {...props} />;
    case "slots":
      return <SlotsBoard {...props} />;
    default:
      return null;
  }
}
