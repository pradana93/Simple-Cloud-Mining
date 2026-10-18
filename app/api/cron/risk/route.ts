import { NextResponse } from "next/server";
import { rescanAll, pruneOldEvents } from "@/lib/risk";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/risk: rebuild every member's risk score and trim old telemetry.
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
    const scanned = await rescanAll();
    await pruneOldEvents(30);
    return NextResponse.json({ ok: true, scanned });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Risk scan failed" }, { status: 500 });
  }
}
