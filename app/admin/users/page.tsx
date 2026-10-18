import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { UsersManager, type AdminMember, type PlanOption } from "@/components/admin/users-manager";

export const dynamic = "force-dynamic";

type ProfileRow = Omit<AdminMember, "rigs">;

export default async function AdminUsers() {
  const settings = await getSettings();
  let members: AdminMember[] = [];
  let plans: PlanOption[] = [];
  let currentUserId = "";

  try {
    const admin = createAdminSupabase();
    const [profilesRes, rigsRes, plansRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id,username,email,balance,is_admin,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      admin.from("user_plan_history").select("user_id,status").eq("status", "active"),
      admin.from("plans").select("id,plan_name,version,duration").order("price"),
    ]);
    const rigs = new Map<string, number>();
    for (const row of (rigsRes.data ?? []) as Array<{ user_id: string }>) {
      rigs.set(row.user_id, (rigs.get(row.user_id) ?? 0) + 1);
    }
    members = ((profilesRes.data ?? []) as ProfileRow[]).map((u) => ({ ...u, rigs: rigs.get(u.id) ?? 0 }));
    plans = ((plansRes.data ?? []) as PlanOption[]).map((p) => ({ ...p, version: p.version ?? null }));
  } catch {
    members = [];
    plans = [];
  }

  try {
    const {
      data: { user },
    } = await createServerSupabase().auth.getUser();
    currentUserId = user?.id ?? "";
  } catch {
    currentUserId = "";
  }

  return (
    <UsersManager
      members={members}
      plans={plans}
      symbol={settings.currency_symbol}
      code={settings.currency_code}
      decimals={settings.currency_decimals}
      currentUserId={currentUserId}
    />
  );
}
