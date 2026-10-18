// Pure money formatting shared by server and client components. Every stored
// value is crypto; fiat is derived at render time from a live rate. Fiat output
// is prefixed with "≈" because it is an indicative conversion, not a quote.

import { formatCrypto } from "./utils";

export const FX_COOKIE = "fx";

export type MoneyMode = "crypto" | "fiat";

export type MoneyCfg = {
  mode: MoneyMode;
  rate: number;
  code: string;
  symbol: string;
  decimals: number;
  fiatCurrency: string;
};

const FIAT_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
};

export function fiatSymbol(currency: string): string {
  return FIAT_SYMBOL[currency.toUpperCase()] ?? "";
}

export function fiatDecimals(value: number): number {
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return 6;
  if (abs > 0 && abs < 1) return 4;
  return 2;
}

export function formatFiat(value: number, currency = "USD"): string {
  const n = Number.isFinite(value) ? value : 0;
  const decimals = fiatDecimals(n);
  return `${fiatSymbol(currency)}${n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatMoney(value: number | string, cfg: MoneyCfg, decimalsOverride?: number): string {
  const raw = typeof value === "string" ? Number(value) : value;
  const n = Number.isFinite(raw) ? raw : 0;
  if (cfg.mode === "fiat" && cfg.rate > 0) return `≈${formatFiat(n * cfg.rate, cfg.fiatCurrency)}`;
  return `${cfg.symbol}${formatCrypto(n, decimalsOverride ?? cfg.decimals)}`;
}

export function moneyUnit(cfg: MoneyCfg): string {
  return cfg.mode === "fiat" ? cfg.fiatCurrency : cfg.code;
}

export function cryptoCfg(overrides: Partial<MoneyCfg> & Pick<MoneyCfg, "code" | "symbol" | "decimals">): MoneyCfg {
  return { mode: "crypto", rate: 0, fiatCurrency: "USD", ...overrides };
}
