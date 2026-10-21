import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";
import { recordAudit } from "@/lib/audit";
import { firstRow, idempotencyKey } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const adminId = gate.userId;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  const admin = createAdminSupabase();
  const actor = { id: gate.userId, name: gate.name };

  try {
    if (action === "grant") {
      const userId = String(body.userId ?? "");
      const planId = Number(body.planId);
      if (!userId || !Number.isFinite(planId)) {
        return NextResponse.json({ ok: false, error: "Member and plan are required" }, { status: 400 });
      }
      const { data: plan } = await admin.from("plans").select("id,duration,plan_name").eq("id", planId).maybeSingle();
      if (!plan) return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 });
      const durationDays = body.durationDays != null && body.durationDays !== "" ? Math.round(Number(body.durationDays)) : Number((plan as { duration: number }).duration);
      if (!Number.isFinite(durationDays) || durationDays < 1) {
        return NextResponse.json({ ok: false, error: "Duration must be at least 1 day" }, { status: 400 });
      }
      const now = new Date();
      const expire = new Date(now.getTime() + durationDays * 86400000);
      const { error } = await admin.from("user_plan_history").insert({
        user_id: userId,
        plan_id: planId,
        status: "active",
        expire_date: expire.toISOString(),
        last_sum: now.toISOString(),
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      await recordAudit({ actor, action: "member.grant_rig", target: userId, detail: { planId, durationDays }, req });
      return NextResponse.json({ ok: true, message: `${(plan as { plan_name: string }).plan_name} granted for ${durationDays} days` });
    }

    if (action === "revoke-rig") {
      const rigId = Number(body.id);
      if (!Number.isFinite(rigId)) return NextResponse.json({ ok: false, error: "Rig id is required" }, { status: 400 });
      const { error } = await admin.from("user_plan_history").update({ status: "inactive" }).eq("id", rigId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      await recordAudit({ actor, action: "member.revoke_rig", target: String(rigId), detail: { rigId }, req });
      return NextResponse.json({ ok: true, message: "Rig stopped" });
    }

    if (action === "balance") {
      const userId = String(body.userId ?? "");
      const amount = Number(body.amount);
      const mode = body.mode === "set" ? "set" : "add";
      if (!userId || !Number.isFinite(amount)) {
        return NextResponse.json({ ok: false, error: "Member and amount are required" }, { status: 400 });
      }
      const key = idempotencyKey(adminId, `admin-balance:${userId}`, body.idempotencyKey);
      if (mode === "add") {
        const { data, error } = await admin.rpc("post_balance", {
          p_user: userId,
          p_delta: amount,
          p_reason: "admin_adjustment",
          p_ref_type: "admin",
          p_ref_id: adminId,
          p_idempotency_key: key,
          p_metadata: { mode, amount },
        });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        const row = firstRow<{ status?: string; balance?: unknown }>(data);
        if (row?.status === "missing_user") return NextResponse.json({ ok: false, error: "Member not found" }, { status: 404 });
        if (row?.status === "insufficient") return NextResponse.json({ ok: false, error: "Balance cannot go below zero" }, { status: 400 });
        if (row?.status !== "applied" && row?.status !== "unchanged" && row?.status !== "duplicate") {
          return NextResponse.json({ ok: false, error: "Could not update the balance" }, { status: 400 });
        }
        const next = Number(row?.balance ?? 0);
        await recordAudit({ actor, action: "member.balance", target: userId, detail: { mode, amount, balance: next }, req });
        return NextResponse.json({ ok: true, balance: next, message: `Balance set to ${next.toFixed(8)}` });
      }
      const next = Math.max(0, amount);
      const { data, error } = await admin.rpc("set_balance", {
        p_user: userId,
        p_target: next,
        p_reason: "admin_set_balance",
        p_ref_type: "admin",
        p_ref_id: adminId,
        p_idempotency_key: key,
        p_metadata: { mode, amount },
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      const row = firstRow<{ status?: string; balance?: unknown }>(data);
      if (row?.status === "missing_user") return NextResponse.json({ ok: false, error: "Member not found" }, { status: 404 });
      if (row?.status !== "applied" && row?.status !== "unchanged" && row?.status !== "duplicate") {
        return NextResponse.json({ ok: false, error: "Could not update the balance" }, { status: 400 });
      }
      const balance = Number(row?.balance ?? next);
      await recordAudit({ actor, action: "member.balance", target: userId, detail: { mode, amount, balance }, req });
      return NextResponse.json({ ok: true, balance, message: `Balance set to ${balance.toFixed(8)}` });
    }

    if (action === "role") {
      const userId = String(body.userId ?? "");
      const isAdmin = body.isAdmin === true;
      if (!userId) return NextResponse.json({ ok: false, error: "Member is required" }, { status: 400 });
      if (userId === adminId && !isAdmin) {
        return NextResponse.json({ ok: false, error: "You cannot remove your own admin access" }, { status: 400 });
      }
      const { error } = await admin.from("profiles").update({ is_admin: isAdmin }).eq("id", userId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      await recordAudit({ actor, action: "member.role", target: userId, detail: { isAdmin }, req });
      return NextResponse.json({ ok: true, message: isAdmin ? "Admin access granted" : "Admin access removed" });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Action failed" }, { status: 500 });
  }
}
