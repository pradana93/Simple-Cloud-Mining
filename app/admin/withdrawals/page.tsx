import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { WithdrawalsManager, type AdminWithdrawal } from "@/components/admin/withdrawals-manager";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawals() {
  const settings = await getSettings();
  let rows: AdminWithdrawal[] = [];
  try {
    const admin = createAdminSupabase();
    const [wRes, pRes] = await Promise.all([
      admin
        .from("user_withdrawal")
        .select("id,user_id,amount,status,tx,created_at,date_paid")
        .order("created_at", { ascending: false })
        .limit(200),
      admin.from("profiles").select("id,username").limit(1000),
    ]);
    const names = new Map<string, string | null>();
    for (const p of (pRes.data ?? []) as Array<{ id: string; username: string | null }>) names.set(p.id, p.username);
    rows = ((wRes.data ?? []) as Array<Omit<AdminWithdrawal, "username">>).map((r) => ({
      ...r,
      username: names.get(r.user_id) ?? null,
    }));
  } catch {
    rows = [];
  }

  return (
    <WithdrawalsManager
      rows={rows}
      symbol={settings.currency_symbol}
      code={settings.currency_code}
      decimals={settings.currency_decimals}
    />
  );
}
