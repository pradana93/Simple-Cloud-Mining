import { createAdminSupabase } from "./supabase/admin";
import { asNumber, firstRow } from "./ledger";

// The database recomputes each plan under a row lock, credits the balance, and
// stamps last_sum in the same transaction. Shared by the daily Vercel Cron and
// the admin "run now" action.
export async function runAccrual(now = new Date()) {
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("run_accrual", {
    p_now: now.toISOString(),
  });
  if (error) throw new Error(error.message);
  const row = firstRow<{
    scanned?: unknown;
    credited?: unknown;
    expired?: unknown;
    total?: unknown;
  }>(data);
  return {
    scanned: asNumber(row?.scanned),
    credited: asNumber(row?.credited),
    expired: asNumber(row?.expired),
    total: asNumber(row?.total),
  };
}
