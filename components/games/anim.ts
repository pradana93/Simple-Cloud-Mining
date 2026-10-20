"use client";

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { Spin, SpinPhase } from "./types";

// Animation primitives for the game boards. The bet spin is functional feedback
// rather than decoration, so it always runs; reduced motion only shortens it and
// strips the extra flourishes.

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const IDLE: Spin = { phase: "idle", p: 0, clock: 0 };

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

// One rAF loop per round. Spins the moment `runId` changes, holds only while the
// server result is not ready (or the optional minimum), then lands over `landMs`
// and settles to idle.
export function useSpin(
  runId: number,
  spinMs: number,
  landMs: number,
  ready: MutableRefObject<boolean>
): Spin {
  const [state, setState] = useState<Spin>(IDLE);
  const lastRun = useRef(runId);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    // Only a new round starts a spin. A change in motion preference or timing
    // must not replay the last one.
    if (runId === lastRun.current) return;
    lastRun.current = runId;
    const spinFor = reduced ? Math.min(spinMs, 260) : spinMs;
    const landFor = reduced ? Math.min(landMs, 160) : landMs;
    let raf = 0;
    let t0 = 0;
    let landStart = 0;
    let phase: SpinPhase = "spin";
    setState({ phase: "spin", p: 0, clock: 0 });

    const tick = (t: number) => {
      if (!t0) t0 = t;
      if (phase === "spin") {
        const clock = t - t0;
        if (clock >= spinFor && ready.current) {
          phase = "land";
          landStart = t;
        }
        setState({ phase: "spin", p: 0, clock });
      } else {
        const k = clamp01((t - landStart) / landFor);
        if (k >= 1) {
          setState(IDLE);
          return;
        }
        setState({ phase: "land", p: easeOutCubic(k), clock: t - t0 });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runId, spinMs, landMs, reduced, ready]);

  return state;
}

// Eases a number toward its target whenever the target changes.
export function useCountUp(value: number, duration = 650): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const reduced = usePrefersReducedMotion();
  const d = reduced ? Math.min(duration, 200) : duration;

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const k = clamp01((t - start) / d);
      setDisplay(lerp(from, value, easeOutCubic(k)));
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, d]);

  return display;
}
