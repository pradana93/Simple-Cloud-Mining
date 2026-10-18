import { NextResponse } from "next/server";
import { runSecurityProbes } from "@/lib/security-probe";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/security: re-probe the anon surface and record the posture.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "Cron is not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const secret =
    req.headers.get("x-cron-secret") ??
    (auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null);
  if (secret !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await runSecurityProbes();
    const failing = results.filter((r) => !r.passed).length;
    return NextResponse.json({ ok: failing === 0, checked: results.length, failing });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Security probe failed" }, { status: 500 });
  }
}
