import { createAdminSupabase } from "./supabase/admin";
import { accrueForPlan } from "./mining";

type ActiveRow = {
  id: number;
  user_id: string;
  expire_date: string | null;
  last_sum: string | null;
  created_at: string;
  plan: { earning_rate: number | null } | Array<{ earning_rate: number | null }>;
};

// Port of Users_model::updateUserBalance() across every active plan.
// Shared by the daily Vercel Cron and the admin "run now" action.
export async function runAccrual(now = new Date()) {
  const admin = createAdminSupabase();
  const { data: actives, error } = await admin
    .from("user_plan_history")
    .select("id,user_id,expire_date,last_sum,created_at,plan:plans(earning_rate)")
    .eq("status", "active")
    .limit(1000);
  if (error) throw new Error(error.message);

  let credited = 0;
  let expired = 0;
  for (const row of ((actives ?? []) as unknown as ActiveRow[])) {
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
  return { scanned: (actives ?? []).length, credited, expired };
}
