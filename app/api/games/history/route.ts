import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { data, error } = await createAdminSupabase()
    .from("game_bets")
    .select("id,game,stake,multiplier,payout,won,nonce,server_seed_hash,client_seed,created_at,result")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, bets: data ?? [] });
}
