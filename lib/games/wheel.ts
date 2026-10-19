import type { InstantGame, PlayResult } from "./types";

// A weighted wheel. Every segment carries a weight and a multiplier, and the
// weights are chosen so the weighted mean multiplier is exactly 0.99 across all
// three risks. A 1 percent house edge.

export type WheelRisk = "low" | "medium" | "high";
export type WheelParams = { risk: WheelRisk };
export type WheelSegment = { multiplier: number; weight: number };

const TABLES: Record<WheelRisk, WheelSegment[]> = {
  low: [
    { multiplier: 1.5, weight: 400 },
    { multiplier: 3, weight: 130 },
    { multiplier: 0, weight: 470 },
  ],
  medium: [
    { multiplier: 1.5, weight: 300 },
    { multiplier: 3, weight: 180 },
    { multiplier: 0, weight: 520 },
  ],
  high: [
    { multiplier: 2, weight: 300 },
    { multiplier: 5, weight: 78 },
    { multiplier: 0, weight: 622 },
  ],
};

export function wheelSegments(risk: WheelRisk): WheelSegment[] {
  return TABLES[risk] ?? TABLES.low;
}

export function wheelRtp(risk: WheelRisk): number {
  const segs = wheelSegments(risk);
  const total = segs.reduce((s, x) => s + x.weight, 0);
  return segs.reduce((s, x) => s + x.weight * x.multiplier, 0) / total;
}

export const wheel: InstantGame<WheelParams> = {
  id: "wheel",
  floats: () => 1,
  normalize(raw: unknown): WheelParams {
    const r = (raw ?? {}) as { risk?: unknown };
    const risk: WheelRisk = r.risk === "medium" || r.risk === "high" ? r.risk : "low";
    return { risk };
  },
  play(p, [f]): PlayResult {
    const segs = wheelSegments(p.risk);
    const total = segs.reduce((s, x) => s + x.weight, 0);
    let point = (f ?? 0) * total;
    let index = segs.length - 1;
    for (let i = 0; i < segs.length; i++) {
      if (point < segs[i].weight) {
        index = i;
        break;
      }
      point -= segs[i].weight;
    }
    const multiplier = segs[index].multiplier;
    return { multiplier, won: multiplier > 0, detail: { index, risk: p.risk, multiplier } };
  },
};
