import { createAdminSupabase } from "./supabase/admin";
import { isStale } from "./payouts";

// One pass of the manual payout queue, shared by the nightly cron and the admin
// "run now" action:
//   1. Reconciliation: a PROCESSING row that was never sent is put back in the
//      queue. Rows with a recorded send attempt are left alone; retrying them
//      could pay the member twice.
//   2. Aged pending: requests left untouched for a week are flagged (no state
//      change) so an operator notices them.
// Withdrawals are paid from an external wallet. No private key is stored here.
const STALE_MS = 60 * 60 * 1000;
const AGED_MS = 7 * 24 * 60 * 60 * 1000;
const SETTLED = ["PENDING", "SUCCESS", "CANCELED"];

export type PayoutSummary = {
  agedPending: number;
  staleReset: number;
  heldProcessing: number;
  skipped?: string;
};

export async function runPayoutPass(now = new Date()): Promise<PayoutSummary> {
  const admin = createAdminSupabase();
  const summary: PayoutSummary = {
    agedPending: 0,
    staleReset: 0,
    heldProcessing: 0,
    skipped: "Payouts are manual.",
  };

  async function log(withdrawalId: number, event: string, detail: Record<string, unknown>) {
    const { error } = await admin.from("payout_events").insert({ withdrawal_id: withdrawalId, event, detail });
    return !error;
  }

  const { data: inFlight } = await admin
    .from("user_withdrawal")
    .select("id,status,created_at")
    .not("status", "in", `(${SETTLED.map((s) => `"${s}"`).join(",")})`);
  for (const row of (inFlight ?? []) as Array<{ id: number; status: string; created_at: string }>) {
    if (!isStale(row.created_at, now, STALE_MS)) continue;

    const { data: attempts } = await admin
      .from("payout_events")
      .select("id")
      .eq("withdrawal_id", row.id)
      .in("event", ["auto_attempt", "auto_sent"])
      .limit(1);
    if ((attempts ?? []).length > 0) {
      summary.heldProcessing++;
      continue;
    }

    const { data: updated } = await admin
      .from("user_withdrawal")
      .update({ status: "PENDING" })
      .eq("id", row.id)
      .eq("status", row.status)
      .select("id")
      .maybeSingle();
    if (updated) {
      await log(row.id, "stale_reset", { from: row.status });
      summary.staleReset++;
    }
  }

  const { data: pending } = await admin
    .from("user_withdrawal")
    .select("id,created_at")
    .eq("status", "PENDING");
  for (const row of (pending ?? []) as Array<{ id: number; created_at: string }>) {
    if (isStale(row.created_at, now, AGED_MS)) {
      await log(row.id, "aged_pending", {
        days: Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86_400_000),
      });
      summary.agedPending++;
    }
  }

  return summary;
}
