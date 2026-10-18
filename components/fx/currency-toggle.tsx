"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { FX_COOKIE, formatFiat, type MoneyMode } from "@/lib/money";

type Props = {
  enabled: boolean;
  code: string;
  fiatCurrency: string;
  className?: string;
};

export function CurrencyToggle({ enabled, code, fiatCurrency, className }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<MoneyMode>("crypto");
  const [rate, setRate] = useState<number | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setMode(document.cookie.split("; ").some((c) => c === `${FX_COOKIE}=fiat`) ? "fiat" : "crypto");
  }, []);

  useEffect(() => {
    if (!enabled || mode !== "fiat") return;
    let alive = true;
    fetch("/api/rate")
      .then((r) => r.json())
      .then((d: { rate?: number | null }) => {
        if (alive) setRate(typeof d.rate === "number" ? d.rate : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled, mode]);

  if (!enabled) return null;

  function pick(next: MoneyMode) {
    if (next === mode) return;
    document.cookie = `${FX_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setMode(next);
    start(() => router.refresh());
  }

  const hint =
    mode === "fiat"
      ? rate
        ? `1 ${code} is about ${formatFiat(rate, fiatCurrency)} right now. Fiat values are indicative.`
        : "Fetching the live rate. Showing crypto until it loads."
      : `Show values in ${fiatCurrency}`;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div role="group" aria-label="Display currency" className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
        {(["crypto", "fiat"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => pick(m)}
            aria-pressed={mode === m}
            disabled={pending}
            className={cn(
              "min-h-[30px] rounded-md px-2.5 font-display text-[11px] font-semibold transition-colors",
              mode === m ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
            )}
          >
            {m === "crypto" ? code : fiatCurrency}
          </button>
        ))}
      </div>
      <span className="hidden text-[11px] tabular-nums text-slate-400 lg:inline" title={hint}>
        {mode === "fiat" && rate ? `1 ${code} ≈ ${formatFiat(rate, fiatCurrency)}` : ""}
      </span>
    </div>
  );
}
