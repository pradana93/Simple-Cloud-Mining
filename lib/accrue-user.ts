import type { SupabaseClient } from "@supabase/supabase-js";
import { accrueForPlan } from "./mining";

/**
 * Free-tier friendly lazy accrual: credit the signed-in user's own active
 * plans on page view, so balances stay fresh even though the Vercel Hobby
 * cron only runs once daily (safety net for expiry + inactive users).
 *
 * Runs under the user's own session — RLS policies ("own plans",
 * "own profile") permit these updates. Same math as the cron route.
 */
export async function accrueOwnPlans(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<void> {
  try {
    const now = new Date();
    const { data } = await supabase
      .from("user_plan_history")
      .select("id,expire_date,last_sum,created_at,plan:plans(earning_rate)")
      .eq("user_id", userId)
      .eq("status", "active");
    const rows = (data ?? []) as Array<{
      id: number;
      expire_date: string | null;
      last_sum: string | null;
      created_at: string;
      plan: { earning_rate: number | null } | Array<{ earning_rate: number | null }> | null;
    }>;
    for (const row of rows) {
      const planObj = Array.isArray(row.plan) ? row.plan[0] : row.plan;
      const { earnings, expired } = accrueForPlan(
        {
          expire_date: row.expire_date,
          last_sum: row.last_sum,
          created_at: row.created_at,
          earning_rate: planObj?.earning_rate ?? null,
        },
        now
      );
      if (expired) {
        await supabase.from("user_plan_history").update({ status: "inactive" }).eq("id", row.id);
        continue;
      }
      await supabase.from("user_plan_history").update({ last_sum: now.toISOString() }).eq("id", row.id);
      if (earnings > 0) {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", userId).maybeSingle();
        const current = Number((profile as { balance: number } | null)?.balance ?? 0);
        await supabase.from("profiles").update({ balance: current + earnings }).eq("id", userId);
      }
    }
  } catch {
    // Accrual is best-effort on page view; cron covers the rest.
  }
}
