import { createAdminSupabase } from "./supabase/admin";
import { getSettings } from "./settings";
import { createWithdrawal } from "./coinpayments";
import { isStale, selectAutoPayoutBatch, type WithdrawalLike } from "./payouts";

// One pass of the payout queue, shared by the nightly cron and the admin
// "run now" action:
//   1. Reconciliation: a PROCESSING row that was never sent is put back in the
//      queue. Rows with a recorded send attempt are left alone; retrying them
//      could pay the member twice.
//   2. Aged pending: requests left untouched for a week are flagged (no state
//      change) so an operator notices them.
//   3. Auto-payout: eligible requests are claimed atomically, then sent once.
//      A successful API call leaves the row PROCESSING until the CoinPayments
//      IPN confirms it, so a crash cannot turn an unconfirmed send into SUCCESS.
const STALE_MS = 60 * 60 * 1000;
const AGED_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 25;
const SETTLED = ["PENDING", "SUCCESS", "CANCELED"];

export type PayoutSummary = {
  autoSent: number;
  autoFailed: number;
  agedPending: number;
  staleReset: number;
  heldProcessing: number;
  skipped?: string;
};

type Row = WithdrawalLike & { address: string | null };

export async function runPayoutPass(now = new Date()): Promise<PayoutSummary> {
  const admin = createAdminSupabase();
  const settings = await getSettings();
  const summary: PayoutSummary = {
    autoSent: 0,
    autoFailed: 0,
    agedPending: 0,
    staleReset: 0,
    heldProcessing: 0,
  };

  async function log(withdrawalId: number, event: string, detail: Record<string, unknown>) {
    const { error } = await admin.from("payout_events").insert({ withdrawal_id: withdrawalId, event, detail });
    return !error;
  }

  // 1. Reset in-flight rows that were claimed but never handed to the wallet.
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
    .select("id,amount,address,created_at,status")
    .eq("status", "PENDING");
  const rows = (pending ?? []) as Row[];

  // 2. Aged pending, surfaced only.
  for (const row of rows) {
    if (isStale(row.created_at, now, AGED_MS)) {
      await log(row.id, "aged_pending", { days: Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86_400_000) });
      summary.agedPending++;
    }
  }

  // 3. Auto-payout.
  if (!settings.auto_payout_enabled) {
    summary.skipped = "Auto-payout is off.";
    return summary;
  }
  const privateKey = process.env.COINPAYMENTS_PRIVATE_KEY;
  const publicKey = process.env.COINPAYMENTS_PUBLIC_KEY;
  if (!privateKey || !publicKey) {
    summary.skipped = "Wallet API keys are not configured.";
    return summary;
  }

  const ceiling = Number(settings.auto_payout_max);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const batch = selectAutoPayoutBatch(rows, ceiling, MAX_PER_RUN);

  for (const row of batch) {
    if (!row.address) {
      await log(row.id, "auto_error", { error: "No payout address on file" });
      summary.autoFailed++;
      continue;
    }

    const { data: claimData, error: claimError } = await admin.rpc("claim_withdrawal_payout", { p_id: row.id });
    const claim = Array.isArray(claimData) ? claimData[0] : claimData;
    if (claimError || claim?.status !== "claimed") continue;

    // Record the attempt before the network call. If the process dies after
    // this point the row stays PROCESSING and an operator must reconcile it;
    // it is never automatically resent.
    if (!(await log(row.id, "auto_attempt", { amount: Number(row.amount) }))) {
      await admin.from("user_withdrawal").update({ status: "PENDING" }).eq("id", row.id).eq("status", "PROCESSING");
      await log(row.id, "auto_error", { error: "Could not record payout attempt" });
      summary.autoFailed++;
      continue;
    }

    try {
      const result = await createWithdrawal({
        privateKey,
        publicKey,
        amount: Number(row.amount),
        currency: settings.currency_code,
        address: row.address,
        ipnUrl: `${baseUrl}/api/ipn/coinpayments`,
      });

      if ((result as { error?: string }).error === "ok") {
        const tx = String((result.result as { id?: unknown } | undefined)?.id ?? "");
        await admin
          .from("user_withdrawal")
          .update({ tx: tx || null })
          .eq("id", row.id)
          .eq("status", "PROCESSING");
        await log(row.id, "auto_sent", { tx });
        summary.autoSent++;
      } else {
        await admin
          .from("user_withdrawal")
          .update({ status: "PENDING" })
          .eq("id", row.id)
          .eq("status", "PROCESSING");
        await log(row.id, "auto_error", { error: (result as { error?: string }).error ?? "unknown" });
        summary.autoFailed++;
      }
    } catch (e) {
      // The request may have reached CoinPayments. Leave it PROCESSING and
      // surface it for manual review rather than risking a duplicate send.
      await log(row.id, "auto_uncertain", { error: e instanceof Error ? e.message : "unknown" });
      summary.autoFailed++;
    }
  }

  return summary;
}
