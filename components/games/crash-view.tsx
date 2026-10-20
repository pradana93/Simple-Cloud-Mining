"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, formatCrypto } from "@/lib/utils";
import { crashMultiplierAt, crashTimeMs } from "@/lib/games/crash";
import { useCountUp } from "./anim";
import { SeedManager } from "./seed-manager";
import type { BetRow, SeedView } from "./types";

type CrashStatus = "active" | "cashed" | "crashed";

type CrashRound = {
  roundId: number;
  status: CrashStatus;
  startedAt: string;
  stake: number;
  live: number;
  crashAt: number | null;
  cashout: number | null;
  payout: number;
};

type StateReply = {
  ok: boolean;
  active?: boolean;
  round?: CrashRound;
  last?: CrashRound | null;
  balance?: number;
  seed?: SeedView;
  paid?: number;
  serverNow?: string;
  error?: string;
};

const POLL_MS = 400;

function strokeFor(status: CrashStatus | null): string {
  if (status === "cashed") return "#34d399";
  if (status === "crashed") return "#f87171";
  return "#f5b301";
}

function CrashChart({
  live,
  endMs,
  active,
  round,
  empty,
}: {
  live: number;
  endMs: number;
  active: boolean;
  round: CrashRound | null;
  empty: boolean;
}) {
  const W = 640;
  const H = 300;
  const padL = 14;
  const padR = 14;
  const padT = 18;
  const padB = 30;
  const w = W - padL - padR;
  const h = H - padT - padB;

  const status = round?.status ?? null;
  const end = active ? live : round ? round.live : 1;
  const ghostMs =
    !active && round?.status === "cashed" && round.crashAt
      ? Math.min(crashTimeMs(round.crashAt), 60000)
      : 0;
  const xMax = Math.max(6000, endMs * 1.12, ghostMs * 1.04);
  const visualMax = Math.max(end, ghostMs > 0 ? (round?.crashAt ?? end) : end);
  const yMax = Math.max(2, Math.ceil(visualMax * 1.22 * 2) / 2);
  const color = strokeFor(status);

  const toX = (t: number) => padL + (Math.min(t, xMax) / xMax) * w;
  const toY = (m: number) => padT + h - ((Math.min(m, yMax) - 1) / (yMax - 1)) * h;

  const points: string[] = [];
  const count = 96;
  if (!empty) {
    for (let i = 0; i <= count; i++) {
      const t = (endMs * i) / count;
      const m = crashMultiplierAt(t);
      points.push(`${toX(t).toFixed(1)} ${toY(Math.min(m, end)).toFixed(1)}`);
    }
  }
  const line = points.length ? `M ${points.join(" L ")}` : "";
  const area = points.length
    ? `${line} L ${toX(endMs).toFixed(1)} ${(padT + h).toFixed(1)} L ${padL} ${(padT + h).toFixed(1)} Z`
    : "";

  const ghost: string[] = [];
  if (ghostMs > 0) {
    const from = crashTimeMs(round?.cashout ?? 1);
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = from + ((ghostMs - from) * i) / steps;
      ghost.push(`${toX(t).toFixed(1)} ${toY(crashMultiplierAt(t)).toFixed(1)}`);
    }
  }

  const yTicks = [1, 1 + (yMax - 1) / 2, yMax];
  const dotX = toX(endMs);
  const dotY = toY(end);
  const crashX = ghostMs > 0 ? toX(ghostMs) : dotX;
  const crashY = ghostMs > 0 ? toY(round?.crashAt ?? end) : dotY;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full sm:h-72"
        role="img"
        aria-label={
          empty
            ? "Multiplier chart, no round yet"
            : active
              ? `Multiplier chart, live at ${live.toFixed(2)} times`
              : round?.status === "cashed"
                ? `Multiplier chart, cashed out at ${(round.cashout ?? round.live).toFixed(2)} times`
                : `Multiplier chart, crashed at ${(round?.crashAt ?? end).toFixed(2)} times`
        }
      >
        {yTicks.map((m, i) => {
          const y = toY(m);
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.12)" strokeWidth={1} />
              <text x={padL} y={y - 5} fill="#94a3b8" fontSize={11}>
                {m.toFixed(2)}x
              </text>
            </g>
          );
        })}
        <line
          x1={padL}
          x2={W - padR}
          y1={padT + h}
          y2={padT + h}
          stroke="rgba(148,163,184,0.28)"
          strokeWidth={1}
        />
        <text x={padL} y={H - 8} fill="#94a3b8" fontSize={11}>
          0s
        </text>
        <text x={W - padR} y={H - 8} fill="#94a3b8" fontSize={11} textAnchor="end">
          {(xMax / 1000).toFixed(0)}s
        </text>

        {area && <path d={area} fill={color} opacity={0.1} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />}
        {ghost.length > 0 && (
          <path
            d={`M ${ghost.join(" L ")}`}
            fill="none"
            stroke="#f87171"
            strokeWidth={2}
            strokeDasharray="5 5"
            opacity={0.65}
          />
        )}

        {empty ? null : (
          <>
            <circle cx={dotX} cy={dotY} r={10} fill={color} opacity={0.2} />
            <circle cx={dotX} cy={dotY} r={4.5} fill={color} />
            {ghost.length > 0 && <circle cx={crashX} cy={crashY} r={4} fill="#f87171" />}
          </>
        )}
      </svg>

      {empty && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="rounded-full bg-ink-950/80 px-4 py-1.5 text-sm text-slate-400 ring-1 ring-white/10">
            Start a round to draw the line.
          </p>
        </div>
      )}
    </div>
  );
}

export function CrashView({
  symbol,
  decimals,
  balance: initialBalance,
  minBet = 0,
  maxBet = 0,
}: {
  symbol: string;
  decimals: number;
  balance: number;
  minBet?: number;
  maxBet?: number;
}) {
  const { push } = useToast();
  const [balance, setBalance] = useState(initialBalance);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [seed, setSeed] = useState<SeedView | null>(null);
  const [seedState, setSeedState] = useState<"loading" | "ready" | "error">("loading");
  const [stake, setStake] = useState(() => String(minBet > 0 ? minBet : 1));
  const [active, setActive] = useState<CrashRound | null>(null);
  const [round, setRound] = useState<CrashRound | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [skew, setSkew] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bets, setBets] = useState<BetRow[]>([]);
  const activeRef = useRef<CrashRound | null>(null);
  activeRef.current = active;

  const stakeNum = Number(stake);
  const belowMin = minBet > 0 && Number.isFinite(stakeNum) && stakeNum < minBet;
  const aboveMax = maxBet > 0 && Number.isFinite(stakeNum) && stakeNum > maxBet;
  const overBalance = Number.isFinite(stakeNum) && stakeNum > balance;
  const valid = Number.isFinite(stakeNum) && stakeNum > 0 && !belowMin && !aboveMax && !overBalance;
  const fmt = useMemo(() => (v: number) => formatCrypto(v, decimals), [decimals]);
  const shownBalance = useCountUp(balance, 650);
  const rounds = useMemo(() => bets.filter((b) => b.game === "crash"), [bets]);

  const elapsedMs = active ? Math.max(0, now + skew - Date.parse(active.startedAt)) : 0;
  const live = active ? crashMultiplierAt(elapsedMs) : 1;
  const display = active ? live : round ? round.live : 1;
  const endMs = active ? elapsedMs : round ? Math.min(crashTimeMs(round.live), 60000) : 0;

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

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/games/history");
      const j = (await res.json()) as { ok: boolean; bets?: BetRow[] };
      if (j.ok && j.bets) setBets(j.bets);
    } catch {
      /* history is best-effort */
    }
  }, []);

  const loadState = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/games/crash");
      const j = (await res.json()) as StateReply;
      if (!j.ok) {
        setPhase("error");
        return;
      }
      if (j.serverNow) {
        const t = Date.parse(j.serverNow);
        if (Number.isFinite(t)) setSkew(t - Date.now());
      }
      if (typeof j.balance === "number") setBalance(j.balance);
      if (j.active && j.round) {
        setActive(j.round);
        setRound(null);
        setNow(Date.now());
      } else {
        setActive(null);
        setRound(j.last ?? null);
      }
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void loadState();
    void loadSeed();
    void loadHistory();
  }, [loadState, loadSeed, loadHistory]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 32) {
        last = t;
        setNow(Date.now());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  useEffect(() => {
    const id = active?.roundId;
    if (!id) return;
    let alive = true;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/games/crash/status?id=${id}`);
        const j = (await res.json()) as StateReply;
        if (!alive || !j.ok || !j.round) return;
        if (j.serverNow) {
          const t = Date.parse(j.serverNow);
          if (Number.isFinite(t)) setSkew(t - Date.now());
        }
        setNow(Date.now());
        if (typeof j.balance === "number") setBalance(j.balance);
        if (j.round.status !== "active") {
          setActive(null);
          setRound(j.round);
          if (j.round.status === "crashed") push("The line crashed. Round over.", "error");
          void loadHistory();
          void loadSeed();
        }
      } catch {
        /* the next poll retries */
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active?.roundId, push, loadHistory, loadSeed]);

  async function start() {
    if (busy || !valid || phase !== "ready") return;
    setBusy(true);
    try {
      const res = await fetch("/api/games/crash/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake: stakeNum }),
      });
      const j = (await res.json()) as StateReply;
      if (!j.ok) {
        push(j.error || "Could not start the round", "error");
        if (typeof j.balance === "number") setBalance(j.balance);
        if (j.round) {
          setActive(j.round);
          setRound(null);
          setNow(Date.now());
        }
        return;
      }
      if (!j.round) {
        push("The round did not start", "error");
        return;
      }
      setRound(null);
      setActive(j.round);
      if (j.serverNow) {
        const t = Date.parse(j.serverNow);
        if (Number.isFinite(t)) setSkew(t - Date.now());
      }
      if (typeof j.balance === "number") setBalance(j.balance);
      const nextSeed = j.seed;
      if (nextSeed) setSeed((s) => ({ ...nextSeed, previous: nextSeed.previous ?? s?.previous ?? null }));
      setNow(Date.now());
      void loadHistory();
    } catch {
      push("Network error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function cashout() {
    const current = activeRef.current;
    if (!current || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/games/crash/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: current.roundId }),
      });
      const j = (await res.json()) as StateReply;
      if (!j.ok || !j.round) {
        push(j.error || "The cashout was refused", "error");
        return;
      }
      if (j.serverNow) {
        const t = Date.parse(j.serverNow);
        if (Number.isFinite(t)) setSkew(t - Date.now());
      }
      if (typeof j.balance === "number") setBalance(j.balance);
      setActive(null);
      setRound(j.round);
      if (j.round.status === "cashed") {
        push(`Cashed out ${fmt(j.round.payout)} ${symbol}`, "success");
      } else {
        push("The line crashed before the cashout.", "error");
      }
      void loadHistory();
      void loadSeed();
    } catch {
      push("Network error", "error");
    } finally {
      setBusy(false);
    }
  }

  const status = active ? "active" : (round?.status ?? null);
  const liveColor =
    status === "cashed" ? "text-emerald-300" : status === "crashed" ? "text-red-300" : "text-gold-300";
  const paidMult = round && round.stake > 0 ? round.payout / round.stake : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div className="panel rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Live multiplier</p>
              <p className={cn("font-display text-5xl font-bold tabular-nums", liveColor)}>
                {display.toFixed(2)}x
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              {active ? (
                <>
                  <p className="font-semibold text-white">Round live</p>
                  <p className="mt-1">
                    Stake {fmt(active.stake)} {symbol}
                  </p>
                </>
              ) : round ? (
                <>
                  <p className={cn("font-semibold", round.status === "cashed" ? "text-emerald-300" : "text-red-300")}>
                    {round.status === "cashed" ? "Cashed out" : "Crashed"}
                  </p>
                  <p className="mt-1">
                    Crash point {round.crashAt == null ? "-" : `${round.crashAt.toFixed(2)}x`}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-white">Ready</p>
                  <p className="mt-1">Cash out before the crash.</p>
                </>
              )}
            </div>
          </div>

          {phase === "loading" ? (
            <div className="grid h-56 place-items-center rounded-xl bg-ink-950/60 ring-1 ring-white/5 sm:h-72">
              <p className="animate-pulse text-sm text-slate-400">Loading your last round</p>
            </div>
          ) : phase === "error" ? (
            <div className="grid h-56 place-items-center rounded-xl bg-ink-950/60 px-6 text-center ring-1 ring-white/5 sm:h-72">
              <div>
                <p className="text-sm text-red-200">Could not load the crash table.</p>
                <button
                  type="button"
                  onClick={() => void loadState()}
                  className="tap mt-3 inline-flex h-11 items-center rounded-lg border border-red-500/30 px-4 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className={cn("rounded-xl bg-ink-950/60 p-2 ring-1 ring-white/5", !active && round?.status === "crashed" && "animate-shake")}>
              <CrashChart
                live={live}
                endMs={endMs}
                active={Boolean(active)}
                round={round}
                empty={!active && !round}
              />
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            The line is drawn from the server start time. A cashout is settled against the server clock, so the
            paid multiplier can differ slightly from the frame you clicked. Site payout settings can adjust the
            final multiplier.
          </p>
        </div>

        <div className="panel rounded-2xl p-5 sm:p-6">
          {active ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-ink-900/60 px-4 py-3">
                  <p className="text-xs text-slate-400">Stake</p>
                  <p className="mt-0.5 font-mono tabular-nums text-slate-100">
                    {fmt(active.stake)} {symbol}
                  </p>
                </div>
                <div className="rounded-xl bg-ink-900/60 px-4 py-3">
                  <p className="text-xs text-slate-400">Cash value now</p>
                  <p className="mt-0.5 font-mono tabular-nums text-gold-300">
                    {fmt(active.stake * live)} {symbol}
                  </p>
                </div>
              </div>
              <Button size="lg" className="w-full" disabled={busy} onClick={cashout}>
                {busy ? <Loader2 className="animate-spin" size={18} /> : `Cash out at ${live.toFixed(2)}x`}
              </Button>
              <p className="text-center text-xs text-slate-400">
                The round crashes at a hidden point. If the line stops first, the stake is lost.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="crash-stake" className="mb-1.5 block text-sm font-semibold text-slate-300">
                    Stake ({symbol})
                  </label>
                  <input
                    id="crash-stake"
                    type="number"
                    min={0}
                    step="any"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    aria-invalid={belowMin || aboveMax || overBalance}
                    aria-describedby="crash-stake-help"
                    className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
                  />
                  <p
                    id="crash-stake-help"
                    className={cn("mt-1.5 text-xs", belowMin || aboveMax || overBalance ? "text-red-300" : "text-slate-400")}
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
                  disabled={busy || !valid || phase !== "ready"}
                  onClick={start}
                  className="sm:w-40"
                  aria-busy={busy}
                >
                  {busy ? <Loader2 className="animate-spin" size={18} /> : "Start round"}
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

              {round && (
                <div
                  role="status"
                  className={cn(
                    "animate-rise rounded-xl px-4 py-3 text-sm ring-1",
                    round.status === "cashed"
                      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
                      : "bg-red-500/10 text-red-200 ring-red-500/30"
                  )}
                >
                  {round.status === "cashed"
                    ? `Cashed out at ${(round.cashout ?? round.live).toFixed(2)}x. Paid ${fmt(round.payout)} ${symbol}${
                        paidMult > 0 ? ` (${paidMult.toFixed(2)}x after site settings)` : ""
                      }.`
                    : `Crashed at ${(round.crashAt ?? round.live).toFixed(2)}x. Stake of ${fmt(round.stake)} ${symbol} lost.`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <SeedManager seed={seed} state={seedState} onSeed={setSeed} onRetry={loadSeed} />
        <div className="panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-white">Crash history</h2>
            <span className="text-xs text-slate-400">Recent</span>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Each round is committed to your seed before it starts. Crash points are revealed after settle.
          </p>
          <ul className="space-y-1.5">
            {rounds.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-400">
                No crash rounds yet. Your first round lands in this list.
              </li>
            )}
            {rounds.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-900/60 px-3 py-2 text-xs">
                <span className="flex-1 truncate text-slate-300">#{b.nonce}</span>
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
