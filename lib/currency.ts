import { cookies } from "next/headers";
import { getCachedSettings } from "./catalog";
import { getFxRate } from "./fx";
import { FX_COOKIE, type MoneyCfg } from "./money";

// Resolves the display currency for the current request: the member's cookie
// plus the live rate. Falls back to crypto whenever fiat is off or the feed is
// down, so a page never renders a stale or guessed fiat figure.

export async function getMoneyCfg(): Promise<MoneyCfg> {
  const s = await getCachedSettings();
  const crypto: MoneyCfg = {
    mode: "crypto",
    rate: 0,
    code: s.currency_code,
    symbol: s.currency_symbol,
    decimals: s.currency_decimals,
    fiatCurrency: s.fiat_currency,
  };
  if (!s.fiat_enabled) return crypto;
  if (cookies().get(FX_COOKIE)?.value !== "fiat") return crypto;
  const fx = await getFxRate(s.currency_code, s.fiat_currency);
  if (!fx) return crypto;
  return { ...crypto, mode: "fiat", rate: fx.rate };
}

export type { MoneyCfg };
