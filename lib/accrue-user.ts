import type { SupabaseClient } from "@supabase/supabase-js";
import { accrueForPlan } from "./mining";

export type AccrualRow = {
  id: number;
  expire_date: string | null;
  last_sum: string | null;
  created_at: string;
  plan: { earning_rate: number | null } | Array<{ earning_rate: number | null }> | null;
};

// Credit the signed-in user's own active plans; the daily cron is the safety net.
// Writes are throttled and batched so a page view normally costs zero writes, and
// callers that already fetched the active rows can pass them in to skip a query.
const MIN_INTERVAL_MS = 60_000;

export async function accrueOwnPlans(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  opts: { rows?: AccrualRow[]; balance?: number; minIntervalMs?: number } = {}
): Promise<{ earnings: number }> {
  try {
    const now = new Date();
    let rows = opts.rows;
    if (!rows) {
      const { data } = await supabase
        .from("user_plan_history")
        .select("id,expire_date,last_sum,created_at,plan:plans(earning_rate)")
        .eq("user_id", userId)
        .eq("status", "active");
      rows = (data ?? []) as AccrualRow[];
    }
    const minInterval = opts.minIntervalMs ?? MIN_INTERVAL_MS;

    const dueIds: number[] = [];
    const expiredIds: number[] = [];
    let earnings = 0;

    for (const row of rows) {
      const planObj = Array.isArray(row.plan) ? row.plan[0] : row.plan;
      const res = accrueForPlan(
        {
          expire_date: row.expire_date,
          last_sum: row.last_sum,
          created_at: row.created_at,
          earning_rate: planObj?.earning_rate ?? null,
        },
        now
      );
      if (res.expired) {
        expiredIds.push(row.id);
        continue;
      }
      if (res.earnings <= 0) continue;
      const last = row.last_sum ? new Date(row.last_sum).getTime() : new Date(row.created_at).getTime();
      if (now.getTime() - last < minInterval) continue;
      dueIds.push(row.id);
      earnings += res.earnings;
    }

    if (dueIds.length === 0 && expiredIds.length === 0) return { earnings: 0 };

    const writes: Array<PromiseLike<unknown>> = [];
    if (dueIds.length > 0) {
      writes.push(supabase.from("user_plan_history").update({ last_sum: now.toISOString() }).in("id", dueIds));
    }
    if (expiredIds.length > 0) {
      writes.push(supabase.from("user_plan_history").update({ status: "inactive" }).in("id", expiredIds));
    }
    if (earnings > 0) {
      let current = opts.balance;
      if (current == null) {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", userId).maybeSingle();
        current = Number((profile as { balance: number } | null)?.balance ?? 0);
      }
      writes.push(supabase.from("profiles").update({ balance: current + earnings }).eq("id", userId));
    }
    await Promise.all(writes);
    return { earnings };
  } catch {
    return { earnings: 0 };
  }
}
