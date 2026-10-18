import crypto from "crypto";
import { createAdminSupabase } from "./supabase/admin";

// Signal capture for the anti-fraud engine. Best-effort only: every call is
// wrapped so a telemetry failure can never break a money path or a page load.
//
// IPs and user agents are stored as salted hashes. The salt is derived from a
// server-only secret so hashes are stable across instances and restarts while
// the raw values never touch the database.
const SALT = process.env.RISK_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "scm-risk-dev";

function hmac(value: string): string {
  return crypto.createHmac("sha256", SALT).update(value).digest("hex").slice(0, 32);
}

export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : req.headers.get("x-real-ip") ?? "").trim();
  return ip || null;
}

// Coarse network bucket: /24 for IPv4, /48-style prefix for IPv6. Lets us spot
// many accounts from one network without treating a single NAT IP as identity.
export function subnetOf(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.length >= 3 ? parts.slice(0, 3).join(":") : null;
  }
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 3).join(".") : null;
}

// Markers that never appear in a real browser but do appear in scripts and
// headless drivers.
const HEADLESS_UA =
  /headless|puppeteer|playwright|selenium|phantomjs|curl\/|wget\/|python|httpx|aiohttp|requests\/|go-http|node-fetch|axios\/|okhttp|libwww|\bbot\b|spider|crawler/i;

function uaInfo(req: Request): { uaHash: string | null; headless: boolean } {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua) return { uaHash: null, headless: true };
  return { uaHash: hmac(ua), headless: HEADLESS_UA.test(ua) };
}

export type EventKind = "login" | "accrue" | "withdraw" | "deposit";

export async function recordEvent(opts: {
  userId: string;
  kind: EventKind;
  req?: Request;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ip = opts.req ? clientIp(opts.req) : null;
    const ua = opts.req ? uaInfo(opts.req) : { uaHash: null, headless: false };
    const detail: Record<string, unknown> = { ...(opts.detail ?? {}) };
    if (ua.headless) detail.headless = true;
    await createAdminSupabase()
      .from("risk_events")
      .insert({
        user_id: opts.userId,
        kind: opts.kind,
        ip_hash: ip ? hmac(ip) : null,
        subnet_hash: subnetOf(ip) ? hmac(subnetOf(ip) as string) : null,
        ua_hash: ua.uaHash,
        detail: Object.keys(detail).length ? detail : null,
      });
  } catch {
    // Never surface telemetry failures.
  }
}
