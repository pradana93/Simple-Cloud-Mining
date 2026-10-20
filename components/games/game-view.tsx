"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, formatCrypto } from "@/lib/utils";
import { useCountUp, useSpin } from "./anim";
import { Board } from "./boards";
import { SeedManager } from "./seed-manager";
import type { BetRow, PlayResponse, SeedView } from "./types";

const DEFAULTS: Record<string, Record<string, unknown>> = {
  dice: { target: 50, mode: "under" },
  limbo: { target: 2 },
  crash: { target: 2 },
  coinflip: { side: "heads" },
  wheel: { risk: "low" },
  plinko: { risk: "low", rows: 12 },
  keno: { picks: [] },
  roulette: { bet: "red", number: 0 },
  slots: {},
};

// Spin time per game, then the landing time. The spin starts the moment Bet is
// pressed and holds until the server result is back, so a slow round still reads
// as real time rather than a stall.
const SPIN: Record<string, [number, number]> = {
  dice: [1300, 520],
  limbo: [1500, 640],
  crash: [1650, 680],
  coinflip: [1400, 560],
  wheel: [3000, 950],
  plinko: [2600, 950],
  keno: [1800, 720],
  roulette: [3200, 1000],
  slots: [1900, 720],
};

export function GameView({
  id,
  name,
  blurb,
  symbol,
  decimals,
  balance: initialBalance,
  minBet = 0,
  maxBet = 0,
}: {
  id: string;
  name: string;
  blurb: string;
  symbol: string;
  decimals: number;
  balance: number;
  minBet?: number;
  maxBet?: number;
}) {
  const { push } = useToast();
  const [balance, setBalance] = useState(initialBalance);
  const [seed, setSeed] = useState<SeedView | null>(null);
  const [seedState, setSeedState] = useState<"loading" | "ready" | "error">("loading");
  const [stake, setStake] = useState(() => String(minBet > 0 ? minBet : 1));
  const [params, setParams] = useState<Record<string, unknown>>(() => DEFAULTS[id] ?? {});
  const [result, setResult] = useState<PlayResponse | null>(null);
  const [runId, setRunId] = useState(0);
  const [bets, setBets] = useState<BetRow[]>([]);

  const readyRef = useRef(false);
  const resultRef = useRef<PlayResponse | null>(null);
  const bettingRef = useRef(false);

  const [spinMs, landMs] = SPIN[id] ?? [1500, 600];
  const spin = useSpin(runId, spinMs, landMs, readyRef);
  const spinning = spin.phase !== "idle";

  const set = useCallback((patch: Record<string, unknown>) => setParams((p) => ({ ...p, ...patch })), []);

  const stakeNum = Number(stake);
  const belowMin = minBet > 0 && Number.isFinite(stakeNum) && stakeNum < minBet;
  const aboveMax = maxBet > 0 && Number.isFinite(stakeNum) && stakeNum > maxBet;
  const overBalance = Number.isFinite(stakeNum) && stakeNum > balance;
  const valid = Number.isFinite(stakeNum) && stakeNum > 0 && !belowMin && !aboveMax && !overBalance;
  const fmt = useMemo(() => (v: number) => formatCrypto(v, decimals), [decimals]);
  const shownBalance = useCountUp(balance, 650);
  const rounds = useMemo(() => bets.filter((b) => b.game === id), [bets, id]);

  const clampStake = useCallback(
    (n: number) => {
      let v = Number.isFinite(n) && n > 0 ? n : minBet > 0 ? minBet : 0;
      if (minBet > 0 && v < minBet) v = minBet;
      if (maxBet > 0 && v > maxBet) v = maxBet;
      if (balance > 0 && v > balance) v = balance;
      return Number(v.toFixed(decimals));
    },
    [balance, decimals, maxBet, minBet]
  );

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/games/history");
      const j = (await res.json()) as { ok: boolean; bets?: BetRow[] };
      if (j.ok && j.bets) setBets(j.bets);
    } catch {
      /* history is best-effort */
    }
  }, []);

  const loadSeed = useCallback(async () => {
    setSeedState("loading");
    try {
      const res = await fetch("/api/games/seed");
      const j = (await res.json()) as { ok: boolean; seed?: SeedView };
      if (j.ok && j.seed) {
        setSeed(j.seed);
        setSeedState("ready");
      } else {
        setSeedState("error");
      }
    } catch {
      setSeedState("error");
    }
  }, []);

  useEffect(() => {
    void loadSeed();
    void loadHistory();
  }, [loadSeed, loadHistory]);

  // Announce a win once the reels finish, not while they are still spinning.
  useEffect(() => {
    if (spin.phase !== "idle") return;
    const r = resultRef.current;
    resultRef.current = null;
    if (r && r.won && r.multiplier > 1) {
      push(`Win ${formatCrypto(r.payout, decimals)} ${symbol} at ${r.multiplier.toFixed(2)}x`, "success");
    }
  }, [spin.phase, push, decimals, symbol]);

  async function bet() {
    if (spinning || bettingRef.current) return;
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) {
      push("Enter a stake above zero", "error");
      return;
    }
    if (belowMin) {
      push(`Minimum stake is ${fmt(minBet)} ${symbol}`, "error");
      return;
    }
    if (aboveMax) {
      push(`Maximum stake is ${fmt(maxBet)} ${symbol}`, "error");
      return;
    }
    if (overBalance) {
      push("Stake is above your balance", "error");
      return;
    }
    bettingRef.current = true;
    readyRef.current = false;
    setResult(null);
    setRunId((n) => n + 1);
    try {
      const res = await fetch("/api/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: id, stake: stakeNum, params }),
      });
      const j = (await res.json()) as PlayResponse | { ok: false; error: string };
      if (!j.ok) {
        push((j as { error: string }).error || "Bet failed", "error");
        readyRef.current = true;
        return;
      }
      const r = j as PlayResponse;
      setBalance(r.balance);
      setSeed((s) => ({ ...r.seed, previous: r.seed.previous ?? s?.previous ?? null }));
      resultRef.current = r;
      setResult(r);
      readyRef.current = true;
      void loadHistory();
    } catch {
      push("Network error", "error");
      readyRef.current = true;
    } finally {
      bettingRef.current = false;
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div className="panel rounded-2xl p-5 sm:p-6">
          <Board id={id} params={params} set={set} last={result} symbol={symbol} decimals={decimals} spin={spin} />
        </div>

        <div className="panel rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="stake" className="mb-1.5 block text-sm font-semibold text-slate-300">
                Stake ({symbol})
              </label>
              <input
                id="stake"
                type="number"
                min={0}
                step="any"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                aria-invalid={belowMin || aboveMax || overBalance}
                aria-describedby="stake-help"
                className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
              />
              <p
                id="stake-help"
                className={cn(
                  "mt-1.5 text-xs",
                  belowMin || aboveMax || overBalance ? "text-red-300" : "text-slate-400"
                )}
              >
                {balance <= 0 ? (
                  <>
                    No balance to stake.{" "}
                    <Link
                      href="/#plans"
                      className="font-semibold text-gold-300 underline underline-offset-2 hover:text-gold-200"
                    >
                      View plans
                    </Link>
                    .
                  </>
                ) : belowMin ? (
                  `Minimum stake is ${fmt(minBet)} ${symbol}.`
                ) : aboveMax ? (
                  `Maximum stake is ${fmt(maxBet)} ${symbol}.`
                ) : overBalance ? (
                  "Stake is above your balance."
                ) : minBet > 0 || maxBet > 0 ? (
                  `Allowed ${minBet > 0 ? fmt(minBet) : "0"} to ${maxBet > 0 ? fmt(maxBet) : "no cap"} ${symbol}.`
                ) : (
                  `Balance ${fmt(balance)} ${symbol}.`
                )}
              </p>
            </div>
            <Button
              size="lg"
              disabled={spinning || !valid}
              onClick={bet}
              className="sm:w-40"
              aria-busy={spinning}
            >
              {spinning ? <Loader2 className="animate-spin" size={18} /> : `Bet ${valid ? formatCrypto(stakeNum, decimals) : ""}`}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-400">
              Balance{" "}
              <span className="font-display font-bold tabular-nums text-white">
                {fmt(shownBalance)} {symbol}
              </span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStake(String(clampStake((Number(stake) || 0) / 2)))}
                className="tap inline-flex h-11 min-w-11 items-center justify-center rounded-lg bg-ink-900/80 px-3 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              >
                1/2
              </button>
              <button
                type="button"
                onClick={() => setStake(String(clampStake((Number(stake) || 0) * 2)))}
                className="tap inline-flex h-11 min-w-11 items-center justify-center rounded-lg bg-ink-900/80 px-3 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              >
                2x
              </button>
              <button
                type="button"
                onClick={() => setStake(String(clampStake(balance)))}
                className="tap inline-flex h-11 min-w-11 items-center justify-center rounded-lg bg-ink-900/80 px-3 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              >
                Max
              </button>
            </div>
          </div>

          {result && !spinning && (
            <div
              className={cn(
                "mt-4 animate-rise rounded-xl px-4 py-3 text-sm ring-1",
                result.won
                  ? "animate-win-glow bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
                  : "bg-red-500/10 text-red-200 ring-red-500/30"
              )}
            >
              {result.won
                ? `Won ${fmt(result.payout)} ${symbol} at ${result.multiplier.toFixed(2)}x`
                : `No win this round, ${fmt(result.stake)} ${symbol} staked.`}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <SeedManager seed={seed} state={seedState} onSeed={setSeed} onRetry={loadSeed} />
        <div className="panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-white">{name} history</h2>
            <span className="text-xs text-slate-400">Recent</span>
          </div>
          <p className="mb-3 text-xs text-slate-400">{blurb}</p>
          <ul className="space-y-1.5">
            {rounds.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-400">
                No rounds here yet. Your first bet lands in this list.
              </li>
            )}
            {rounds.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-900/60 px-3 py-2 text-xs">
                <span className="flex-1 truncate text-slate-300">
                  #{b.nonce}
                </span>
                <span className={cn("font-display font-bold", b.won ? "text-emerald-300" : "text-slate-400")}>
                  {b.multiplier.toFixed(2)}x
                </span>
                <span
                  className={cn(
                    "w-24 text-right font-mono tabular-nums",
                    b.won ? "text-emerald-300" : "text-slate-400"
                  )}
                >
                  {b.won ? "+" : "-"}
                  {formatCrypto(b.won ? b.payout : b.stake, decimals)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
