import { createHash, randomBytes } from "node:crypto";

export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const TRUSTED_DEVICE_MAX_AGE_SECONDS = Math.floor(TRUSTED_DEVICE_TTL_MS / 1000);

export function newTrustedDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTrustedDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function trustedDeviceExpiry(now = Date.now()): string {
  return new Date(now + TRUSTED_DEVICE_TTL_MS).toISOString();
}
