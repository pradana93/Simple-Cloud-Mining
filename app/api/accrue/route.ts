import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { accrueOwnPlans } from "@/lib/accrue-user";

export const dynamic = "force-dynamic";

// Called by the live balance readout while a member has the console open, so the
// stored balance keeps pace with the number on screen. Returns the authoritative
// balance (post-write stored value plus any not-yet-persisted projection).
export async function POST() {
  const supabase = createServerSupabase();
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const { pending, credited } = await accrueOwnPlans(supabase, userId, {});
  const { data } = await supabase.from("profiles").select("balance").eq("id", userId).maybeSingle();
  const stored = Number((data as { balance: number } | null)?.balance ?? 0);
  return NextResponse.json({ ok: true, balance: stored + (pending - credited) });
}
