import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { LABEL_MAX, MAX_ALLOWLIST, validAddress } from "@/lib/allowlist";

async function sessionUser() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function POST(req: Request) {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  let body: { label?: unknown; address?: unknown };
  try {
    body = (await req.json()) as { label?: unknown; address?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const address = String(body.address ?? "").trim();
  const label = String(body.label ?? "").trim().slice(0, LABEL_MAX) || null;

  if (!validAddress(address)) {
    return NextResponse.json({ ok: false, error: "Enter a valid wallet address" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { count } = await admin
    .from("withdrawal_allowlist")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_ALLOWLIST) {
    return NextResponse.json({ ok: false, error: `You can save up to ${MAX_ALLOWLIST} addresses` }, { status: 400 });
  }

  const settings = await getSettings();
  const { error } = await admin.from("withdrawal_allowlist").insert({
    user_id: user.id,
    label,
    currency: settings.currency_code,
    address,
  });
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { ok: false, error: duplicate ? "That address is already saved" : error.message },
      { status: duplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  let body: { id?: unknown };
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid address" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("withdrawal_allowlist")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
