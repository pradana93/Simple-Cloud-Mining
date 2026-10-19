import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdminApi } from "@/lib/api-admin";
import { runAccrual } from "@/lib/run-accrual";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const TAGS = ["site-settings", "plans", "faqs", "contents", "payouts", "site-stats"];

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let action = "";
  try {
    action = String(((await req.json()) as { action?: unknown }).action ?? "");
  } catch {
    action = "";
  }

  if (action === "accrue") {
    try {
      const r = await runAccrual();
      await recordAudit({ actor: { id: gate.userId, name: gate.name }, action: "maintenance.accrue", detail: { ...r }, req });
      return NextResponse.json({ ok: true, message: `Scanned ${r.scanned} rigs, credited ${r.credited}, expired ${r.expired}.` });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Accrual failed" }, { status: 500 });
    }
  }

  if (action === "revalidate") {
    for (const tag of TAGS) revalidateTag(tag);
    await recordAudit({ actor: { id: gate.userId, name: gate.name }, action: "maintenance.revalidate", req });
    return NextResponse.json({ ok: true, message: "Public caches refreshed." });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
