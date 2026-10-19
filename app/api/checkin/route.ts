import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { checkinBonus, computeStreak, utcDay } from "@/lib/checkin";
import { recordEvent } from "@/lib/risk-telemetry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const settings = await getSettings();
  const base = Number(settings.checkin_amount);
  if (!settings.checkin_enabled || !(base > 0)) {
    return NextResponse.json({ ok: false, error: "The daily bonus is off right now." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const today = utcDay(new Date());
  const { data: lastRow } = await admin
    .from("checkins")
    .select("day,streak")
    .eq("user_id", user.id)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = lastRow as { day: string; streak: number } | null;
  if (last?.day === today) {
    return NextResponse.json({ ok: false, error: "You already claimed today. Come back tomorrow." }, { status: 409 });
  }

  const streak = computeStreak(last, today);
  const amount = checkinBonus(base, streak);

  const { error } = await admin.from("checkins").insert({ user_id: user.id, day: today, amount, streak });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: false, error: "You already claimed today. Come back tomorrow." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await admin.rpc("credit_balance", { p_user_id: user.id, p_amount: amount });
  await recordEvent({ userId: user.id, kind: "checkin", req, detail: { amount, streak } });

  return NextResponse.json({ ok: true, amount, streak });
}
