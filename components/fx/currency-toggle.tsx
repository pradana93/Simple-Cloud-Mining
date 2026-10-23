"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { CUR_COOKIE, FX_COOKIE, formatFiat, type MoneyMode } from "@/lib/money";

type Props = {
  enabled: boolean;
  cryptoCode: string;
  className?: string;
};

type RatePayload = {
  display?: string;
  currencies?: string[];
  rate?: number | null;
};

let rateRequest: Promise<RatePayload> | null = null;

function loadRate(): Promise<RatePayload> {
  if (!rateRequest) {
    rateRequest = fetch("/api/rate")
      .then((r) => r.json() as Promise<RatePayload>)
      .catch(() => {
        rateRequest = null;
        return {};
      });
  }
  return rateRequest;
}

export function CurrencyToggle({ enabled, cryptoCode, className }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<MoneyMode>("crypto");
  const [cur, setCur] = useState("USD");
  const [currencies, setCurrencies] = useState<string[]>(["USD"]);
  const [rate, setRate] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!enabled) return;
    const readCookie = (name: string) =>
      document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1] ?? null;
    setMode(readCookie(FX_COOKIE) === "crypto" ? "crypto" : "fiat");
    const picked = readCookie(CUR_COOKIE);
    if (picked) setCur(picked.toUpperCase());
    let alive = true;
    loadRate()
      .then((d) => {
        if (!alive) return;
        if (Array.isArray(d.currencies) && d.currencies.length) setCurrencies(d.currencies);
        if (!picked && d.display) setCur(d.display);
        if (typeof d.rate === "number") setRate(d.rate);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  if (!enabled) return null;

  function pick(next: MoneyMode) {
    document.cookie = `${FX_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setMode(next);
    start(() => router.refresh());
  }

  function changeCurrency(next: string) {
    document.cookie = `${CUR_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setCur(next);
    start(() => router.refresh());
  }

  const hint =
    mode === "fiat"
      ? rate
        ? `1 ${cryptoCode} is about ${formatFiat(rate, cur)} right now. Fiat values are indicative.`
        : "Fetching the live rate. Showing crypto until it loads."
      : `Show values in your local currency`;

  if (!ready) {
    return <span className={cn("inline-block h-8 w-24 rounded-lg bg-white/5", className)} aria-hidden />;
  }

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
            {m === "crypto" ? cryptoCode : "Fiat"}
          </button>
        ))}
      </div>
      {mode === "fiat" && (
        <select
          value={cur}
          onChange={(e) => changeCurrency(e.target.value)}
          aria-label="Fiat currency"
          className="h-8 rounded-lg border border-white/10 bg-ink-900 px-2 text-[11px] font-semibold text-slate-200 focus:border-gold-500/60 focus:outline-none"
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}
      <span className="hidden text-[11px] tabular-nums text-slate-400 xl:inline" title={hint}>
        {mode === "fiat" && rate ? `1 ${cryptoCode} ≈ ${formatFiat(rate, cur)}` : ""}
      </span>
    </div>
  );
}
