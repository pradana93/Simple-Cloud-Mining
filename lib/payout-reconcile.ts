import { createAdminSupabase } from "./supabase/admin";
import { getSettings } from "./settings";
import { createWithdrawal } from "./coinpayments";
import { isStale, selectAutoPayoutBatch, type WithdrawalLike } from "./payouts";

// One pass of the payout queue, shared by the nightly cron and the admin
// "run now" action:
//   1. Reconciliation: an in-flight row that never settled is put back in the
//      queue so it can be retried or handled by hand.
//   2. Aged pending: requests left untouched for a week are flagged (no state
//      change) so an operator notices them.
//   3. Auto-payout: when enabled and the wallet API is configured, eligible
//      requests are sent, oldest first, up to a per-run cap.
const STALE_MS = 60 * 60 * 1000;
const AGED_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 25;
const SETTLED = ["PENDING", "SUCCESS", "CANCELED"];

export type PayoutSummary = {
  autoSent: number;
  autoFailed: number;
  agedPending: number;
  staleReset: number;
  skipped?: string;
};

type Row = WithdrawalLike & { address: string | null };

export async function runPayoutPass(now = new Date()): Promise<PayoutSummary> {
  const admin = createAdminSupabase();
  const settings = await getSettings();
  const summary: PayoutSummary = { autoSent: 0, autoFailed: 0, agedPending: 0, staleReset: 0 };

  async function log(withdrawalId: number, event: string, detail: Record<string, unknown>) {
    await admin.from("payout_events").insert({ withdrawal_id: withdrawalId, event, detail });
  }

  // 1. Reset in-flight rows that went quiet.
  const { data: inFlight } = await admin
    .from("user_withdrawal")
    .select("id,status,created_at")
    .not("status", "in", `(${SETTLED.map((s) => `"${s}"`).join(",")})`);
  for (const row of (inFlight ?? []) as Array<{ id: number; status: string; created_at: string }>) {
    if (isStale(row.created_at, now, STALE_MS)) {
      const { error } = await admin.from("user_withdrawal").update({ status: "PENDING" }).eq("id", row.id);
      if (!error) {
        await log(row.id, "stale_reset", { from: row.status });
        summary.staleReset++;
      }
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
    await admin.from("user_withdrawal").update({ status: "PROCESSING" }).eq("id", row.id);
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
          .update({ status: "SUCCESS", tx: tx || null, date_paid: now.toISOString() })
          .eq("id", row.id);
        await log(row.id, "auto_sent", { tx });
        summary.autoSent++;
      } else {
        await admin.from("user_withdrawal").update({ status: "PENDING" }).eq("id", row.id);
        await log(row.id, "auto_error", { error: (result as { error?: string }).error ?? "unknown" });
        summary.autoFailed++;
      }
    } catch (e) {
      await admin.from("user_withdrawal").update({ status: "PENDING" }).eq("id", row.id);
      await log(row.id, "auto_error", { error: e instanceof Error ? e.message : "unknown" });
      summary.autoFailed++;
    }
  }

  return summary;
}
