"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatCrypto } from "@/lib/utils";

export function CheckinCard({
  claimedToday,
  nextAmount,
  streak,
  symbol,
  decimals,
  code,
}: {
  claimedToday: boolean;
  nextAmount: number;
  streak: number;
  symbol: string;
  decimals: number;
  code: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const money = `${symbol}${formatCrypto(nextAmount, decimals)}`;

  async function claim() {
    setBusy(true);
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      const j = (await res.json()) as { ok: boolean; amount?: number; streak?: number; error?: string };
      if (j.ok) {
        push(`Claimed ${symbol}${formatCrypto(Number(j.amount ?? 0), decimals)}`, "success");
        router.refresh();
      } else {
        push(j.error ?? "Could not claim the bonus", "error");
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel rounded-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
            <Gift size={20} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Daily bonus</h2>
            <p className="text-xs text-slate-400">A small credit in {code}, once every 24 hours.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/15 px-3 py-1 text-xs font-semibold text-gold-300 ring-1 ring-gold-500/30">
          <Flame size={13} /> {streak} day{streak === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">{claimedToday ? "Claimed today" : "Ready to claim"}</p>
          <p className="font-mono mt-0.5 text-2xl font-medium tabular-nums text-gold-300">{money}</p>
        </div>
        {claimedToday ? (
          <span className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-emerald-500/30 px-4 text-sm font-semibold text-emerald-300">
            <Check size={15} /> See you tomorrow
          </span>
        ) : (
          <Button onClick={claim} disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Claiming
              </>
            ) : (
              <>
                <Gift size={15} /> Claim {money}
              </>
            )}
          </Button>
        )}
      </div>
    </section>
  );
}
