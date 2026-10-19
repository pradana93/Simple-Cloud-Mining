// Small numeric helpers shared by the game math. Payouts are floored, never
// rounded up, so the house edge can never be eroded by rounding.

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toInt(value: unknown, fallback: number): number {
  return Math.trunc(toNumber(value, fallback));
}

// Floor to `dp` decimals.
export function floorTo(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.floor(n * f) / f;
}

// Floor to the site's 8-decimal ledger precision.
export function toLedger(n: number): number {
  return Math.floor(n * 1e8) / 1e8;
}

// Distinct indices from 0..size-1 chosen deterministically from the float
// stream. Used by keno (draw) and mines (layout). Each float indexes into the
// shrinking pool, so equal floats can never collide.
export function pickIndices(floats: number[], size: number, count: number): number[] {
  const pool = Array.from({ length: size }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.min(pool.length - 1, Math.floor((floats[i] ?? 0) * pool.length));
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
