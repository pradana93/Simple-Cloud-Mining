import { createAdminSupabase } from "./supabase/admin";
import { accrueForPlan } from "./mining";
import { asNumber, firstRow } from "./ledger";

export type AccrualRow = {
  id: number;
  expire_date: string | null;
  last_sum: string | null;
  created_at: string;
  plan: { earning_rate: number | null } | Array<{ earning_rate: number | null }> | null;
};

// Credit the signed-in user's own active plans; the daily cron is the safety net.
// Writes run with the service role (clients can no longer write balances/rigs) and
// the balance bump is a single atomic credit_balance call.
//
// Returns two numbers:
//   pending  - earnings projected since each rig's last_sum, for live display.
//   credited - the part actually persisted this call (only when the throttle
//              window elapsed). A caller showing `stored + pending` stays correct
//              whether or not a write happened, because persisted rows reset to
//              a ~0 projection while `stored` grows by exactly `credited`.
const MIN_INTERVAL_MS = 60_000;

export async function accrueOwnPlans(
  userId: string,
  opts: { rows?: AccrualRow[]; minIntervalMs?: number } = {}
): Promise<{ pending: number; credited: number }> {
  try {
    const admin = createAdminSupabase();
    const now = new Date();
    let rows = opts.rows;
    if (!rows) {
      const { data } = await admin
        .from("user_plan_history")
        .select("id,expire_date,last_sum,created_at,plan:plans(earning_rate)")
        .eq("user_id", userId)
        .eq("status", "active");
      rows = (data ?? []) as AccrualRow[];
    }
    const minInterval = opts.minIntervalMs ?? MIN_INTERVAL_MS;

    const dueIds: number[] = [];
    const expiredIds: number[] = [];
    let pending = 0;

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
      pending += res.earnings;
      const last = row.last_sum ? new Date(row.last_sum).getTime() : new Date(row.created_at).getTime();
      if (now.getTime() - last < minInterval) continue;
      dueIds.push(row.id);
    }

    if (dueIds.length === 0 && expiredIds.length === 0) return { pending, credited: 0 };

    const settleIds = Array.from(new Set([...expiredIds, ...dueIds]));
    const results = await Promise.all(
      settleIds.map((id) =>
        admin.rpc("accrue_plan", {
          p_plan_id: id,
          p_now: now.toISOString(),
        })
      )
    );

    let persisted = 0;
    for (const result of results) {
      if (result.error) continue;
      const row = firstRow<{ status?: string; credited?: unknown }>(result.data);
      if (row?.status === "credited") persisted += asNumber(row.credited);
    }
    return { pending, credited: Number(persisted.toFixed(8)) };
  } catch {
    return { pending: 0, credited: 0 };
  }
}
