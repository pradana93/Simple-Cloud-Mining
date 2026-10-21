export type PayCoin = { code: string; label: string; symbol: string };

const META: Record<string, { label: string; symbol: string }> = {
  BTC: { label: "Bitcoin", symbol: "₿" },
  DOGE: { label: "Dogecoin", symbol: "Ð" },
  LTC: { label: "Litecoin", symbol: "Ł" },
  ETH: { label: "Ethereum", symbol: "Ξ" },
  USDT: { label: "Tether (TRC20)", symbol: "₮" },
  TRX: { label: "TRON", symbol: "TRX" },
};

// CryptAPI tickers. Tokens include their network, so USDT is deliberately
// pinned to TRC20 to keep deposit fees predictable.
const TICKERS: Record<string, string> = {
  BTC: "btc",
  DOGE: "doge",
  LTC: "ltc",
  ETH: "eth",
  USDT: "trc20/usdt",
  TRX: "trx",
};

export function cryptoTicker(code: string | null | undefined): string | null {
  return TICKERS[(code ?? "").trim().toUpperCase()] ?? null;
}

export function coinOptions(csv: string | null | undefined): PayCoin[] {
  const seen = new Set<string>();
  const out: PayCoin[] = [];
  for (const raw of (csv ?? "").split(",")) {
    const code = raw.trim().toUpperCase();
    if (!code || seen.has(code) || !cryptoTicker(code)) continue;
    seen.add(code);
    const meta = META[code];
    out.push({ code, label: meta?.label ?? code, symbol: meta?.symbol ?? code });
  }
  return out;
}

export function isPayableCoin(code: string | null | undefined, csv: string | null | undefined): boolean {
  if (!code) return false;
  const upper = code.trim().toUpperCase();
  return coinOptions(csv).some((option) => option.code === upper);
}
