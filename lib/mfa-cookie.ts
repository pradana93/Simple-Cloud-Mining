import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const MFA_COOKIE = "mfa";
const TTL_MS = 15 * 60 * 1000;

// Server-only key: the service-role secret never reaches the browser.
function key(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only-mfa-key";
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

export function issueMfaToken(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: now + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readMfaToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub?: string; exp?: number };
    if (!data.sub || typeof data.exp !== "number" || data.exp < now) return null;
    return data.sub;
  } catch {
    return null;
  }
}

export function mfaCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.VERCEL === "1",
    path: "/",
  };
}

export async function hasFreshMfa(userId: string): Promise<boolean> {
  return readMfaToken((await cookies()).get(MFA_COOKIE)?.value) === userId;
}
