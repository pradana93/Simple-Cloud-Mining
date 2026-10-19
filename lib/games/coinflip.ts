import type { InstantGame, PlayResult } from "./types";

// Pick a side. A coin lands on heads for f < 0.5, tails otherwise. A win pays
// 1.98x, so the expected return is 0.5 * 1.98 = 99 percent. A 1 percent edge.

export type CoinFlipParams = { side: "heads" | "tails" };

export const COINFLIP_PAYOUT = 1.98;

export const coinflip: InstantGame<CoinFlipParams> = {
  id: "coinflip",
  floats: () => 1,
  normalize(raw: unknown): CoinFlipParams {
    const r = (raw ?? {}) as { side?: unknown };
    return { side: r.side === "tails" ? "tails" : "heads" };
  },
  play(p, [f]): PlayResult {
    const outcome: "heads" | "tails" = (f ?? 0) < 0.5 ? "heads" : "tails";
    const won = outcome === p.side;
    return {
      multiplier: won ? COINFLIP_PAYOUT : 0,
      won,
      detail: { outcome, side: p.side },
    };
  },
};
