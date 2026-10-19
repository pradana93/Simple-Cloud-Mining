import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// Shared guard for admin-only API routes: 401 for anonymous, 403 for non-admins.
export async function requireAdminApi(): Promise<{ userId: string; name: string | null } | { error: NextResponse }> {
  let userId: string | null = null;
  try {
    const { data: { user } } = await createServerSupabase().auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  }
  try {
    const { data } = await createAdminSupabase().from("profiles").select("is_admin,username").eq("id", userId).maybeSingle();
    if (!(data as { is_admin?: boolean } | null)?.is_admin) {
      return { error: NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 }) };
    }
    return { userId, name: (data as { username?: string | null }).username ?? null };
  } catch {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
}
