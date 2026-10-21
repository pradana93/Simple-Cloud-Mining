import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { amountCovers, isConfirmed, parseCryptapiWebhook, verifyCryptapiSignature } from "@/lib/cryptapi";
import { cryptoTicker } from "@/lib/checkout";

describe("cryptoTicker", () => {
  it("maps supported coins to CryptAPI tickers", () => {
    expect(cryptoTicker("btc")).toBe("btc");
    expect(cryptoTicker(" USDT ")).toBe("trc20/usdt");
    expect(cryptoTicker("trx")).toBe("trx");
  });

  it("rejects unsupported coins", () => {
    expect(cryptoTicker("FOO")).toBeNull();
    expect(cryptoTicker(null)).toBeNull();
  });
});

describe("webhook parsing", () => {
  it("reads the signed fields", () => {
    const payment = parseCryptapiWebhook(
      new URLSearchParams({
        uuid: "abc",
        address_in: "addr",
        txid_in: "tx",
        coin: "btc",
        value_coin: "0.5",
        confirmations: "3",
        pending: "0",
      })
    );
    expect(payment).toEqual({
      uuid: "abc",
      addressIn: "addr",
      txid: "tx",
      coin: "btc",
      value: 0.5,
      confirmations: 3,
      pending: 0,
    });
  });
});

describe("payment checks", () => {
  it("accepts exact and tiny rounding differences only", () => {
    expect(amountCovers(10, 10)).toBe(true);
    expect(amountCovers(9.999999999, 10)).toBe(true);
    expect(amountCovers(9.99, 10)).toBe(false);
    expect(amountCovers(Number.NaN, 10)).toBe(false);
  });

  it("requires the configured confirmations and no pending flag", () => {
    const base = { uuid: null, addressIn: null, txid: null, coin: null, value: 1, confirmations: 2, pending: 0 };
    expect(isConfirmed(base, 2)).toBe(true);
    expect(isConfirmed({ ...base, confirmations: 1 }, 2)).toBe(false);
    expect(isConfirmed({ ...base, pending: 1 }, 2)).toBe(false);
  });
});

describe("webhook signatures", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const body = "uuid=abc&address_in=addr&value_coin=0.5&confirmations=3&pending=0";

  it("accepts a valid RSA-SHA256 signature", () => {
    const signature = crypto.sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64");
    expect(verifyCryptapiSignature(body, signature, publicKey)).toBe(true);
  });

  it("rejects a changed body, a missing signature, or the wrong key", () => {
    const signature = crypto.sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64");
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey;
    expect(verifyCryptapiSignature(`${body}&pending=1`, signature, publicKey)).toBe(false);
    expect(verifyCryptapiSignature(body, null, publicKey)).toBe(false);
    expect(verifyCryptapiSignature(body, signature, other)).toBe(false);
  });
});
