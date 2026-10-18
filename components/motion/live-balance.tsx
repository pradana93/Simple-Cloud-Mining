"use client";
import { useEffect, useRef, useState } from "react";
import { fiatDecimals, fiatSymbol, type MoneyCfg } from "@/lib/money";

// A balance readout that keeps climbing while the tab is open. The server hands
// us a value plus the rig's per-minute rate; this projects the balance forward
// every second and periodically checks back so the number never drifts from what
// is actually stored. MOTION 1: the only movement is the figure it reports.
export function LiveBalance({
  value,
  perMinute,
  decimals = 8,
  cfg,
  className,
}: {
  value: number;
  perMinute: number;
  decimals?: number;
  cfg?: MoneyCfg;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const base = useRef({ balance: value, at: Date.now() });
  const perSecond = perMinute > 0 ? perMinute / 60 : 0;
  const fiat = cfg?.mode === "fiat" && cfg.rate > 0;
  const shownDecimals = fiat ? fiatDecimals(value * cfg!.rate) : decimals;

  useEffect(() => {
    base.current = { balance: value, at: Date.now() };
    setDisplay(value);
  }, [value]);

  useEffect(() => {
    if (perSecond <= 0) return;
    const id = setInterval(() => {
      const { balance, at } = base.current;
      setDisplay(balance + ((Date.now() - at) / 1000) * perSecond);
    }, 1000);
    return () => clearInterval(id);
  }, [perSecond]);

  useEffect(() => {
    if (perSecond <= 0) return;
    let alive = true;
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/accrue", { method: "POST" });
        const j = (await res.json()) as { ok?: boolean; balance?: number };
        if (alive && j.ok && typeof j.balance === "number") {
          base.current = { balance: j.balance, at: Date.now() };
        }
      } catch {
        // Offline or transient; the local projection keeps ticking until it recovers.
      }
    };
    const id = setInterval(beat, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [perSecond]);

  return (
    <span className={className}>
      {fiat ? `≈${fiatSymbol(cfg!.fiatCurrency)}` : ""}
      {(fiat ? display * cfg!.rate : display).toFixed(shownDecimals)}
    </span>
  );
}
