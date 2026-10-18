import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";

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

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("balance").eq("id", user.id).maybeSingle();
  const balance = Number((profile as { balance: number } | null)?.balance ?? 0);
  if (!profile || balance < amount) {
    return NextResponse.json({ ok: false, error: "Insufficient earnings balance" }, { status: 400 });
  }

  const { data: created, error: insertError } = await admin
    .from("user_withdrawal")
    .insert({ user_id: user.id, amount, address })
    .select("id")
    .maybeSingle();
  if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  const id = (created as { id: number } | null)?.id ?? null;

  // Read-modify-write guarded by the balance check above. If the debit fails,
  // drop the request row so a member never sees a phantom withdrawal.
  const { error } = await admin.from("profiles").update({ balance: balance - amount }).eq("id", user.id);
  if (error) {
    if (id) await admin.from("user_withdrawal").delete().eq("id", id);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
