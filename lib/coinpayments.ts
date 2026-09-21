import crypto from "crypto";

export type CoinpaymentsMode = "api" | "gateway";

export function buildGatewayUrl(opts: {
  merchantId: string;
  planId: number;
  planName: string;
  siteName: string;
  amount: number;
  currency: string;
  invoice: string;
  baseUrl: string;
}): string {
  const params = new URLSearchParams({
    cmd: "_pay",
    reset: "1",
    merchant: opts.merchantId,
    item_name: `Purchase of Mining Plan ${opts.planName} on ${opts.siteName}`,
    item_number: String(opts.planId),
    amountf: String(opts.amount),
    want_shipping: "0",
    currency: opts.currency,
    invoice: opts.invoice,
    success_url: opts.baseUrl,
    cancel_url: opts.baseUrl,
    ipn_url: `${opts.baseUrl.replace(/\/$/, "")}/api/ipn/coinpayments`,
  });
  return `https://www.coinpayments.net/index.php?${params.toString()}`;
}

export async function createApiTransaction(opts: {
  privateKey: string;
  publicKey: string;
  amount: number;
  currency1: string;
  currency2: string;
  buyerEmail: string;
  itemName: string;
  itemNumber: number;
  invoice: string;
  ipnUrl: string;
}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    version: "1",
    cmd: "create_transaction",
    key: opts.publicKey,
    amount: String(opts.amount),
    currency1: opts.currency1,
    currency2: opts.currency2,
    buyer_email: opts.buyerEmail,
    item_name: opts.itemName,
    item_number: String(opts.itemNumber),
    invoice: opts.invoice,
    ipn_url: opts.ipnUrl,
    format: "json",
  });
  const hmac = crypto
    .createHmac("sha512", opts.privateKey)
    .update(body.toString())
    .digest("hex");
  const res = await fetch("https://www.coinpayments.net/api.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", HMAC: hmac },
    body: body.toString(),
    cache: "no-store",
  });
  return (await res.json()) as Record<string, unknown>;
}

export function verifyIpnHmac(
  rawBody: string,
  sentHmac: string | null,
  ipnSecret: string
): boolean {
  if (!sentHmac) return false;
  const expected = crypto
    .createHmac("sha512", ipnSecret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(sentHmac)
    );
  } catch {
    return false;
  }
}
