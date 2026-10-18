import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Server-side admin gate. Call at the top of any admin server component
 * BEFORE touching the service-role client. Fails closed: an unauthenticated
 * visitor is sent to /login, a signed-in non-admin gets a 404 (no hint that
 * the area exists), and any auth/DB error also 404s rather than leaking.
 */
export async function requireAdmin(): Promise<{ id: string; email: string | null }> {
  const supabase = createServerSupabase();
  let user: { id: string; email?: string | null } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }
  if (!user) redirect("/login");

  try {
    const { data } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!(data as { is_admin?: boolean } | null)?.is_admin) notFound();
  } catch {
    notFound();
  }

  return { id: user.id, email: user.email ?? null };
}
