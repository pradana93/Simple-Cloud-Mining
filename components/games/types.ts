// Shapes shared between the casino client components. Mirrors what the API
// routes return so the lobby, boards and history all speak one language.

export type SeedView = {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  previous: { serverSeed: string; serverSeedHash: string } | null;
};

export type PlayResponse = {
  ok: true;
  game: string;
  stake: number;
  multiplier: number;
  payout: number;
  won: boolean;
  detail: Record<string, unknown>;
  balance: number;
  seed: SeedView;
};

export type BetRow = {
  id: number;
  game: string;
  stake: number;
  multiplier: number;
  payout: number;
  won: boolean;
  nonce: number;
  server_seed_hash: string;
  client_seed: string;
  created_at: string;
  result: Record<string, unknown> | null;
};

export type BoardProps = {
  id: string;
  params: Record<string, unknown>;
  set: (patch: Record<string, unknown>) => void;
  last: PlayResponse | null;
  symbol: string;
  decimals: number;
  seq: number;
  onSettled: () => void;
};
