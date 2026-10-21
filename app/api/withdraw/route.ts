import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { recordEvent } from "@/lib/risk-telemetry";
import { requireFreshMfa } from "@/lib/mfa-guard";
import { firstRow, requestIdempotencyKey } from "@/lib/ledger";

const ADDRESS_MIN = 8;
const ADDRESS_MAX = 200;

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  let body: { amount?: unknown; address?: unknown; idempotencyKey?: unknown };
  try {
    body = (await req.json()) as { amount?: unknown; address?: unknown; idempotencyKey?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const address = String(body.address ?? "").trim();
  const settings = await getSettings();

  if (!Number.isFinite(amount) || amount <= 0 || amount < settings.min_withdraw || amount > settings.max_withdraw) {
    return NextResponse.json(
      { ok: false, error: `Amount must be between ${settings.min_withdraw} and ${settings.max_withdraw} ${settings.currency_code}` },
      { status: 400 }
    );
  }
  if (address.length < ADDRESS_MIN || address.length > ADDRESS_MAX || /\s/.test(address)) {
    return NextResponse.json({ ok: false, error: "Enter a valid payout wallet address" }, { status: 400 });
  }

  const mfa = await requireFreshMfa(user.id);
  if (mfa) return mfa;

  const admin = createAdminSupabase();

  // Refuse anything not on the member's allowlist. An empty list is not locked,
  // so first-time withdrawals are unaffected until they save an address.
  const { data: allowedRows, error: allowError } = await admin
    .from("withdrawal_allowlist")
    .select("address")
    .eq("user_id", user.id);
  if (allowError) return NextResponse.json({ ok: false, error: allowError.message }, { status: 500 });
  const allowed = (allowedRows ?? []) as Array<{ address: string }>;
  if (allowed.length > 0 && !allowed.some((r) => (r.address ?? "").trim() === address)) {
    return NextResponse.json(
      { ok: false, error: "This address is not on your allowlist. Add it before requesting a payout." },
      { status: 403 }
    );
  }

  // The database reserves the balance and creates the request in one
  // transaction, so a retry or a crash can never debit without a row.
  const idempotency = requestIdempotencyKey(req, user.id, "withdraw", body.idempotencyKey);
  const { data, error } = await admin.rpc("request_withdrawal", {
    p_user: user.id,
    p_amount: amount,
    p_address: address,
    p_idempotency_key: idempotency,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const row = firstRow<{ status?: string; withdrawal_id?: unknown; balance?: unknown }>(data);
  const id = row?.withdrawal_id == null ? null : Number(row.withdrawal_id);
  if (row?.status === "insufficient") {
    return NextResponse.json({ ok: false, error: "Insufficient earnings balance" }, { status: 400 });
  }
  if (row?.status !== "applied" && row?.status !== "duplicate") {
    return NextResponse.json({ ok: false, error: "Could not create the withdrawal" }, { status: 500 });
  }
  if (row.status === "applied") {
    await recordEvent({ userId: user.id, kind: "withdraw", req, detail: { amount } });
  }

  return NextResponse.json({ ok: true, id });
}
