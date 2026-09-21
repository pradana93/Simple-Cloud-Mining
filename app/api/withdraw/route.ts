import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const { amount } = (await req.json()) as { amount: number };
  const settings = await getSettings();
  if (!Number.isFinite(amount) || amount < settings.min_withdraw || amount > settings.max_withdraw) {
    return NextResponse.json({ ok: false, error: `Amount must be between ${settings.min_withdraw} and ${settings.max_withdraw}` }, { status: 400 });
  }
  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("balance").eq("id", user.id).maybeSingle();
  if (!profile || Number((profile as { balance: number }).balance) < amount) {
    return NextResponse.json({ ok: false, error: "Insufficient earnings balance" }, { status: 400 });
  }
  await admin.from("user_withdrawal").insert({ user_id: user.id, amount });
  const { error } = await admin
    .from("profiles")
    // atomic decrement via rpc-free update: read-modify-write guarded by check above
    .update({ balance: Number((profile as { balance: number }).balance) - amount })
    .eq("id", user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
