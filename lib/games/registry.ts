import type { InstantGame, PlayResult } from "./types";
import { dice } from "./dice";
import { limbo } from "./limbo";
import { coinflip } from "./coinflip";
import { wheel } from "./wheel";
import { plinko } from "./plinko";
import { keno } from "./keno";
import { roulette } from "./roulette";
import { slots } from "./slots";

// Client-safe catalog. Imported by both the server settle path and the UI, so it
// must stay free of node-only imports.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInstantGame = InstantGame<any>;

export const INSTANT_GAMES: Record<string, AnyInstantGame> = {
  dice,
  limbo,
  coinflip,
  wheel,
  plinko,
  keno,
  roulette,
  slots,
};

export type GameCategory = "Instant" | "Pick" | "Grid" | "Table" | "Reels";
export type GamePace = "fast" | "pick" | "step";

export type GameMeta = {
  id: string;
  name: string;
  blurb: string;
  edge: string;
  category: GameCategory;
  pace: GamePace;
  interactive?: boolean;
};

export const GAME_CATALOG: GameMeta[] = [
  {
    id: "dice",
    name: "Dice",
    blurb: "Roll 0 to 100 and bet under or over a target you set.",
    edge: "Base 1% house edge",
    category: "Instant",
    pace: "fast",
  },
  {
    id: "limbo",
    name: "Limbo",
    blurb: "Name a multiplier and see if the result reaches it.",
    edge: "Base 1% house edge",
    category: "Instant",
    pace: "fast",
  },
  {
    id: "crash",
    name: "Crash",
    blurb: "The line climbs. Cash out before it crashes, or lose the stake.",
    edge: "Base 1% house edge",
    category: "Instant",
    pace: "fast",
  },
  {
    id: "coinflip",
    name: "Coin flip",
    blurb: "Call heads or tails. A win pays 1.98x.",
    edge: "Base 1% house edge",
    category: "Instant",
    pace: "fast",
  },
  {
    id: "wheel",
    name: "Wheel",
    blurb: "Spin a weighted wheel across three risk levels.",
    edge: "Base 1% house edge",
    category: "Instant",
    pace: "pick",
  },
  {
    id: "plinko",
    name: "Plinko",
    blurb: "Drop a ball down 8, 12 or 16 rows into a payout slot.",
    edge: "Base 1% to 3% house edge",
    category: "Instant",
    pace: "pick",
  },
  {
    id: "keno",
    name: "Keno",
    blurb: "Pick up to 10 numbers from 40 and match the draw.",
    edge: "Base edge varies with picks",
    category: "Pick",
    pace: "pick",
  },
  {
    id: "mines",
    name: "Mines",
    blurb: "Reveal safe tiles, raise your multiplier, cash out before a mine.",
    edge: "Base 1% house edge",
    category: "Grid",
    pace: "step",
    interactive: true,
  },
  {
    id: "roulette",
    name: "Roulette",
    blurb: "Single zero wheel. Red, black, odd, even, dozens or a number.",
    edge: "Base 2.7% house edge",
    category: "Table",
    pace: "pick",
  },
  {
    id: "slots",
    name: "Slots",
    blurb: "Three reels. Line up a triple or catch two cherries.",
    edge: "Base 8% house edge",
    category: "Reels",
    pace: "pick",
  },
];

export function gameMeta(id: string): GameMeta | undefined {
  return GAME_CATALOG.find((g) => g.id === id);
}

export function getInstantGame(id: string): AnyInstantGame | null {
  return INSTANT_GAMES[id] ?? null;
}

export type { PlayResult };
