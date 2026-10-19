"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, formatCrypto } from "@/lib/utils";
import { useCountUp } from "./anim";
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

export function GameView({
  id,
  name,
  blurb,
  symbol,
  decimals,
  balance: initialBalance,
}: {
  id: string;
  name: string;
  blurb: string;
  symbol: string;
  decimals: number;
  balance: number;
}) {
  const { push } = useToast();
  const [balance, setBalance] = useState(initialBalance);
  const [seed, setSeed] = useState<SeedView | null>(null);
  const [stake, setStake] = useState("1");
  const [params, setParams] = useState<Record<string, unknown>>(() => DEFAULTS[id] ?? {});
  const [pending, setPending] = useState<PlayResponse | null>(null);
  const [result, setResult] = useState<PlayResponse | null>(null);
  const [seq, setSeq] = useState(0);
  const [busy, setBusy] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [bets, setBets] = useState<BetRow[]>([]);

  const pendingRef = useRef<PlayResponse | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((patch: Record<string, unknown>) => setParams((p) => ({ ...p, ...patch })), []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/games/history");
      const j = (await res.json()) as { ok: boolean; bets?: BetRow[] };
      if (j.ok && j.bets) setBets(j.bets);
    } catch {
      /* history is best-effort */
    }
  }, []);

  const settle = useCallback(() => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    const r = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    setAnimating(false);
    if (r) setResult(r);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/games/seed");
        const j = (await res.json()) as { ok: boolean; seed?: SeedView };
        if (alive && j.ok && j.seed) setSeed(j.seed);
      } catch {
        /* seed panel will show loading */
      }
    })();
    void loadHistory();
    return () => {
      alive = false;
    };
  }, [loadHistory]);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  async function bet() {
    const stakeNum = Number(stake);
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) {
      push("Enter a stake above zero", "error");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: id, stake: stakeNum, params }),
      });
      const j = (await res.json()) as PlayResponse | { ok: false; error: string };
      if (!j.ok) {
        push((j as { error: string }).error || "Bet failed", "error");
        return;
      }
      const r = j as PlayResponse;
      setBalance(r.balance);
      setSeed((s) => ({ ...r.seed, previous: r.seed.previous ?? s?.previous ?? null }));
      pendingRef.current = r;
      setPending(r);
      setAnimating(true);
      setSeq((n) => n + 1);
      settleTimer.current = setTimeout(settle, 3600);
      void loadHistory();
      if (r.won && r.multiplier > 1) {
        push(`Win ${formatCrypto(r.payout, decimals)} ${symbol} at ${r.multiplier}x`, "success");
      }
    } catch {
      push("Network error", "error");
    } finally {
      setBusy(false);
    }
  }

  const stakeNum = Number(stake);
  const valid = Number.isFinite(stakeNum) && stakeNum > 0;
  const spinning = busy || animating;
  const shownBalance = useCountUp(balance, 650);
  const fmt = useMemo(() => (v: number) => formatCrypto(v, decimals), [decimals]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div className="panel rounded-2xl p-5 sm:p-6">
          <Board
            id={id}
            params={params}
            set={set}
            last={pending ?? result}
            symbol={symbol}
            decimals={decimals}
            seq={seq}
            onSettled={settle}
          />
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
                className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
              />
            </div>
            <Button size="lg" disabled={spinning || !valid} onClick={bet} className="sm:w-40">
              {spinning ? <Loader2 className="animate-spin" size={18} /> : `Bet ${valid ? formatCrypto(stakeNum, decimals) : ""}`}
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-400">
              Balance{" "}
              <span className="font-display font-bold tabular-nums text-white">
                {fmt(shownBalance)} {symbol}
              </span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStake((s) => String(Math.max(0, Number(s) / 2 || 0)))}
                className="tap rounded-lg bg-ink-900/80 px-3 py-1 text-xs font-semibold text-slate-300 ring-1 ring-white/10 hover:text-white"
              >
                1/2
              </button>
              <button
                type="button"
                onClick={() => setStake((s) => String(Number(s) * 2 || 0))}
                className="tap rounded-lg bg-ink-900/80 px-3 py-1 text-xs font-semibold text-slate-300 ring-1 ring-white/10 hover:text-white"
              >
                2x
              </button>
              <button
                type="button"
                onClick={() => setStake(String(balance))}
                className="tap rounded-lg bg-ink-900/80 px-3 py-1 text-xs font-semibold text-slate-300 ring-1 ring-white/10 hover:text-white"
              >
                Max
              </button>
            </div>
          </div>

          {result && !animating && (
            <div
              className={cn(
                "mt-4 animate-rise rounded-xl px-4 py-3 text-sm ring-1",
                result.won
                  ? "animate-win-glow bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
                  : "bg-red-500/10 text-red-200 ring-red-500/30"
              )}
            >
              {result.won
                ? `Won ${fmt(result.payout)} ${symbol} at ${result.multiplier}x`
                : `No win this round, ${fmt(result.stake)} ${symbol} staked.`}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <SeedManager seed={seed} onSeed={setSeed} />
        <div className="panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-white">{name} history</h2>
            <span className="text-xs text-slate-500">Last 25</span>
          </div>
          <p className="mb-3 text-xs text-slate-500">{blurb}</p>
          <ul className="space-y-1.5">
            {bets.length === 0 && <li className="text-xs text-slate-500">No rounds yet.</li>}
            {bets.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-900/60 px-3 py-2 text-xs">
                <span className="flex-1 truncate text-slate-400">
                  {b.game} <span className="text-slate-600">#{b.nonce}</span>
                </span>
                <span className={cn("font-display font-bold", b.won ? "text-emerald-300" : "text-slate-400")}>
                  {b.multiplier.toFixed(2)}x
                </span>
                <span className="w-20 text-right tabular-nums text-slate-300">{formatCrypto(b.payout, decimals)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
