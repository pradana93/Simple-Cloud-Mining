import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { accrueForPlan } from "@/lib/mining";

/**
 * GET /api/cron/accrue — Vercel Cron every 5 min.
 * Port of Users_model::updateUserBalance() applied to ALL active plans.
 * Protect with CRON_SECRET header/query in production.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = req.headers.get("x-cron-secret") ?? url.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminSupabase();
  const { data: actives, error } = await admin
    .from("user_plan_history")
    .select("id,user_id,expire_date,last_sum,created_at,plan:plans(earning_rate)")
    .eq("status", "active")
    .limit(1000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const now = new Date();
  let credited = 0;
  let expired = 0;
  for (const row of ((actives ?? []) as unknown as Array<{
    id: number; user_id: string; expire_date: string | null; last_sum: string | null;
    created_at: string; plan: { earning_rate: number | null } | Array<{ earning_rate: number | null }>;
  }>)) {
    const planObj = Array.isArray(row.plan) ? row.plan[0] : row.plan;
    const { earnings, expired: isExpired } = accrueForPlan(
      { expire_date: row.expire_date, last_sum: row.last_sum, created_at: row.created_at, earning_rate: planObj?.earning_rate ?? null },
      now
    );
    if (isExpired) {
      await admin.from("user_plan_history").update({ status: "inactive" }).eq("id", row.id);
      expired++;
      continue;
    }
    await admin.from("user_plan_history").update({ last_sum: now.toISOString() }).eq("id", row.id);
    if (earnings > 0) {
      const { data: p } = await admin.from("profiles").select("balance").eq("id", row.user_id).maybeSingle();
      if (p) {
        await admin.from("profiles").update({ balance: Number((p as { balance: number }).balance) + earnings }).eq("id", row.user_id);
        credited++;
      }
    }
  }
  return NextResponse.json({ ok: true, scanned: (actives ?? []).length, credited, expired });
}
