"use client";

import { cn } from "@/lib/utils";
import { clamp01 } from "./anim";
import { diceChance, diceMultiplier } from "@/lib/games/dice";
import { wheelSegments, type WheelRisk } from "@/lib/games/wheel";
import { PLINKO_ROWS, plinkoTable, type PlinkoRisk } from "@/lib/games/plinko";
import { kenoTable } from "@/lib/games/keno";
import { pocketColor, rouletteMultiplier, type RouletteBet } from "@/lib/games/roulette";
import { clamp } from "@/lib/games/util";
import type { BoardProps, Spin } from "./types";

// Controls plus a live stage per game. `spin.phase` drives the motion: "spin"
// is the continuous roll the moment a bet is placed, "land" eases onto the
// result the server returned, and "idle" holds the final frame.

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-ink-900/80 p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "tap rounded-lg px-3 py-1.5 text-sm font-semibold",
            value === o.value ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
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
      <span className="text-slate-600">/</span>
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
  const played = last && last.game === "dice";
  const finalRoll = played ? num(last.detail.roll, 0) : 0;
  const spinning = spin.phase === "spin";
  const landing = spin.phase === "land";
  const active = spin.phase !== "idle" || Boolean(played);

  const shown = spinning
    ? (spin.clock / 14) % 100
    : landing
      ? finalRoll + (1 - spin.p) * 40
      : finalRoll;
  const width = mode === "under" ? target : 100 - target;
  const left = mode === "under" ? 0 : target;

  return (
    <div className="space-y-5">
      <Seg
        options={[
          { value: "under", label: "Roll under" },
          { value: "over", label: "Roll over" },
        ]}
        value={mode}
        onChange={(v) => set({ mode: v })}
      />
      <Stage>
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div
              className={cn(
                "font-display text-5xl font-bold tabular-nums",
                spin.phase !== "idle" ? "text-gold-300" : played ? (last.won ? "text-emerald-300" : "text-red-300") : "text-white"
              )}
            >
              {active ? shown.toFixed(2) : "00.00"}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {mode === "under" ? "roll under" : "roll over"} {target.toFixed(2)}
            </div>
          </div>
          <div className="relative h-4 rounded-full bg-ink-800 ring-1 ring-white/10">
            <div className="absolute inset-y-0 rounded-full bg-gold-500/35" style={{ left: `${left}%`, width: `${width}%` }} />
            {active && (
              <div
                className={cn(
                  "absolute top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-full shadow",
                  spin.phase !== "idle" ? "bg-white" : last?.won ? "bg-emerald-400" : "bg-red-400"
                )}
                style={{ left: `${clamp01(shown / 100) * 100}%` }}
              />
            )}
          </div>
        </div>
      </Stage>
      <Preview chance={chance} mult={mult} />
    </div>
  );
}

function TargetBoard({ id, params, set, last, spin }: BoardProps) {
  const target = clamp(num(params.target, 2), 1.01, 1_000_000);
  const chance = (0.99 / target) * 100;
  const label = id === "crash" ? "Crash" : "Limbo";
  const played = last && last.game === id;
  const final = played ? num(last.detail.result ?? last.detail.crashAt, 1) : 1;
  const spinning = spin.phase === "spin";
  const landing = spin.phase === "land";
  const won = Boolean(last?.won);
  const shown = spinning ? 1 + spin.clock / 260 : landing ? final + (1 - spin.p) * 1.5 : final;
  const ceiling = Math.max(target, final, 2);
  const pct = clamp01(shown / ceiling) * 100;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
          <span>{label === "Crash" ? "Cash out at" : "Target multiplier"}</span>
          <span className="font-display text-lg font-bold text-gold-300">{target.toFixed(2)}x</span>
        </div>
        <input
          type="number"
          min={1.01}
          step={0.01}
          value={target}
          onChange={(e) => set({ target: Number(e.target.value) })}
          className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {[1.5, 2, 3, 5, 10, 25, 100].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ target: m })}
              className="tap rounded-lg bg-ink-900/80 px-3 py-1.5 text-sm font-semibold text-slate-300 ring-1 ring-white/10 hover:text-white"
            >
              {m}x
            </button>
          ))}
        </div>
      </div>
      <Stage>
        <div className="w-full max-w-md">
          <div
            className={cn(
              "text-center font-display text-6xl font-bold tabular-nums transition-colors",
              spin.phase !== "idle" ? "text-white" : !played ? "text-white" : won ? "text-emerald-300" : "text-red-300"
            )}
          >
            {shown.toFixed(2)}x
          </div>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
            <div
              className={cn("h-full rounded-full", spin.phase !== "idle" ? "bg-gold-500" : won ? "bg-emerald-500" : "bg-red-500")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>1.00x</span>
            <span>{ceiling.toFixed(2)}x</span>
          </div>
        </div>
      </Stage>
      <Preview chance={chance} mult={target} />
    </div>
  );
}

function CoinflipBoard({ params, set, last, spin }: BoardProps) {
  const side = params.side === "tails" ? "tails" : "heads";
  const played = last && last.game === "coinflip";
  const outcome = played ? String(last.detail.outcome) : "heads";
  const face = outcome === "tails" ? 180 : 0;
  const angle =
    spin.phase === "spin" ? spin.clock * 1.8 : spin.phase === "land" ? face + (1 - spin.p) * 360 * 3 : face;

  return (
    <div className="space-y-5">
      <Seg
        options={[
          { value: "heads", label: "Heads" },
          { value: "tails", label: "Tails" },
        ]}
        value={side}
        onChange={(v) => set({ side: v })}
      />
      <Stage>
        <div className="space-y-6 text-center">
          <div className="mx-auto grid h-32 w-32 [perspective:900px]">
            <div className="relative [transform-style:preserve-3d]" style={{ transform: `rotateY(${angle}deg)` }}>
              <div className="absolute inset-0 grid place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-display text-3xl font-bold text-ink-950 [backface-visibility:hidden]">
                H
              </div>
              <div className="absolute inset-0 grid place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-700 font-display text-3xl font-bold text-ink-950 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                T
              </div>
            </div>
          </div>
          {spin.phase === "idle" && played && (
            <p className={cn("animate-pop font-display font-bold", last.won ? "text-emerald-300" : "text-red-300")}>
              {outcome}
            </p>
          )}
        </div>
      </Stage>
      <Preview chance={50} mult={1.98} />
    </div>
  );
}

const WHEEL_COLORS = ["#f5b301", "#b45309", "#0b1120"];

function WheelBoard({ params, set, last, spin }: BoardProps) {
  const risk = (params.risk === "medium" || params.risk === "high" ? params.risk : "low") as WheelRisk;
  const segments = wheelSegments(risk);
  const total = segments.reduce((s, x) => s + x.weight, 0);
  const rtp = segments.reduce((s, x) => s + x.weight * x.multiplier, 0) / total;
  const played = last && last.game === "wheel";
  const index = played ? num(last.detail.index, 0) : -1;

  const stops: string[] = [];
  let acc = 0;
  segments.forEach((seg, i) => {
    const from = (acc / total) * 360;
    acc += seg.weight;
    const to = (acc / total) * 360;
    const color = seg.multiplier > 0 ? WHEEL_COLORS[i % 2] : WHEEL_COLORS[2];
    stops.push(`${color} ${from}deg ${to}deg`);
  });

  let center = 0;
  {
    let a = 0;
    segments.forEach((seg, i) => {
      const from = (a / total) * 360;
      a += seg.weight;
      if (i === index) center = (from + (a / total) * 360) / 2;
    });
  }
  const target = -center;
  const rotation =
    spin.phase === "spin" ? spin.clock * 0.9 : spin.phase === "land" ? target + (1 - spin.p) * 360 * 2 : played ? target : 0;

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
      />
      <Stage>
        <div className="relative grid place-items-center">
          <div className="absolute -top-1 z-10 h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-gold-400" />
          <div
            className="h-56 w-56 rounded-full ring-4 ring-ink-800"
            style={{ background: `conic-gradient(from -90deg, ${stops.join(", ")})`, transform: `rotate(${rotation}deg)` }}
          />
          {spin.phase === "idle" && played && (
            <div className="absolute bottom-2 animate-pop rounded-full bg-ink-950/90 px-4 py-1.5 font-display text-lg font-bold text-gold-300 ring-1 ring-white/10">
              {last.multiplier > 0 ? `${last.multiplier}x` : "no win"}
            </div>
          )}
        </div>
      </Stage>
      <Preview chance={(rtp / Math.max(...segments.map((s) => s.multiplier || 1))) * 100} mult={rtp} />
    </div>
  );
}

function PlinkoBoard({ params, set, last, spin }: BoardProps) {
  const rows = PLINKO_ROWS.includes(num(params.rows, 12) as (typeof PLINKO_ROWS)[number]) ? num(params.rows, 12) : 12;
  const risk = (params.risk === "medium" || params.risk === "high" ? params.risk : "low") as PlinkoRisk;
  const table = plinkoTable(rows, risk);
  const played = last && last.game === "plinko";
  const path = played ? ((last.detail.path as boolean[] | undefined) ?? []) : [];
  const slot = played ? num(last.detail.slot, 0) : -1;
  const active = spin.phase !== "idle" || Boolean(played);

  const ballX = (steps: number) => {
    let x = rows / 2;
    for (let i = 0; i < rows; i++) {
      const frac = clamp01(steps - i);
      if (frac <= 0) break;
      x += (path[i] ? 0.5 : -0.5) * frac;
    }
    return x;
  };

  let x = rows / 2;
  let steps = 0;
  if (spin.phase === "spin") {
    x = rows / 2 + Math.sin(spin.clock / 110) * 0.7;
  } else if (spin.phase === "land") {
    steps = spin.p * rows;
    x = ballX(steps);
  } else if (played) {
    steps = rows;
    x = ballX(rows);
  }
  const ballLeft = ((x + 0.5) / (rows + 1)) * 100;
  const ballTop = spin.phase === "spin" ? 6 + ((spin.clock / 40) % 22) : 6 + clamp01(steps / rows) * 74;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Seg
          options={PLINKO_ROWS.map((r) => ({ value: String(r), label: `${r} rows` }))}
          value={String(rows)}
          onChange={(v) => set({ rows: Number(v) })}
        />
        <Seg
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
          value={risk}
          onChange={(v) => set({ risk: v })}
        />
      </div>
      <Stage>
        <div className="relative h-64 w-full max-w-lg">
          {Array.from({ length: rows }, (_, i) =>
            Array.from({ length: i + 1 }, (_, j) => (
              <span
                key={`${i}-${j}`}
                className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500/70"
                style={{ left: `${((j + 1) / (i + 2)) * 100}%`, top: `${((i + 1) / (rows + 1)) * 78 + 4}%` }}
              />
            ))
          )}
          {active && (
            <span
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400 shadow-[0_0_12px_rgba(245,179,1,0.7)]"
              style={{ left: `${ballLeft}%`, top: `${ballTop}%` }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-0.5">
            {table.map((m, i) => (
              <span
                key={i}
                className={cn(
                  "flex-1 rounded-md py-1 text-center text-[10px] font-bold ring-1",
                  i === slot && spin.phase === "idle"
                    ? "bg-gold-500 text-ink-950 ring-gold-500"
                    : "bg-ink-900/70 text-slate-300 ring-white/10"
                )}
              >
                {m}x
              </span>
            ))}
          </div>
        </div>
      </Stage>
    </div>
  );
}

function KenoBoard({ params, set, last, spin }: BoardProps) {
  const picks = Array.isArray(params.picks) ? (params.picks as number[]) : [];
  const table = kenoTable(picks.length || 1);
  const played = last && last.game === "keno";
  const draw = played ? ((last.detail.draw as number[] | undefined) ?? []) : [];
  const shownCount =
    spin.phase === "spin" ? 0 : spin.phase === "land" ? Math.floor(spin.p * 10 + 0.0001) : played ? 10 : 0;
  const shown = draw.slice(0, shownCount);
  const toggle = (n: number) => {
    if (picks.includes(n)) set({ picks: picks.filter((x) => x !== n) });
    else if (picks.length < 10) set({ picks: [...picks, n].sort((a, b) => a - b) });
  };
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">
        Pick up to 10 numbers. <span className="font-semibold text-white">{picks.length}</span> chosen.
        {spin.phase === "idle" && played && (
          <span className="ml-2 font-semibold text-gold-300">{num(last.detail.matches, 0)} matched</span>
        )}
      </p>
      <Stage className="place-items-stretch">
        <div className="grid grid-cols-8 gap-1.5 self-center sm:grid-cols-10">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
            const picked = picks.includes(n);
            const hit = shown.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                className={cn(
                  "tap aspect-square rounded-lg text-xs font-bold ring-1",
                  hit
                    ? "animate-pop bg-emerald-500 text-ink-950 ring-emerald-400"
                    : picked
                      ? "bg-gold-500 text-ink-950 ring-gold-500"
                      : spin.phase === "spin"
                        ? "bg-ink-900/70 text-slate-500 ring-white/10"
                        : "bg-ink-900/70 text-slate-300 ring-white/10 hover:text-white"
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
  { value: "odd", label: "Odd" },
  { value: "even", label: "Even" },
  { value: "low", label: "1-18" },
  { value: "high", label: "19-36" },
  { value: "number", label: "Number" },
];

function RouletteWheel({ rotation }: { rotation: number }) {
  const N = 37;
  const r = 100;
  const cx = 100;
  const cy = 100;
  const sec = 360 / N;
  const numberR = r - 14;
  return (
    <svg viewBox="0 0 200 200" className="h-56 w-56">
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "100px 100px" }}>
        {Array.from({ length: N }, (_, i) => {
          const a0 = ((i * sec - 90) * Math.PI) / 180;
          const a1 = (((i + 1) * sec - 90) * Math.PI) / 180;
          const x0 = cx + r * Math.cos(a0);
          const y0 = cy + r * Math.sin(a0);
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy + r * Math.sin(a1);
          const color = pocketColor(i);
          const fill = color === "green" ? "#059669" : color === "red" ? "#dc2626" : "#111827";
          const mid = ((i * sec + sec / 2 - 90) * Math.PI) / 180;
          const tx = cx + numberR * Math.cos(mid);
          const ty = cy + numberR * Math.sin(mid);
          return (
            <g key={i}>
              <path
                d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`}
                fill={fill}
                stroke="#0b1120"
                strokeWidth={0.6}
              />
              <text
                x={tx}
                y={ty}
                fill="#f8fafc"
                fontSize={7}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${i * sec + sec / 2} ${tx} ${ty})`}
              >
                {i}
              </text>
            </g>
          );
        })}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f2937" strokeWidth={4} />
      <circle cx={cx} cy={cy} r={16} fill="#0b1120" stroke="#f5b301" strokeWidth={2} />
    </svg>
  );
}

function RouletteBoard({ params, set, last, spin }: BoardProps) {
  const bet = (ROULETTE_BETS.some((b) => b.value === params.bet) ? params.bet : "red") as RouletteBet;
  const number = clamp(num(params.number, 0), 0, 36);
  const played = last && last.game === "roulette";
  const pocket = played ? num(last.detail.pocket, 0) : 0;
  const center = (pocket + 0.5) * (360 / 37);
  const target = -center;
  const rotation =
    spin.phase === "spin" ? spin.clock * 0.9 : spin.phase === "land" ? target + (1 - spin.p) * 360 * 2 : played ? target : 0;
  const chance = bet === "number" ? 100 / 37 : (18 / 37) * 100;

  return (
    <div className="space-y-5">
      <Seg options={ROULETTE_BETS.map((b) => ({ value: b.value, label: b.label }))} value={bet} onChange={(v) => set({ bet: v })} />
      {bet === "number" && (
        <div>
          <p className="mb-2 text-sm text-slate-400">
            Straight number <span className="font-display font-bold text-white">{number}</span>
          </p>
          <div className="grid grid-cols-9 gap-1.5">
            {Array.from({ length: 37 }, (_, n) => {
              const color = pocketColor(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => set({ number: n })}
                  className={cn(
                    "tap aspect-square rounded-lg text-xs font-bold ring-1",
                    color === "red" && "bg-red-600/80 text-white ring-red-500/50",
                    color === "black" && "bg-ink-950 text-white ring-white/20",
                    color === "green" && "bg-emerald-600/80 text-white ring-emerald-500/50",
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
        <div className="relative grid place-items-center">
          <div className="absolute -top-1 z-10 h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-gold-400" />
          <RouletteWheel rotation={rotation} />
          {spin.phase === "idle" && played && (
            <div
              className={cn(
                "absolute bottom-2 animate-pop rounded-full px-4 py-1.5 font-display text-lg font-bold ring-1 ring-white/10",
                last.won ? "bg-emerald-500 text-ink-950" : "bg-ink-950/90 text-white"
              )}
            >
              {pocket} {pocketColor(pocket)}
            </div>
          )}
        </div>
      </Stage>
      <Preview chance={chance} mult={rouletteMultiplier(bet)} />
    </div>
  );
}

const SLOT_LABEL: Record<string, string> = {
  seven: "7",
  bell: "Bell",
  bar: "Bar",
  cherry: "Cherry",
  lemon: "Lemon",
  grape: "Grape",
};
const SLOT_SPIN = ["bar", "cherry", "seven", "lemon", "grape", "bell"];
const CELL = 60;

function SlotsReel({ symbol, spin }: { symbol: string; spin: Spin }) {
  const strip = [...SLOT_SPIN, symbol];
  const n = strip.length;
  let offset = (n - 1) * CELL;
  if (spin.phase === "spin") offset = (spin.clock * 0.7) % (n * CELL);
  else if (spin.phase === "land") offset = spin.p * (n - 1) * CELL;
  return (
    <div className="relative h-[60px] w-[72px] overflow-hidden rounded-xl bg-ink-950 ring-1 ring-white/10">
      <div
        className="absolute inset-x-0 top-0"
        style={{ transform: `translateY(${-offset}px)`, filter: spin.phase === "spin" ? "blur(1.4px)" : "none" }}
      >
        {strip.map((s, i) => (
          <div key={i} className="grid h-[60px] place-items-center font-display text-lg font-bold text-gold-300">
            {SLOT_LABEL[s] ?? s}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotsBoard({ last, spin }: BoardProps) {
  const played = last && last.game === "slots";
  const reels = played ? ((last.detail.reels as string[] | undefined) ?? []) : [];
  const finals = [0, 1, 2].map((i) => reels[i] ?? "seven");
  return (
    <div className="space-y-5">
      <Stage>
        <div className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <SlotsReel key={i} symbol={finals[i]} spin={spin} />
          ))}
        </div>
        {spin.phase === "idle" && played && (
          <p
            className={cn(
              "absolute bottom-3 animate-pop font-display font-bold",
              last.multiplier > 0 ? "text-emerald-300" : "text-slate-400"
            )}
          >
            {last.multiplier > 0 ? `${last.multiplier}x` : "no win"}
          </p>
        )}
      </Stage>
      <p className="text-center text-sm text-slate-400">
        Line up three of a kind, or catch two cherries. Sevens pay the most.
      </p>
    </div>
  );
}

export function Board(props: BoardProps) {
  switch (props.id) {
    case "dice":
      return <DiceBoard {...props} />;
    case "limbo":
    case "crash":
      return <TargetBoard {...props} />;
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
