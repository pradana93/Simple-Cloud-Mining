import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { asNumber, firstRow } from "@/lib/ledger";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

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

  const { data, error } = await createAdminSupabase().rpc("ledger_summary");
  if (error) {
    await sendAlert({
      title: "Ledger check failed",
      message: error.message,
      level: "error",
      tags: { cron: "ledger" },
    });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const row = firstRow<Record<string, unknown>>(data);
  const drift = asNumber(row?.drift);
  const driftUsers = asNumber(row?.drift_users);
  const dirty = driftUsers > 0 || Math.abs(drift) > 0.00000001;

  if (dirty) {
    await sendAlert({
      title: "Balance reconciliation drift",
      message: `${driftUsers} account(s) do not match the ledger by ${drift}`,
      level: "error",
      tags: { cron: "ledger" },
      extra: { drift, driftUsers, ledgerRows: asNumber(row?.entries) },
    });
    return NextResponse.json(
      { ok: false, drift, driftUsers, entries: asNumber(row?.entries) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    profiles: asNumber(row?.profiles),
    entries: asNumber(row?.entries),
    drift,
  });
}
