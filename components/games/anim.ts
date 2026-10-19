"use client";

import { useEffect, useRef, useState } from "react";

// Small animation primitives shared by the game boards. Everything is driven
// from a progress value so a reveal always lands on the value the server
// returned, never on a random one. Motion stands down when the visitor asks for
// reduced motion.

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

// Runs 0 to 1 whenever `seq` changes, then calls onDone. Skipped on mount and
// when reduced motion is on, where it resolves instantly.
export function useReveal(seq: number, duration: number, onDone?: () => void): number {
  const [p, setP] = useState(1);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const reduced = usePrefersReducedMotion();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reduced) {
      setP(1);
      doneRef.current?.();
      return;
    }
    let raf = 0;
    let start = 0;
    setP(0);
    const tick = (t: number) => {
      if (!start) start = t;
      const k = clamp01((t - start) / duration);
      setP(easeOutCubic(k));
      if (k < 1) raf = requestAnimationFrame(tick);
      else doneRef.current?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seq, duration, reduced]);

  return p;
}

// Eases a number toward its target whenever the target changes.
export function useCountUp(value: number, duration = 650): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const k = clamp01((t - start) / duration);
      setDisplay(lerp(from, value, easeOutCubic(k)));
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return display;
}
