"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Loader2, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, formatCrypto } from "@/lib/utils";
import {
  AUTO_DEFAULTS,
  autoStopReason,
  nextAutoStake,
  parseAutoConfig,
  type AutoConfig,
  type AutoPlan,
} from "@/lib/games/auto";
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

// No fixed minimum spin. The landing starts as soon as the server result is
// ready; each board keeps a short object-specific landing so the result stays
// readable without making the player wait for a clock.
const LAND: Record<string, number> = {
  dice: 160,
  limbo: 180,
  coinflip: 240,
  wheel: 320,
  plinko: 380,
  keno: 240,
  roulette: 340,
  slots: 260,
};

const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-3 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25";

type AutoProgress = { done: number; rounds: number; profit: number; note: string | null };

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
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoCfg, setAutoCfg] = useState<AutoConfig>(AUTO_DEFAULTS);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoProgress, setAutoProgress] = useState<AutoProgress | null>(null);

  const readyRef = useRef(false);
  const resultRef = useRef<PlayResponse | null>(null);
  const bettingRef = useRef(false);
  const balanceRef = useRef(initialBalance);
  const autoRunningRef = useRef(false);
  const autoSessionRef = useRef(0);
  const autoCancelRef = useRef(false);
  const suppressWinToastRef = useRef(false);
  const betKeyRef = useRef<string | null>(null);

  const landMs = LAND[id] ?? 240;
  const spin = useSpin(runId, 0, landMs, readyRef);
  const spinning = spin.phase !== "idle";

  const set = useCallback((patch: Record<string, unknown>) => setParams((p) => ({ ...p, ...patch })), []);

  const stakeNum = Number(stake);
  const belowMin = minBet > 0 && Number.isFinite(stakeNum) && stakeNum < minBet;
  const aboveMax = maxBet > 0 && Number.isFinite(stakeNum) && stakeNum > maxBet;
  const overBalance = Number.isFinite(stakeNum) && stakeNum > balance;
  const valid = Number.isFinite(stakeNum) && stakeNum > 0 && !belowMin && !aboveMax && !overBalance;
  const fmt = useMemo(() => (v: number) => formatCrypto(v, decimals), [decimals]);
  const shownBalance = useCountUp(balance, 350);
  const rounds = useMemo(() => bets.filter((b) => b.game === id), [bets, id]);
  const autoParsed = useMemo(() => parseAutoConfig(autoCfg), [autoCfg]);
  const autoProfit = autoProgress?.profit ?? 0;
  const autoDone = autoProgress?.done ?? 0;
  const autoTotal = autoProgress?.rounds ?? (autoParsed.ok ? autoParsed.plan.rounds : 10);
  const autoPct = autoTotal > 0 ? Math.min(100, (autoDone / autoTotal) * 100) : 0;
  const profitLabel = `${autoProfit > 0 ? "+" : autoProfit < 0 ? "-" : ""}${fmt(Math.abs(autoProfit))} ${symbol}`;
  const profitTone =
    autoProfit > 0 ? "text-emerald-300" : autoProfit < 0 ? "text-red-300" : "text-slate-200";

  const clampStake = useCallback(
    (n: number, capBalance = balance) => {
      let v = Number.isFinite(n) && n > 0 ? n : minBet > 0 ? minBet : 0;
      if (minBet > 0 && v < minBet) v = minBet;
      if (maxBet > 0 && v > maxBet) v = maxBet;
      if (Number.isFinite(capBalance) && v > capBalance) v = capBalance;
      return Number(v.toFixed(decimals));
    },
    [balance, decimals, maxBet, minBet]
  );

  const stakeError = useCallback(
    (value: number): string | null => {
      if (!Number.isFinite(value) || value <= 0) return "Enter a stake above zero";
      if (minBet > 0 && value < minBet) return `Minimum stake is ${fmt(minBet)} ${symbol}`;
      if (maxBet > 0 && value > maxBet) return `Maximum stake is ${fmt(maxBet)} ${symbol}`;
      if (value > balanceRef.current) return "Stake is above your balance";
      return null;
    },
    [fmt, maxBet, minBet, symbol]
  );

  const loadHistory = useCallback(async () => {
    setHistoryState((state) => (state === "ready" ? state : "loading"));
    try {
      const res = await fetch("/api/games/history");
      const j = (await res.json()) as { ok: boolean; bets?: BetRow[] };
      if (j.ok && j.bets) {
        setBets(j.bets);
        setHistoryState("ready");
      } else {
        setHistoryState("error");
      }
    } catch {
      setHistoryState("error");
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

  // Announce a manual win once the object lands. Auto sessions report
  // cumulative P/L instead of one toast per round.
  useEffect(() => {
    if (spin.phase !== "idle") return;
    const r = resultRef.current;
    resultRef.current = null;
    if (r && !autoRunningRef.current && !suppressWinToastRef.current && r.won && r.multiplier > 1) {
      push(`Win ${formatCrypto(r.payout, decimals)} ${symbol} at ${r.multiplier.toFixed(2)}x`, "success");
    }
  }, [spin.phase, push, decimals, symbol]);

  useEffect(() => {
    return () => {
      autoSessionRef.current += 1;
      autoCancelRef.current = true;
      autoRunningRef.current = false;
    };
  }, []);

  function patchAuto(patch: Partial<AutoConfig>) {
    setAutoCfg((c) => ({ ...c, ...patch }));
    setAutoProgress((p) => (p ? { ...p, note: null } : p));
  }

  const placeBet = useCallback(
    async (betStake: number, betParams: Record<string, unknown>): Promise<PlayResponse | null> => {
      if (bettingRef.current) return null;
      const error = stakeError(betStake);
      if (error) {
        push(error, "error");
        return null;
      }
      bettingRef.current = true;
      readyRef.current = false;
      setResult(null);
      setRunId((n) => n + 1);
      const key = betKeyRef.current ?? crypto.randomUUID();
      betKeyRef.current = key;
      try {
        const res = await fetch("/api/games/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: id,
            stake: betStake,
            params: betParams,
            idempotencyKey: key,
          }),
        });
        const j = (await res.json()) as PlayResponse | { ok: false; error: string };
        if (!j.ok) {
          betKeyRef.current = null;
          push((j as { error: string }).error || "Bet failed", "error");
          readyRef.current = true;
          return null;
        }
        betKeyRef.current = null;
        const r = j as PlayResponse;
        balanceRef.current = r.balance;
        setBalance(r.balance);
        setSeed((s) => ({ ...r.seed, previous: r.seed.previous ?? s?.previous ?? null }));
        resultRef.current = r;
        setResult(r);
        readyRef.current = true;
        void loadHistory();
        return r;
      } catch {
        push("Network error", "error");
        readyRef.current = true;
        return null;
      } finally {
        bettingRef.current = false;
      }
    },
    [id, loadHistory, push, stakeError]
  );

  async function runAuto(
    session: number,
    plan: AutoPlan,
    baseStake: number,
    betParams: Record<string, unknown>
  ) {
    let currentStake = baseStake;
    let profit = 0;
    let note: string | null = null;

    for (let i = 0; i < plan.rounds; i++) {
      if (autoSessionRef.current !== session || autoCancelRef.current) {
        note = "Auto stopped.";
        break;
      }
      const r = await placeBet(currentStake, betParams);
      if (autoSessionRef.current !== session) return;
      if (!r) {
        note = "Auto stopped before the next bet could be placed.";
        break;
      }
      profit = Number((profit + (r.payout - r.stake)).toFixed(decimals));
      setAutoProgress({ done: i + 1, rounds: plan.rounds, profit, note: null });

      const stop = autoStopReason(plan, profit, fmt, symbol);
      if (stop) {
        note = stop;
        break;
      }
      if (i + 1 >= plan.rounds) {
        note = `Auto finished after ${plan.rounds} bet${plan.rounds === 1 ? "" : "s"}.`;
        break;
      }

      currentStake = nextAutoStake({
        current: currentStake,
        base: baseStake,
        won: r.won,
        plan,
        minBet,
        maxBet,
        balance: r.balance,
        decimals,
      });
      if (currentStake <= 0 || (minBet > 0 && currentStake < minBet)) {
        note = "Auto stopped: balance is below the minimum stake.";
        break;
      }
      setStake(String(currentStake));
      await new Promise((resolve) => setTimeout(resolve, landMs + 80));
    }

    if (autoSessionRef.current !== session) return;
    autoRunningRef.current = false;
    setAutoRunning(false);
    setAutoProgress((p) => (p ? { ...p, note } : { done: 0, rounds: plan.rounds, profit, note }));
  }

  function startAuto() {
    if (autoRunningRef.current || spinning || bettingRef.current) return;
    const betProblem = stakeError(stakeNum);
    if (betProblem) {
      push(betProblem, "error");
      return;
    }
    if (!autoParsed.ok) {
      push(autoParsed.error, "error");
      return;
    }

    const session = autoSessionRef.current + 1;
    autoSessionRef.current = session;
    autoCancelRef.current = false;
    suppressWinToastRef.current = true;
    autoRunningRef.current = true;
    setAutoRunning(true);
    setAutoOpen(true);
    setAutoProgress({ done: 0, rounds: autoParsed.plan.rounds, profit: 0, note: null });
    setResult(null);
    void runAuto(session, autoParsed.plan, stakeNum, params);
  }

  function stopAuto() {
    if (!autoRunningRef.current) return;
    autoCancelRef.current = true;
    autoSessionRef.current += 1;
    autoRunningRef.current = false;
    setAutoRunning(false);
    setAutoProgress((p) => (p ? { ...p, note: "Auto stopped." } : p));
  }

  async function bet() {
    if (spinning || autoRunningRef.current || bettingRef.current) return;
    suppressWinToastRef.current = false;
    await placeBet(stakeNum, params);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div className="panel rounded-2xl p-5 sm:p-6">
          <fieldset
            disabled={autoRunning}
            className="m-0 min-w-0 border-0 p-0 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50 [&_input:disabled]:opacity-60 [&_select:disabled]:opacity-60"
          >
            <legend className="sr-only">Game settings</legend>
            <Board id={id} params={params} set={set} last={result} symbol={symbol} decimals={decimals} spin={spin} />
          </fieldset>
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
                disabled={autoRunning}
                aria-invalid={belowMin || aboveMax || overBalance}
                aria-describedby="stake-help"
                className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25 disabled:cursor-not-allowed disabled:opacity-60"
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
              disabled={spinning || autoRunning || !valid}
              onClick={bet}
              className="sm:w-40"
              aria-busy={spinning}
            >
              {spinning ? (
                <Loader2 className="animate-spin" size={18} />
              ) : autoRunning ? (
                "Auto running"
              ) : (
                `Bet ${valid ? formatCrypto(stakeNum, decimals) : ""}`
              )}
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
                disabled={autoRunning}
                className="tap inline-flex h-11 min-w-11 items-center justify-center rounded-lg bg-ink-900/80 px-3 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                1/2
              </button>
              <button
                type="button"
                onClick={() => setStake(String(clampStake((Number(stake) || 0) * 2)))}
                disabled={autoRunning}
                className="tap inline-flex h-11 min-w-11 items-center justify-center rounded-lg bg-ink-900/80 px-3 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                2x
              </button>
              <button
                type="button"
                onClick={() => setStake(String(clampStake(balance)))}
                disabled={autoRunning}
                className="tap inline-flex h-11 min-w-11 items-center justify-center rounded-lg bg-ink-900/80 px-3 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Max
              </button>
            </div>
          </div>

          {result && spin.phase !== "spin" && (
            <div
              role="status"
              aria-live={autoRunning ? "off" : "polite"}
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

          <div className="mt-4 border-t border-slate-800/80 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {autoRunning ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Repeat2 size={16} className="text-gold-300" aria-hidden />
                  Auto bet
                  <span className="font-display text-xs font-bold text-gold-300">
                    {autoDone}/{autoTotal}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAutoOpen((v) => !v)}
                  aria-expanded={autoOpen}
                  aria-controls="auto-bet-panel"
                  className="tap inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  <Repeat2 size={16} className="text-gold-300" aria-hidden />
                  Auto bet
                  <ChevronDown
                    size={15}
                    className={cn("transition-transform", autoOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
              )}
              {autoRunning && (
                <Button type="button" variant="outline" size="sm" onClick={stopAuto}>
                  Stop auto
                </Button>
              )}
            </div>

            {autoOpen && (
              <div
                id="auto-bet-panel"
                role="group"
                aria-labelledby="auto-bet-heading"
                className="mt-3 rounded-xl bg-ink-900/60 p-3 ring-1 ring-white/10 sm:p-4"
              >
                <h3 id="auto-bet-heading" className="mb-3 font-display text-sm font-bold text-white">
                  {autoRunning ? "Auto session" : "Auto settings"}
                </h3>

                {autoRunning ? (
                  <div role="status" aria-live="polite" className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-300">
                        Completed <span className="font-display font-bold text-white">{autoDone}</span> of{" "}
                        <span className="font-display font-bold text-white">{autoTotal}</span>
                      </span>
                      <span className="text-slate-300">
                        P/L{" "}
                        <span className={cn("font-display font-bold tabular-nums", profitTone)}>{profitLabel}</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-800" aria-hidden>
                      <div
                        className="h-full rounded-full bg-gold-500 transition-[width] duration-300"
                        style={{ width: `${autoPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Stake {fmt(stakeNum)} {symbol}. Settings lock while auto runs.
                    </p>
                  </div>
                ) : (
                  <>
                    {autoProgress?.note && (
                      <p
                        role="status"
                        aria-live="polite"
                        className="mb-3 rounded-lg bg-ink-950/70 px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10"
                      >
                        {autoProgress.note}
                      </p>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="auto-rounds"
                          className="mb-1.5 block text-xs font-semibold text-slate-300"
                        >
                          Number of bets
                        </label>
                        <input
                          id="auto-rounds"
                          type="number"
                          min={1}
                          max={100}
                          step={1}
                          inputMode="numeric"
                          value={autoCfg.rounds}
                          onChange={(e) => patchAuto({ rounds: e.target.value })}
                          aria-describedby="auto-help"
                          className={FIELD_CLASS}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="auto-stop-profit"
                          className="mb-1.5 block text-xs font-semibold text-slate-300"
                        >
                          Stop on profit ({symbol})
                        </label>
                        <input
                          id="auto-stop-profit"
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={autoCfg.stopProfit}
                          onChange={(e) => patchAuto({ stopProfit: e.target.value })}
                          aria-describedby="auto-help"
                          className={FIELD_CLASS}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="auto-stop-loss"
                          className="mb-1.5 block text-xs font-semibold text-slate-300"
                        >
                          Stop on loss ({symbol})
                        </label>
                        <input
                          id="auto-stop-loss"
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={autoCfg.stopLoss}
                          onChange={(e) => patchAuto({ stopLoss: e.target.value })}
                          aria-describedby="auto-help"
                          className={FIELD_CLASS}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="auto-win-rule"
                          className="mb-1.5 block text-xs font-semibold text-slate-300"
                        >
                          After a win
                        </label>
                        <select
                          id="auto-win-rule"
                          value={autoCfg.onWin}
                          onChange={(e) =>
                            patchAuto({ onWin: e.target.value === "increase" ? "increase" : "reset" })
                          }
                          aria-describedby="auto-help"
                          className={FIELD_CLASS}
                        >
                          <option value="reset">Reset to start stake</option>
                          <option value="increase">Increase stake</option>
                        </select>
                      </div>

                      {autoCfg.onWin === "increase" && (
                        <div>
                          <label
                            htmlFor="auto-win-increase"
                            className="mb-1.5 block text-xs font-semibold text-slate-300"
                          >
                            Win increase (%)
                          </label>
                          <input
                            id="auto-win-increase"
                            type="number"
                            min={0}
                            max={100}
                            step="any"
                            inputMode="decimal"
                            value={autoCfg.winIncrease}
                            onChange={(e) => patchAuto({ winIncrease: e.target.value })}
                            aria-describedby="auto-help"
                            className={FIELD_CLASS}
                          />
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="auto-loss-rule"
                          className="mb-1.5 block text-xs font-semibold text-slate-300"
                        >
                          After a loss
                        </label>
                        <select
                          id="auto-loss-rule"
                          value={autoCfg.onLoss}
                          onChange={(e) =>
                            patchAuto({ onLoss: e.target.value === "increase" ? "increase" : "reset" })
                          }
                          aria-describedby="auto-help"
                          className={FIELD_CLASS}
                        >
                          <option value="reset">Reset to start stake</option>
                          <option value="increase">Increase stake</option>
                        </select>
                      </div>

                      {autoCfg.onLoss === "increase" && (
                        <div>
                          <label
                            htmlFor="auto-loss-increase"
                            className="mb-1.5 block text-xs font-semibold text-slate-300"
                          >
                            Loss increase (%)
                          </label>
                          <input
                            id="auto-loss-increase"
                            type="number"
                            min={0}
                            max={100}
                            step="any"
                            inputMode="decimal"
                            value={autoCfg.lossIncrease}
                            onChange={(e) => patchAuto({ lossIncrease: e.target.value })}
                            aria-describedby="auto-help"
                            className={FIELD_CLASS}
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <p
                        id="auto-help"
                        aria-live="polite"
                        className={cn("text-xs", autoParsed.ok ? "text-slate-400" : "text-red-300")}
                      >
                        {autoParsed.ok
                          ? "0 turns a stop target off. Stops compare session P/L; the game settings lock when auto starts."
                          : autoParsed.error}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={startAuto}
                        disabled={!autoParsed.ok || !valid || spinning}
                        className="w-full sm:w-auto"
                      >
                        Start auto
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <SeedManager seed={seed} state={seedState} onSeed={setSeed} onRetry={loadSeed} />
        <div className="panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-white">{name} history</h2>
            <Link
              href="/games/verify"
              className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-gold-300 underline underline-offset-2 hover:text-gold-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              Verify <ArrowUpRight size={12} />
            </Link>
          </div>
          <p className="mb-3 text-xs text-slate-400">{blurb}</p>
          {historyState === "error" && rounds.length > 0 && (
            <p className="mb-2 text-xs text-red-300">Could not refresh history.</p>
          )}
          <ul className="space-y-1.5" aria-busy={historyState === "loading"}>
            {historyState === "loading" && rounds.length === 0 && (
              <li className="space-y-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 animate-pulse rounded-lg bg-ink-900/60" />
                ))}
              </li>
            )}
            {historyState === "error" && rounds.length === 0 && (
              <li className="rounded-lg bg-red-500/10 px-3 py-3 ring-1 ring-red-500/30">
                <p className="text-xs text-red-200">Could not load history.</p>
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  className="tap mt-2 inline-flex h-11 items-center rounded-lg border border-red-500/30 px-4 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  Retry
                </button>
              </li>
            )}
            {historyState === "ready" && rounds.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-400">
                No rounds here yet. Your first bet lands in this list.
              </li>
            )}
            {rounds.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/games/verify?bet=bet:${b.id}&game=${id}`}
                  title={`Verify round ${b.nonce}`}
                  aria-label={`Verify round ${b.nonce}, ${b.won ? "won" : "lost"} ${formatCrypto(
                    b.won ? b.payout : b.stake,
                    decimals
                  )} ${symbol}`}
                  className="tap group flex min-h-11 items-center justify-between gap-2 rounded-lg bg-ink-900/60 px-3 py-2 text-xs ring-1 ring-transparent transition-colors hover:bg-ink-800 hover:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  <span className="flex-1 truncate text-slate-300 group-hover:text-white">#{b.nonce}</span>
                  <span className={cn("font-display font-bold", b.won ? "text-emerald-300" : "text-slate-400")}>
                    {b.multiplier.toFixed(2)}x
                  </span>
                  <span
                    className={cn(
                      "w-20 text-right font-mono tabular-nums",
                      b.won ? "text-emerald-300" : "text-slate-400"
                    )}
                  >
                    {b.won ? "+" : "-"}
                    {formatCrypto(b.won ? b.payout : b.stake, decimals)}
                  </span>
                  <ArrowUpRight
                    size={12}
                    className="shrink-0 text-slate-500 group-hover:text-gold-300"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
