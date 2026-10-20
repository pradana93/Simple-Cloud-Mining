"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bomb, Gem, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, formatCrypto } from "@/lib/utils";
import { useCountUp } from "./anim";
import { MINES_MAX, MINES_TILES } from "@/lib/games/mines";

type Play = {
  ok: boolean;
  roundId: number;
  mineCount: number;
  revealed: number[];
  multiplier: number;
  status: "active" | "busted" | "cashed";
  payout: number;
  balance: number;
  mines?: number[];
  nextMultiplier: number;
  stake?: number;
  error?: string;
};

type Active = {
  roundId: number;
  mineCount: number;
  revealed: number[];
  multiplier: number;
  nextMultiplier: number;
  stake: number;
};

export function MinesView({
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
  const [mineCount, setMineCount] = useState(3);
  const [stake, setStake] = useState(() => String(minBet > 0 ? minBet : 1));
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const [mines, setMines] = useState<number[]>([]);
  const [done, setDone] = useState<null | "busted" | "cashed">(null);
  const [payout, setPayout] = useState(0);

  const apply = useCallback((r: Play) => {
    setBalance(r.balance);
    setActive({
      roundId: r.roundId,
      mineCount: r.mineCount,
      revealed: r.revealed,
      multiplier: r.multiplier,
      nextMultiplier: r.nextMultiplier,
      stake: r.stake ?? Number(stake),
    });
    if (r.mines) setMines(r.mines);
    setPayout(r.payout);
    if (r.status === "busted" || r.status === "cashed") {
      setDone(r.status);
      setActive(null);
      if (r.status === "busted") push("Hit a mine. Round over.", "error");
      else push(`Cashed out ${formatCrypto(r.payout, decimals)} ${symbol}`, "success");
    }
  }, [decimals, push, stake, symbol]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/games/mines");
        const j = (await res.json()) as
          | ({ ok: true; active: true; balance: number } & Active)
          | { ok: true; active: false; balance: number };
        if (!alive || !j.ok) return;
        setBalance(j.balance);
        if (j.active) {
          setActive({
            roundId: j.roundId,
            mineCount: j.mineCount,
            revealed: j.revealed,
            multiplier: j.multiplier,
            nextMultiplier: j.nextMultiplier,
            stake: j.stake,
          });
          setStake(String(j.stake));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function post(path: string, body: Record<string, unknown>): Promise<Play | null> {
    setBusy(true);
    try {
      const res = await fetch(`/api/games/mines/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as Play;
      if (!j.ok) {
        push(j.error || "That move was refused", "error");
        if (j.error === "Finish your open round first") {
          const reload = (await fetch("/api/games/mines").then((r) => r.json())) as {
            active: boolean;
          } & Partial<Active>;
          if (reload.active) setActive(reload as Active);
        }
        return null;
      }
      return j;
    } catch {
      push("Network error", "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const s = Number(stake);
    if (!Number.isFinite(s) || s <= 0) {
      push("Enter a stake above zero", "error");
      return;
    }
    if (minBet > 0 && s < minBet) {
      push(`Minimum stake is ${formatCrypto(minBet, decimals)} ${symbol}`, "error");
      return;
    }
    if (maxBet > 0 && s > maxBet) {
      push(`Maximum stake is ${formatCrypto(maxBet, decimals)} ${symbol}`, "error");
      return;
    }
    if (s > balance) {
      push("Stake is above your balance", "error");
      return;
    }
    setDone(null);
    setMines([]);
    const r = await post("start", { stake: s, mines: mineCount });
    if (r) apply(r);
  }

  async function reveal(tile: number) {
    if (!active || busy || done) return;
    if (active.revealed.includes(tile)) return;
    const r = await post("reveal", { roundId: active.roundId, tile });
    if (r) apply(r);
  }

  async function cashout() {
    if (!active || busy || done) return;
    const r = await post("cashout", { roundId: active.roundId });
    if (r) apply(r);
  }

  const revealed = active?.revealed ?? [];
  const multiplier = active?.multiplier ?? (done === "cashed" ? payout : 0);
  const nextMultiplier = active?.nextMultiplier ?? 0;
  const stakeNum = active ? active.stake : Number(stake);
  const belowMin = minBet > 0 && Number.isFinite(stakeNum) && stakeNum < minBet;
  const aboveMax = maxBet > 0 && Number.isFinite(stakeNum) && stakeNum > maxBet;
  const overBalance = !active && Number.isFinite(stakeNum) && stakeNum > balance;
  const badStake = belowMin || aboveMax || overBalance;
  const stakeOk = !active && Number.isFinite(stakeNum) && stakeNum > 0 && !badStake;
  const clampStake = (n: number) => {
    let v = Number.isFinite(n) && n > 0 ? n : minBet > 0 ? minBet : 0;
    if (minBet > 0 && v < minBet) v = minBet;
    if (maxBet > 0 && v > maxBet) v = maxBet;
    if (balance > 0 && v > balance) v = balance;
    return Number(v.toFixed(decimals));
  };
  const cashValue = active ? active.stake * active.multiplier : 0;
  const playing = Boolean(active) && !done;
  const shownBalance = useCountUp(balance, 650);
  const shownMult = useCountUp(multiplier, 450);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="panel rounded-2xl p-5 sm:p-6">
        <div className={cn("mx-auto grid max-w-md grid-cols-5 gap-2", done === "busted" && "animate-shake")}>
          {Array.from({ length: MINES_TILES }, (_, i) => {
            const isMine = mines.includes(i);
            const open = revealed.includes(i);
            const ended = Boolean(done);
            const showMine = ended && isMine;
            return (
              <button
                key={i}
                type="button"
                disabled={!playing || open || busy}
                onClick={() => reveal(i)}
                aria-label={showMine ? "Mine" : open ? "Safe tile" : "Hidden tile"}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl text-lg ring-1 transition",
                  showMine
                    ? "animate-pop bg-red-600/30 text-red-200 ring-red-500/40"
                    : open
                      ? "animate-pop bg-emerald-500/20 text-emerald-200 ring-emerald-500/40"
                      : playing
                        ? "bg-ink-900/70 text-slate-500 ring-white/10 hover:bg-ink-800 hover:text-gold-300"
                        : "bg-ink-900/50 text-slate-600 ring-white/5"
                )}
              >
                {showMine ? <Bomb size={18} /> : open ? <Gem size={18} /> : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel rounded-2xl p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Balance</span>
          <span className="font-display text-base font-bold tabular-nums text-white">
            {formatCrypto(shownBalance, decimals)} <span className="text-slate-400">{symbol}</span>
          </span>
        </div>

        {playing ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current</p>
                <p className="font-display text-2xl font-bold text-gold-300">{shownMult.toFixed(2)}x</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next tile</p>
                <p className="font-display text-lg font-bold text-white">{nextMultiplier.toFixed(2)}x</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-ink-900/60 px-3 py-2">
                <p className="text-slate-400">Stake</p>
                <p className="mt-0.5 font-mono tabular-nums text-slate-200">
                  {formatCrypto(active?.stake ?? 0, decimals)} {symbol}
                </p>
              </div>
              <div className="rounded-lg bg-ink-900/60 px-3 py-2">
                <p className="text-slate-400">Open</p>
                <p className="mt-0.5 font-mono tabular-nums text-slate-200">
                  {revealed.length} of {MINES_TILES - (active?.mineCount ?? mineCount)}
                </p>
              </div>
            </div>
            <Button size="lg" className="w-full" disabled={busy || revealed.length === 0} onClick={cashout}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : `Cash out ${formatCrypto(cashValue, decimals)} ${symbol}`}
            </Button>
            <p className="text-center text-xs text-slate-400">
              {revealed.length} safe {revealed.length === 1 ? "tile" : "tiles"} open, {active?.mineCount} mines hidden
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="mines-stake" className="mb-1.5 block text-sm font-semibold text-slate-300">
                Stake ({symbol})
              </label>
              <input
                id="mines-stake"
                type="number"
                min={0}
                step="any"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                aria-invalid={badStake}
                aria-describedby="mines-stake-help"
                className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
              />
              <p
                id="mines-stake-help"
                className={cn("mt-1.5 text-xs", badStake ? "text-red-300" : "text-slate-400")}
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
                  `Minimum stake is ${formatCrypto(minBet, decimals)} ${symbol}.`
                ) : aboveMax ? (
                  `Maximum stake is ${formatCrypto(maxBet, decimals)} ${symbol}.`
                ) : overBalance ? (
                  "Stake is above your balance."
                ) : minBet > 0 || maxBet > 0 ? (
                  `Allowed ${minBet > 0 ? formatCrypto(minBet, decimals) : "0"} to ${
                    maxBet > 0 ? formatCrypto(maxBet, decimals) : "no cap"
                  } ${symbol}.`
                ) : (
                  `Balance ${formatCrypto(balance, decimals)} ${symbol}.`
                )}
              </p>
            </div>
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
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-300">Mines</span>
                <span className="font-display font-bold text-white">{mineCount}</span>
              </div>
              <input
                type="range"
                min={1}
                max={MINES_MAX}
                value={mineCount}
                onChange={(e) => setMineCount(Number(e.target.value))}
                aria-label="Number of mines"
                className="w-full accent-gold-500"
              />
              <p className="mt-1 text-xs text-slate-400">
                {mineCount} {mineCount === 1 ? "mine" : "mines"} hidden in {MINES_TILES} tiles.
              </p>
            </div>
            <Button size="lg" className="w-full" disabled={busy || !stakeOk} onClick={start}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : done ? "Play again" : "Start round"}
            </Button>
            {done && (
              <p className={cn("text-center text-sm font-semibold", done === "cashed" ? "text-emerald-300" : "text-red-300")}>
                {done === "cashed"
                  ? `Cashed out ${formatCrypto(payout, decimals)} ${symbol}`
                  : `Busted. ${formatCrypto(stakeNum, decimals)} ${symbol} lost.`}
              </p>
            )}
          </div>
        )}

        <p className="mt-4 border-t border-white/5 pt-3 text-xs text-slate-400">
          Every tile is drawn from the committed seed at the start. Base 1% house edge, and site payout
          settings can adjust the return.
        </p>
      </div>
    </div>
  );
}
