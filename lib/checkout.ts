export type PayCoin = { code: string; label: string; symbol: string };

const META: Record<string, { label: string; symbol: string }> = {
  BTC: { label: "Bitcoin", symbol: "₿" },
  DOGE: { label: "Dogecoin", symbol: "Ð" },
  LTC: { label: "Litecoin", symbol: "Ł" },
  ETH: { label: "Ethereum", symbol: "Ξ" },
  USDT: { label: "Tether", symbol: "₮" },
  USDC: { label: "USD Coin", symbol: "$" },
  TRX: { label: "TRON", symbol: "TRX" },
  BNB: { label: "BNB", symbol: "BNB" },
  SOL: { label: "Solana", symbol: "SOL" },
  XRP: { label: "XRP", symbol: "XRP" },
  BCH: { label: "Bitcoin Cash", symbol: "BCH" },
  DASH: { label: "Dash", symbol: "DASH" },
};

export function coinOptions(csv: string | null | undefined): PayCoin[] {
  const seen = new Set<string>();
  const out: PayCoin[] = [];
  for (const raw of (csv ?? "").split(",")) {
    const code = raw.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
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
