import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  hotp,
  normalizeRecoveryCode,
  otpauthUri,
  totp,
  verifyTotp,
} from "@/lib/totp";

// RFC 4226 appendix D test secret.
const SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("base32", () => {
  it("round-trips bytes", () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it("ignores padding and whitespace on decode", () => {
    expect(base32Decode("GEZD GNBV GY3T QOJQ").equals(Buffer.from("1234567890"))).toBe(true);
  });
});

describe("hotp (RFC 4226 vectors)", () => {
  const vectors = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583"];
  it("matches the published six-digit codes", () => {
    vectors.forEach((code, counter) => {
      expect(hotp(SECRET, counter, 6)).toBe(code);
    });
  });
});

describe("totp", () => {
  it("advances every 30 seconds", () => {
    const at = 1_699_999_980_000; // aligned to a 30s boundary
    expect(totp(SECRET, at)).toBe(totp(SECRET, at + 29_000));
    expect(totp(SECRET, at)).not.toBe(totp(SECRET, at + 30_000));
  });
});

describe("verifyTotp", () => {
  const at = 1_700_000_000_000;

  it("accepts the current code", () => {
    expect(verifyTotp(SECRET, totp(SECRET, at), { atMs: at })).toBe(Math.floor(at / 1000 / 30));
  });

  it("accepts a code one step behind", () => {
    expect(verifyTotp(SECRET, totp(SECRET, at - 30_000), { atMs: at })).not.toBeNull();
  });

  it("rejects a code outside the window", () => {
    expect(verifyTotp(SECRET, totp(SECRET, at - 120_000), { atMs: at })).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyTotp(SECRET, "12345", { atMs: at })).toBeNull();
    expect(verifyTotp(SECRET, "abcdef", { atMs: at })).toBeNull();
  });
});

describe("generateSecret", () => {
  it("produces distinct base32 secrets", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-7]+$/);
  });
});

describe("otpauthUri", () => {
  it("builds an otpauth URI with the expected parameters", () => {
    const uri = otpauthUri({ secret: SECRET, account: "pradana93", issuer: "SCM" });
    expect(uri.startsWith("otpauth://totp/SCM%3Apradana93?")).toBe(true);
    expect(uri).toContain(`secret=${SECRET}`);
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});

describe("recovery codes", () => {
  it("generates well-formed codes", () => {
    const codes = generateRecoveryCodes(8);
    expect(codes).toHaveLength(8);
    for (const c of codes) expect(c).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{2}$/);
  });

  it("hashes case and separator insensitively", () => {
    expect(hashRecoveryCode("abcd-ef01-23")).toBe(hashRecoveryCode("ABCDEF0123"));
    expect(hashRecoveryCode("abcd-ef01-23")).not.toBe(hashRecoveryCode("abcd-ef01-24"));
  });

  it("normalizes separators away", () => {
    expect(normalizeRecoveryCode("abcd-ef01-23")).toBe("ABCDEF0123");
  });
});
