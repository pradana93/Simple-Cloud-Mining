import { describe, expect, it } from "vitest";
import {
  TRUSTED_DEVICE_TTL_MS,
  hashTrustedDeviceToken,
  newTrustedDeviceToken,
  trustedDeviceExpiry,
} from "@/lib/trusted-device-token";

describe("trusted device tokens", () => {
  it("creates unique opaque tokens", () => {
    const a = newTrustedDeviceToken();
    const b = newTrustedDeviceToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
  });

  it("stores a stable sha256 hash instead of the token", () => {
    const token = newTrustedDeviceToken();
    expect(hashTrustedDeviceToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashTrustedDeviceToken(token)).toBe(hashTrustedDeviceToken(token));
  });

  it("expires thirty days after issue", () => {
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    expect(Date.parse(trustedDeviceExpiry(now)) - now).toBe(TRUSTED_DEVICE_TTL_MS);
  });
});
