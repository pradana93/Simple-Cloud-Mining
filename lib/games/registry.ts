import type { InstantGame, PlayResult } from "./types";
import { dice } from "./dice";
import { limbo } from "./limbo";
import { coinflip } from "./coinflip";
import { crash } from "./crash";
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
  crash,
  wheel,
  plinko,
  keno,
  roulette,
  slots,
};

export type GameCategory = "Instant" | "Pick" | "Grid" | "Table" | "Reels";

export type GameMeta = {
  id: string;
  name: string;
  blurb: string;
  edge: string;
  category: GameCategory;
  interactive?: boolean;
};

export const GAME_CATALOG: GameMeta[] = [
  {
    id: "dice",
    name: "Dice",
    blurb: "Roll 0 to 100 and bet under or over a target you set.",
    edge: "1% house edge",
    category: "Instant",
  },
  {
    id: "limbo",
    name: "Limbo",
    blurb: "Name a multiplier and see if the result reaches it.",
    edge: "1% house edge",
    category: "Instant",
  },
  {
    id: "crash",
    name: "Crash",
    blurb: "Set a cashout line and watch where the round crashes.",
    edge: "1% house edge",
    category: "Instant",
  },
  {
    id: "coinflip",
    name: "Coin flip",
    blurb: "Call heads or tails. A win pays 1.98x.",
    edge: "1% house edge",
    category: "Instant",
  },
  {
    id: "wheel",
    name: "Wheel",
    blurb: "Spin a weighted wheel across three risk levels.",
    edge: "1% house edge",
    category: "Instant",
  },
  {
    id: "plinko",
    name: "Plinko",
    blurb: "Drop a ball down 8, 12 or 16 rows into a payout slot.",
    edge: "1% to 3% house edge",
    category: "Instant",
  },
  {
    id: "keno",
    name: "Keno",
    blurb: "Pick up to 10 numbers from 40 and match the draw.",
    edge: "Varies by picks",
    category: "Pick",
  },
  {
    id: "mines",
    name: "Mines",
    blurb: "Reveal safe tiles, raise your multiplier, cash out before a mine.",
    edge: "1% house edge",
    category: "Grid",
    interactive: true,
  },
  {
    id: "roulette",
    name: "Roulette",
    blurb: "Single zero wheel. Red, black, odd, even, dozens or a number.",
    edge: "2.7% house edge",
    category: "Table",
  },
  {
    id: "slots",
    name: "Slots",
    blurb: "Three reels. Line up a triple or catch two cherries.",
    edge: "About 5% house edge",
    category: "Reels",
  },
];

export function gameMeta(id: string): GameMeta | undefined {
  return GAME_CATALOG.find((g) => g.id === id);
}

export function getInstantGame(id: string): AnyInstantGame | null {
  return INSTANT_GAMES[id] ?? null;
}

export type { PlayResult };
