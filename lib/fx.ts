// Live crypto -> fiat rates for the display toggle. One call returns the coin's
// price in every supported fiat, cached for a minute. All rates are "units of
// fiat per 1 coin", so any fiat-to-fiat cross rate is rates[b] / rates[a]. If
// the feed is unreachable the caller falls back to showing crypto, never a
// guessed number.

const FEED_ID: Record<string, string> = {
  DOGE: "dogecoin",
  BTC: "bitcoin",
  LTC: "litecoin",
  ETH: "ethereum",
  BCH: "bitcoin-cash",
  TRX: "tron",
  XMR: "monero",
  SOL: "solana",
  USDT: "tether",
  USDC: "usd-coin",
};

// Currencies a visitor can be auto-matched to or pick from the toggle.
export const SUPPORTED_FIATS = [
  "USD", "EUR", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK",
  "AUD", "CAD", "NZD",
  "BRL", "MXN", "ARS",
  "INR", "IDR", "MYR", "SGD", "PHP", "THB", "VND",
  "JPY", "KRW", "CNY", "HKD", "TWD",
  "AED", "SAR", "TRY", "ILS",
  "NGN", "ZAR", "KES", "EGP",
];

export type FxTable = {
  base: string;
  rates: Record<string, number>;
  source: string;
  fetchedAt: string;
};

export function fxSupported(code: string): boolean {
  return Boolean(FEED_ID[code.toUpperCase()]);
}

export function isSupportedFiat(code: string | null | undefined): boolean {
  return Boolean(code) && SUPPORTED_FIATS.includes(code!.toUpperCase());
}

export async function getFxTable(coin: string): Promise<FxTable | null> {
  const id = FEED_ID[coin.toUpperCase()];
  if (!id) return null;
  const vs = SUPPORTED_FIATS.map((c) => c.toLowerCase()).join(",");
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vs}&include_last_updated_at=true`,
      { next: { revalidate: 60 }, headers: { accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, Record<string, number> | undefined>;
    const row = data?.[id];
    if (!row) return null;
    const rates: Record<string, number> = {};
    for (const c of SUPPORTED_FIATS) {
      const v = Number(row[c.toLowerCase()]);
      if (Number.isFinite(v) && v > 0) rates[c] = v;
    }
    if (Object.keys(rates).length === 0) return null;
    const stamp = Number(row.last_updated_at);
    return {
      base: coin.toUpperCase(),
      rates,
      source: "CoinGecko",
      fetchedAt: Number.isFinite(stamp) && stamp > 0 ? new Date(stamp * 1000).toISOString() : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// Fiat-to-fiat cross rate from a table expressed as "fiat per 1 coin".
export function cross(rates: Record<string, number>, from: string, to: string): number {
  const a = rates[from.toUpperCase()];
  const b = rates[to.toUpperCase()];
  if (!a || !b) return 0;
  return b / a;
}
