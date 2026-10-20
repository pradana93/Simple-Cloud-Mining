import { floorTo } from "./util";

// Crash timing and crash-point math. The round is a live line, not a single
// draw: the server records a hidden crash point, and the multiplier grows with
// the clock. The client draws the same function, but only the server settles.
//
// The crash point is 0.99 / (1 - f), so the chance the line reaches m is
// 0.99 / m and a cashout at a fixed m returns 99 percent. A 1 percent edge.
//
// A round is capped at 60 seconds. Only the very top of the distribution
// (0.45 percent of rounds) would run longer, so the cap costs the player
// almost nothing and keeps a forgotten round from sitting open forever.

export const CRASH_GROWTH = 0.09;
export const CRASH_MAX_SECONDS = 60;
export const CRASH_MAX_MULTIPLIER = crashMultiplierAt(CRASH_MAX_SECONDS * 1000);

const INSTANT_CRASH_FLOOR = 0.01;

export function crashPoint(f: number): number {
  if (f < INSTANT_CRASH_FLOOR) return 1;
  const clamped = Math.min(f, 1 - 1e-9);
  return Math.max(1, floorTo(0.99 / (1 - clamped), 2));
}

export function crashMultiplierAt(elapsedMs: number): number {
  const seconds = Math.min(Math.max(0, elapsedMs) / 1000, CRASH_MAX_SECONDS);
  return floorTo(Math.exp(CRASH_GROWTH * seconds), 2);
}

// When the line reaches a given multiplier. Used to draw the rest of the
// round after a cashout, since the crash point is revealed at settle.
export function crashTimeMs(multiplier: number): number {
  if (!(multiplier > 1)) return 0;
  return (Math.log(multiplier) / CRASH_GROWTH) * 1000;
}
