import { randomUUID } from "crypto";

export type LedgerStatus =
  | "applied"
  | "duplicate"
  | "unchanged"
  | "insufficient"
  | "missing_user"
  | "missing"
  | "already_paid"
  | "active_exists"
  | "settled"
  | "invalid_tile"
  | "already_revealed"
  | "no_reveals"
  | "inactive"
  | "expired"
  | "noop"
  | "credited"
  | "claimed"
  | "already_claimed"
  | "paid";

export type LedgerResult = {
  status: LedgerStatus | string;
  balance?: number | string | null;
  ledger_id?: number | string | null;
  [key: string]: unknown;
};

export function firstRow<T extends Record<string, unknown>>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  if (data && typeof data === "object") return data as T;
  return null;
}

export function idempotencyKey(userId: string, scope: string, provided?: unknown): string {
  const raw = typeof provided === "string" ? provided.trim() : "";
  const suffix = raw && raw.length <= 160 && /^[A-Za-z0-9._:-]+$/.test(raw) ? raw : randomUUID();
  return `${userId}:${scope}:${suffix}`;
}

export function requestIdempotencyKey(req: Request, userId: string, scope: string, provided?: unknown): string {
  return idempotencyKey(userId, scope, provided ?? req.headers.get("idempotency-key"));
}

export function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
