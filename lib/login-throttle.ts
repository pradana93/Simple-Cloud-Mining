export const LOGIN_WINDOW_MS = 10 * 60 * 1000;
export const LOGIN_NAME_LIMIT = 10;
export const LOGIN_IP_LIMIT = 30;

export const TFA_WINDOW_MS = 15 * 60 * 1000;
export const TFA_LIMIT = 10;

export function normalizeLogin(raw: string): string {
  return raw.trim().toLowerCase();
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const real = req.headers.get("x-real-ip") ?? "";
  return (forwarded || real).trim().slice(0, 45);
}

export function twoFactorAttemptKey(userId: string): string {
  return `2fa:${userId}`;
}

export function limitReached(count: number | null | undefined, limit: number): boolean {
  return (count ?? 0) >= limit;
}
