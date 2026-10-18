import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

// Admin gate: redirect anonymous users to /login, 404 signed-in non-admins, fail closed on error.
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
