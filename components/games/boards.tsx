"use client";

import { cn } from "@/lib/utils";
import { diceChance, diceMultiplier, type DiceParams } from "@/lib/games/dice";
import { wheelSegments, type WheelRisk } from "@/lib/games/wheel";
import { PLINKO_ROWS, plinkoTable, type PlinkoRisk } from "@/lib/games/plinko";
import { kenoTable } from "@/lib/games/keno";
import { pocketColor, rouletteMultiplier, type RouletteBet } from "@/lib/games/roulette";
import { clamp } from "@/lib/games/util";
import type { BoardProps } from "./types";

// Controls and live previews for the instant games. Each board only edits its
// own params; the shared panel in game-view.tsx owns the stake and the bet.

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
            "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
            value === o.value ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
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

function DiceBoard({ params, set, last }: BoardProps) {
  const target = clamp(num(params.target, 50), 2, 98);
  const mode = params.mode === "over" ? "over" : "under";
  const diceParams: DiceParams = { target, mode };
  const chance = diceChance(diceParams) * 100;
  const mult = diceMultiplier(diceParams);
  const roll = last && last.game === "dice" ? num(last.detail.roll, -1) : -1;
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
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
          <span>Target</span>
          <span className="font-display text-lg font-bold text-white">{target.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={2}
          max={98}
          step={0.5}
          value={target}
          onChange={(e) => set({ target: Number(e.target.value) })}
          className="w-full accent-gold-500"
        />
        <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
          <div
            className="absolute inset-y-0 bg-gold-500/40"
            style={{ left: `${left}%`, width: `${width}%` }}
          />
          {roll >= 0 && (
            <div
              className={cn(
                "absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full",
                last?.won ? "bg-emerald-400" : "bg-red-400"
              )}
              style={{ left: `${roll}%` }}
            />
          )}
        </div>
        {roll >= 0 && (
          <p className="mt-2 text-sm text-slate-400">
            Rolled <span className="font-display font-bold text-white">{roll.toFixed(2)}</span>
          </p>
        )}
      </div>
      <Preview chance={chance} mult={mult} />
    </div>
  );
}

function TargetBoard({ id, params, set, last }: BoardProps) {
  const target = clamp(num(params.target, 2), 1.01, 1_000_000);
  const chance = (0.99 / target) * 100;
  const result = last && last.game === id ? num(last.detail.result ?? last.detail.crashAt, -1) : -1;
  const label = id === "crash" ? "Crash" : "Limbo";

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
              className="rounded-lg bg-ink-900/80 px-3 py-1.5 text-sm font-semibold text-slate-300 ring-1 ring-white/10 transition hover:text-white"
            >
              {m}x
            </button>
          ))}
        </div>
      </div>
      {result >= 0 && (
        <p className="text-sm text-slate-400">
          {label === "Crash" ? "Crashed at" : "Result"}
          <span className="ml-2 font-display font-bold text-white">{result.toFixed(2)}x</span>
        </p>
      )}
      <Preview chance={chance} mult={target} />
    </div>
  );
}

function CoinflipBoard({ params, set, last }: BoardProps) {
  const side = params.side === "tails" ? "tails" : "heads";
  const outcome = last && last.game === "coinflip" ? String(last.detail.outcome) : "";
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
      <p className="text-sm text-slate-400">
        Calling <span className="font-semibold text-white">{side}</span>. A match pays 1.98x.
      </p>
      {outcome && (
        <p className={cn("font-display font-bold", last?.won ? "text-emerald-300" : "text-red-300")}>
          Landed {outcome}
        </p>
      )}
      <Preview chance={50} mult={1.98} />
    </div>
  );
}

function WheelBoard({ params, set, last }: BoardProps) {
  const risk = (params.risk === "medium" || params.risk === "high" ? params.risk : "low") as WheelRisk;
  const segments = wheelSegments(risk);
  const rtp = segments.reduce((s, x) => s + x.weight * x.multiplier, 0) / segments.reduce((s, x) => s + x.weight, 0);
  const index = last && last.game === "wheel" ? num(last.detail.index, -1) : -1;
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
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-between rounded-xl px-4 py-2 text-sm ring-1",
              i === index ? "bg-gold-500/15 ring-gold-500/40" : "bg-ink-900/60 ring-white/5"
            )}
          >
            <span className="font-display font-bold text-white">{seg.multiplier}x</span>
            <span className="text-slate-400">
              {(seg.weight / segments.reduce((s, x) => s + x.weight, 0) * 100).toFixed(1)}% of spins
            </span>
          </div>
        ))}
      </div>
      <Preview chance={(rtp / Math.max(...segments.map((s) => s.multiplier || 1))) * 100} mult={rtp} />
    </div>
  );
}

function PlinkoBoard({ params, set, last }: BoardProps) {
  const rows = PLINKO_ROWS.includes(num(params.rows, 12) as (typeof PLINKO_ROWS)[number])
    ? num(params.rows, 12)
    : 12;
  const risk = (params.risk === "medium" || params.risk === "high" ? params.risk : "low") as PlinkoRisk;
  const table = plinkoTable(rows, risk);
  const slot = last && last.game === "plinko" ? num(last.detail.slot, -1) : -1;
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
      <div className="flex flex-wrap gap-1.5">
        {table.map((m, i) => (
          <span
            key={i}
            className={cn(
              "rounded-lg px-2 py-1 text-xs font-bold ring-1",
              i === slot ? "bg-gold-500 text-ink-950 ring-gold-500" : "bg-ink-900/70 text-slate-300 ring-white/10"
            )}
          >
            {m}x
          </span>
        ))}
      </div>
      <p className="text-sm text-slate-400">Lower multipliers sit at the edges, big ones are hard to reach.</p>
    </div>
  );
}

function KenoBoard({ params, set, last }: BoardProps) {
  const picks = Array.isArray(params.picks) ? (params.picks as number[]) : [];
  const table = kenoTable(picks.length || 1);
  const draw = last && last.game === "keno" ? (last.detail.draw as number[] | undefined) ?? [] : [];
  const toggle = (n: number) => {
    if (picks.includes(n)) set({ picks: picks.filter((x) => x !== n) });
    else if (picks.length < 10) set({ picks: [...picks, n].sort((a, b) => a - b) });
  };
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">
        Pick up to 10 numbers. <span className="font-semibold text-white">{picks.length}</span> chosen.
      </p>
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
          const picked = picks.includes(n);
          const hit = draw.includes(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              className={cn(
                "aspect-square rounded-lg text-xs font-bold ring-1 transition",
                picked
                  ? "bg-gold-500 text-ink-950 ring-gold-500"
                  : hit
                    ? "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40"
                    : "bg-ink-900/70 text-slate-300 ring-white/10 hover:text-white"
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
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

function RouletteBoard({ params, set, last }: BoardProps) {
  const bet = (ROULETTE_BETS.some((b) => b.value === params.bet) ? params.bet : "red") as RouletteBet;
  const number = clamp(num(params.number, 0), 0, 36);
  const pocket = last && last.game === "roulette" ? num(last.detail.pocket, -1) : -1;
  const chance = bet === "number" ? 100 / 37 : bet === "green" ? 100 / 37 : 18 / 37 * 100;
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
                    "aspect-square rounded-lg text-xs font-bold ring-1 transition",
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
      {pocket >= 0 && (
        <p className="text-sm text-slate-400">
          Landed on{" "}
          <span className="font-display font-bold text-white">
            {pocket} {pocketColor(pocket)}
          </span>
        </p>
      )}
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

function SlotsBoard({ last }: BoardProps) {
  const reels = last && last.game === "slots" ? (last.detail.reels as string[] | undefined) ?? [] : [];
  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex h-24 w-20 items-center justify-center rounded-2xl bg-ink-900/80 text-center font-display text-lg font-bold text-gold-300 ring-1 ring-white/10"
          >
            {reels[i] ? SLOT_LABEL[reels[i]] ?? reels[i] : "?"}
          </div>
        ))}
      </div>
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
