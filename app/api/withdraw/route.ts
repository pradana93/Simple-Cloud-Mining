import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { recordEvent } from "@/lib/risk-telemetry";
import { requireFreshMfa } from "@/lib/mfa-guard";

const ADDRESS_MIN = 8;
const ADDRESS_MAX = 200;

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  let body: { amount?: unknown; address?: unknown };
  try {
    body = (await req.json()) as { amount?: unknown; address?: unknown };
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

  // Atomic reserve: one guarded UPDATE so concurrent requests can't overspend.
  const { data: debited, error: debitError } = await admin.rpc("debit_balance", {
    p_user_id: user.id,
    p_amount: amount,
  });
  if (debitError) return NextResponse.json({ ok: false, error: debitError.message }, { status: 500 });
  if (debited == null) {
    return NextResponse.json({ ok: false, error: "Insufficient earnings balance" }, { status: 400 });
  }

  const { data: created, error: insertError } = await admin
    .from("user_withdrawal")
    .insert({ user_id: user.id, amount, address })
    .select("id")
    .maybeSingle();
  if (insertError) {
    // Refund the reserved amount so a member never loses balance to a failed row.
    await admin.rpc("credit_balance", { p_user_id: user.id, p_amount: amount });
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  }
  const id = (created as { id: number } | null)?.id ?? null;
  await recordEvent({ userId: user.id, kind: "withdraw", req, detail: { amount } });

  return NextResponse.json({ ok: true, id });
}
