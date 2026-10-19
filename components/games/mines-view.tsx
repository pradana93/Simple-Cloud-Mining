"use client";

import { useCallback, useEffect, useState } from "react";
import { Bomb, Gem, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, formatCrypto } from "@/lib/utils";
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
}: {
  symbol: string;
  decimals: number;
  balance: number;
}) {
  const { push } = useToast();
  const [balance, setBalance] = useState(initialBalance);
  const [mineCount, setMineCount] = useState(3);
  const [stake, setStake] = useState("1");
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
  const cashValue = active ? active.stake * active.multiplier : 0;
  const playing = Boolean(active) && !done;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="panel rounded-2xl p-5 sm:p-6">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
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
                className={cn(
                  "grid aspect-square place-items-center rounded-xl text-lg ring-1 transition",
                  showMine
                    ? "bg-red-600/30 text-red-200 ring-red-500/40"
                    : open
                      ? "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40"
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

      <div className="space-y-4">
        <div className="panel rounded-2xl p-5 sm:p-6">
          {playing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Current</p>
                  <p className="font-display text-2xl font-bold text-gold-300">{multiplier.toFixed(2)}x</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Next tile</p>
                  <p className="font-display text-lg font-bold text-white">{nextMultiplier.toFixed(2)}x</p>
                </div>
              </div>
              <Button size="lg" className="w-full" disabled={busy || revealed.length === 0} onClick={cashout}>
                {busy ? <Loader2 className="animate-spin" size={18} /> : `Cash out ${formatCrypto(cashValue, decimals)} ${symbol}`}
              </Button>
              <p className="text-center text-xs text-slate-500">
                {revealed.length} safe {revealed.length === 1 ? "tile" : "tiles"} open, {active?.mineCount} mines hidden
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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
                  className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
                />
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
                  className="w-full accent-gold-500"
                />
              </div>
              <Button size="lg" className="w-full" disabled={busy} onClick={start}>
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
        </div>
        <div className="panel rounded-2xl p-5 text-sm text-slate-400">
          <p className="font-display text-sm font-bold text-white">Balance</p>
          <p className="mt-1 font-display text-xl font-bold text-white">
            {formatCrypto(balance, decimals)} <span className="text-slate-400">{symbol}</span>
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Every tile is drawn from the committed seed at the start. One percent house edge.
          </p>
        </div>
      </div>
    </div>
  );
}
