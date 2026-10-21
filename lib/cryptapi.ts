import crypto from "crypto";
import { coinOptions, cryptoTicker, type PayCoin } from "./checkout";

const API_BASE = process.env.CRYPTAPI_API_BASE ?? "https://api.cryptapi.io";
const DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3FT0Ym8b3myVxhQW7ESuuu6lo
dGAsUJs4fq+Ey//jm27jQ7HHHDmP1YJO7XE7Jf/0DTEJgcw4EZhJFVwsk6d3+4fy
Bsn0tKeyGMiaE6cVkX0cy6Y85o8zgc/CwZKc0uw6d5siAo++xl2zl+RGMXCELQVE
ox7pp208zTvown577wIDAQAB
-----END PUBLIC KEY-----`;

const ADDRESS_ENV: Record<string, string[]> = {
  BTC: ["CRYPTAPI_BTC_ADDRESS"],
  DOGE: ["CRYPTAPI_DOGE_ADDRESS"],
  LTC: ["CRYPTAPI_LTC_ADDRESS"],
  ETH: ["CRYPTAPI_ETH_ADDRESS"],
  TRX: ["CRYPTAPI_TRX_ADDRESS"],
  USDT: ["CRYPTAPI_USDT_TRC20_ADDRESS", "CRYPTAPI_USDT_ADDRESS"],
};

const ADDRESS_DB: Record<string, keyof PaymentAddresses> = {
  BTC: "cryptapi_btc_address",
  DOGE: "cryptapi_doge_address",
  LTC: "cryptapi_ltc_address",
  ETH: "cryptapi_eth_address",
  TRX: "cryptapi_trx_address",
  USDT: "cryptapi_usdt_trc20_address",
};

export type PaymentAddresses = {
  cryptapi_btc_address: string | null;
  cryptapi_ltc_address: string | null;
  cryptapi_doge_address: string | null;
  cryptapi_eth_address: string | null;
  cryptapi_trx_address: string | null;
  cryptapi_usdt_trc20_address: string | null;
};

export type CryptapiPayment = {
  addressIn: string;
  minimum: number;
};

export type CryptapiWebhook = {
  uuid: string | null;
  addressIn: string | null;
  txid: string | null;
  coin: string | null;
  value: number;
  confirmations: number;
  pending: number;
};

export function paymentAddress(
  coin: string,
  settings?: Partial<PaymentAddresses> | null
): string | null {
  const code = coin.toUpperCase();
  for (const name of ADDRESS_ENV[code] ?? []) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  const key = ADDRESS_DB[code];
  const value = key ? settings?.[key]?.trim() : "";
  if (!value) return null;
  // CryptAPI rejects a second token on a non-multi-token TRON address. Treat a
  // shared TRX/USDT address as unconfigured instead of showing a checkout that
  // will fail at invoice creation.
  if (code === "USDT" && value === paymentAddress("TRX", settings)) return null;
  return value;
}

export function availableCoins(
  csv: string | null | undefined,
  settings?: Partial<PaymentAddresses> | null
): PayCoin[] {
  return coinOptions(csv).filter((coin) => Boolean(paymentAddress(coin.code, settings)));
}

function requiredAddress(coin: string, settings?: Partial<PaymentAddresses> | null): string {
  const address = paymentAddress(coin, settings);
  if (!address) throw new Error(`CryptAPI receiving address is not configured for ${coin}.`);
  return address;
}

function requiredTicker(coin: string): string {
  const ticker = cryptoTicker(coin);
  if (!ticker) throw new Error(`${coin} is not supported by CryptAPI checkout.`);
  return ticker;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`CryptAPI returned HTTP ${res.status}.`);
  const data = (await res.json()) as Record<string, unknown>;
  if (data.status !== "success") {
    throw new Error(String(data.error ?? data.message ?? "CryptAPI request failed."));
  }
  return data;
}

export async function convertToCoin(ticker: string, value: number, from: string): Promise<number> {
  if (!(value > 0)) throw new Error("Payment amount must be positive.");
  const url = `${API_BASE}/${ticker}/convert/?${new URLSearchParams({
    value: String(value),
    from: from.toUpperCase(),
  })}`;
  const data = await getJson(url);
  const amount = Number(data.value_coin);
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("CryptAPI returned an invalid conversion.");
  return amount;
}

export async function createPayment(opts: {
  coin: string;
  callbackUrl: string;
  confirmations: number;
  settings?: Partial<PaymentAddresses> | null;
}): Promise<CryptapiPayment> {
  const ticker = requiredTicker(opts.coin);
  const url = `${API_BASE}/${ticker}/create/?${new URLSearchParams({
    address: requiredAddress(opts.coin, opts.settings),
    callback: opts.callbackUrl,
    pending: "1",
    confirmations: String(Math.max(1, Math.min(12, Math.trunc(opts.confirmations)))),
    post: "1",
  })}`;
  const data = await getJson(url);
  const addressIn = String(data.address_in ?? "");
  if (!addressIn) throw new Error("CryptAPI did not return a deposit address.");
  return {
    addressIn,
    minimum: Number(data.minimum_transaction_coin) || 0,
  };
}

export function verifyCryptapiSignature(
  raw: string,
  signature: string | null,
  publicKey: string | crypto.KeyObject = process.env.CRYPTAPI_PUBLIC_KEY ?? DEFAULT_PUBLIC_KEY
): boolean {
  if (!signature) return false;
  try {
    const key = typeof publicKey === "string" ? publicKey.replace(/\\n/g, "\n") : publicKey;
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(raw);
    verifier.end();
    return verifier.verify(key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export function parseCryptapiWebhook(source: URLSearchParams): CryptapiWebhook {
  const number = (key: string) => {
    const value = Number(source.get(key));
    return Number.isFinite(value) ? value : 0;
  };
  return {
    uuid: source.get("uuid"),
    addressIn: source.get("address_in"),
    txid: source.get("txid_in"),
    coin: source.get("coin"),
    value: number("value_coin"),
    confirmations: number("confirmations"),
    pending: number("pending"),
  };
}

export function amountCovers(actual: number, expected: number): boolean {
  return Number.isFinite(actual) && Number.isFinite(expected) && expected > 0 && actual + 1e-8 >= expected;
}

export function isConfirmed(payment: CryptapiWebhook, requiredConfirmations: number): boolean {
  return payment.pending === 0 && payment.confirmations >= Math.max(1, Math.trunc(requiredConfirmations));
}
