// Live crypto -> fiat rate for the display toggle. The rate is fetched from a
// public price feed and cached for a minute; if the feed is unreachable the
// caller falls back to showing crypto, never a guessed number.

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

export type FxRate = {
  code: string;
  fiat: string;
  rate: number;
  source: string;
  fetchedAt: string;
};

export function fxSupported(code: string): boolean {
  return Boolean(FEED_ID[code.toUpperCase()]);
}

export async function getFxRate(code: string, fiat = "USD"): Promise<FxRate | null> {
  const id = FEED_ID[code.toUpperCase()];
  if (!id) return null;
  const vs = fiat.toLowerCase();
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vs}&include_last_updated_at=true`,
      { next: { revalidate: 60 }, headers: { accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, Record<string, number> | undefined>;
    const row = data?.[id];
    const rate = Number(row?.[vs]);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const stamp = Number(row?.last_updated_at);
    return {
      code: code.toUpperCase(),
      fiat: fiat.toUpperCase(),
      rate,
      source: "CoinGecko",
      fetchedAt: Number.isFinite(stamp) && stamp > 0 ? new Date(stamp * 1000).toISOString() : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
