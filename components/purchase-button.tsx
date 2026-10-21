"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "@/components/ui/toast";
import type { PayCoin } from "@/lib/checkout";
import { cn } from "@/lib/utils";

export function PurchaseButton({ planId, coins = [] }: { planId: number; coins?: PayCoin[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [coin, setCoin] = useState<string>(coins[0]?.code ?? "");
  const keyRef = useRef<string | null>(null);

  async function buy() {
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, coin: coin || undefined, idempotencyKey: keyRef.current }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Purchase failed");
        push(j.error ?? "Purchase failed", "error");
        return;
      }
      keyRef.current = null;
      push("Invoice created", "success");
      if (j.redirectUrl) window.location.href = j.redirectUrl as string;
      else if (j.hash) router.push(`/invoice/${j.hash}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Purchase failed";
      setErr(msg);
      push(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {coins.length > 1 ? (
        <div className="mb-5">
          <p className="text-xs font-medium text-slate-400">Pay with</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Pay with">
            {coins.map((c) => {
              const active = c.code === coin;
              return (
                <button
                  key={c.code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    keyRef.current = null;
                    setCoin(c.code);
                  }}
                  className={cn(
                    "tap inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                    active
                      ? "border-gold-500/50 bg-gold-500/15 text-gold-200"
                      : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-gold-500/30"
                  )}
                >
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full", active ? "bg-gold-500 text-ink-950" : "bg-white/5 text-transparent")}>
                    <Check size={12} />
                  </span>
                  <span className="font-mono">{c.symbol}</span>
                  <span className="text-slate-400">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <Button onClick={buy} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Creating invoice
          </>
        ) : (
          "Confirm purchase"
        )}
      </Button>
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
    </div>
  );
}
