"use client";
import { useEffect, useRef, useState } from "react";
import { fiatDecimals, fiatSymbol, type MoneyCfg } from "@/lib/money";

export function CountUp({
  value,
  decimals = 0,
  duration = 900,
  cfg,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  cfg?: MoneyCfg;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const mountedRef = useRef(false);
  const fiat = cfg?.mode === "fiat" && cfg.rate > 0;
  const shownDecimals = fiat ? fiatDecimals(value * cfg!.rate) : decimals;

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    if (!mountedRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      mountedRef.current = true;
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (target - from) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={className}>
      {fiat ? `≈${fiatSymbol(cfg!.fiatCurrency)}` : ""}
      {(fiat ? display * cfg!.rate : display).toFixed(shownDecimals)}
    </span>
  );
}
