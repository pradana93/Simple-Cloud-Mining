import { cookies, headers } from "next/headers";
import { getCachedSettings } from "./catalog";
import { cross, getFxTable, isSupportedFiat, type FxTable } from "./fx";
import { detectCurrency } from "./geo";
import { FX_COOKIE, CUR_COOKIE, type MoneyCfg } from "./money";
import type { SiteSettings } from "./types";

// Resolves how money renders for this request. The display currency is the
// visitor's explicit pick, else their location, else the site default. Values
// stay in crypto; conversion happens here and never fabricates a rate.

export async function getMoneyCfg(
  settings?: SiteSettings,
  fxTable?: FxTable | null
): Promise<MoneyCfg> {
  const s = settings ?? (await getCachedSettings());
  const cookieStore = await cookies();
  const priceCurrency = (s.price_currency || "USD").toUpperCase();

  const picked = cookieStore.get(CUR_COOKIE)?.value?.toUpperCase();
  const headerStore = await headers();
  const geo = detectCurrency(headerStore.get("x-vercel-ip-country"), headerStore.get("accept-language"));
  const displayCurrency =
    (isSupportedFiat(picked) ? (picked as string) : null) ??
    geo ??
    (isSupportedFiat(s.fiat_currency) ? s.fiat_currency.toUpperCase() : "USD");

  const base: MoneyCfg = {
    mode: "crypto",
    rate: 0,
    code: s.currency_code,
    symbol: s.currency_symbol,
    decimals: s.currency_decimals,
    fiatCurrency: displayCurrency,
    priceCurrency,
    priceToDisplay: 1,
    cryptoToPrice: 0,
  };

  if (!s.fiat_enabled) return base;

  const table = fxTable !== undefined ? fxTable : await getFxTable(s.currency_code);
  if (!table) return base;

  const rate = table.rates[displayCurrency] ?? 0;
  const priceToDisplay = cross(table.rates, priceCurrency, displayCurrency) || 1;
  const cryptoToPrice = table.rates[priceCurrency] ?? 0;
  const mode = cookieStore.get(FX_COOKIE)?.value === "crypto" ? "crypto" : "fiat";

  return { ...base, mode, rate, priceToDisplay, cryptoToPrice };
}

export type { MoneyCfg };
