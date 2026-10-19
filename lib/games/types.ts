// Shared game types. Every instant game is a pure function of (validated
// params, floats), so the same code runs on the server to settle a bet and in
// a test to prove the payout math.

export type PlayResult = {
  // Total returned per unit staked: 0 means a full loss, 1 means break-even,
  // 2 means double back. The stake is already debited, so payout = stake * multiplier.
  multiplier: number;
  won: boolean;
  detail: Record<string, unknown>;
};

export type InstantGame<P = Record<string, unknown>> = {
  id: string;
  // How many floats from the stream this game consumes for these params.
  floats: (params: P) => number;
  // Validate and clamp raw client input. Must throw on unusable input.
  normalize: (raw: unknown) => P;
  // Deterministic outcome. `floats` has exactly floats(params) entries in [0,1).
  play: (params: P, floats: number[]) => PlayResult;
};
