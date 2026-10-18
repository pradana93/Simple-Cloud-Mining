import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";
import { rescanAll } from "@/lib/risk";

export const dynamic = "force-dynamic";

const STATES = new Set(["open", "dismissed", "cleared"]);

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const action = String(body.action ?? "");

  try {
    if (action === "rescan") {
      const scanned = await rescanAll();
      return NextResponse.json({ ok: true, message: `Rescanned ${scanned} account${scanned === 1 ? "" : "s"}` });
    }

    if (action === "state") {
      const userId = String(body.userId ?? "");
      const state = String(body.state ?? "");
      if (!userId || !STATES.has(state)) {
        return NextResponse.json({ ok: false, error: "A member and a valid state are required" }, { status: 400 });
      }
      const { error } = await createAdminSupabase()
        .from("account_risk")
        .update({ state, reviewed_by: gate.userId, reviewed_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, message: `Marked ${state}` });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Action failed" }, { status: 500 });
  }
}
