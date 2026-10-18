// Pure money formatting shared by server and client components. Every stored
// value is crypto; fiat is derived at render time from a live rate. Fiat output
// is prefixed with "≈" because it is an indicative conversion, not a quote.

import { formatCrypto } from "./utils";

export const FX_COOKIE = "fx";
export const CUR_COOKIE = "cur";

export type MoneyMode = "crypto" | "fiat";

export type MoneyCfg = {
  mode: MoneyMode;
  rate: number;
  code: string;
  symbol: string;
  decimals: number;
  fiatCurrency: string;
  priceCurrency: string;
  priceToDisplay: number;
  cryptoToPrice: number;
};

const FIAT_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr",
  PLN: "zł", CZK: "Kč", AUD: "A$", CAD: "C$", NZD: "NZ$",
  BRL: "R$", MXN: "MX$", ARS: "AR$",
  INR: "₹", IDR: "Rp", MYR: "RM", SGD: "S$", PHP: "₱", THB: "฿", VND: "₫",
  JPY: "¥", KRW: "₩", CNY: "¥", HKD: "HK$", TWD: "NT$",
  AED: "د.إ", SAR: "﷼", TRY: "₺", ILS: "₪",
  NGN: "₦", ZAR: "R", KES: "KSh", EGP: "E£",
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
  const num = n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sym = fiatSymbol(currency);
  return sym ? `${sym}${num}` : `${num} ${currency.toUpperCase()}`;
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

// Plan prices are set in the site's price currency (a stable fiat). They follow
// the toggle: crypto shows the coin equivalent, fiat shows the visitor's local
// currency (marked "≈" when it is not the currency the price is set in).
export function formatPrice(value: number | string, cfg: MoneyCfg): string {
  const raw = typeof value === "string" ? Number(value) : value;
  const n = Number.isFinite(raw) ? raw : 0;
  if (cfg.mode === "crypto" && cfg.cryptoToPrice > 0) {
    return `${cfg.symbol}${formatCrypto(n / cfg.cryptoToPrice, cfg.decimals)}`;
  }
  const display = n * (cfg.priceToDisplay > 0 ? cfg.priceToDisplay : 1);
  const approx = cfg.fiatCurrency.toUpperCase() !== cfg.priceCurrency.toUpperCase();
  return `${approx ? "≈" : ""}${formatFiat(display, cfg.fiatCurrency)}`;
}

export function cryptoCfg(overrides: Partial<MoneyCfg> & Pick<MoneyCfg, "code" | "symbol" | "decimals">): MoneyCfg {
  return {
    mode: "crypto",
    rate: 0,
    fiatCurrency: "USD",
    priceCurrency: "USD",
    priceToDisplay: 1,
    cryptoToPrice: 0,
    ...overrides,
  };
}
