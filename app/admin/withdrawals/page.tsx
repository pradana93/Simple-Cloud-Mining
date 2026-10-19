import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { WithdrawalsManager, type AdminWithdrawal } from "@/components/admin/withdrawals-manager";
import { PayoutOps, type PayoutEvent } from "@/components/admin/payout-ops";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawals() {
  const settings = await getSettings();
  let rows: AdminWithdrawal[] = [];
  let events: PayoutEvent[] = [];
  try {
    const admin = createAdminSupabase();
    const [wRes, pRes, eRes] = await Promise.all([
      admin
        .from("user_withdrawal")
        .select("id,user_id,amount,status,tx,address,created_at,date_paid")
        .order("created_at", { ascending: false })
        .limit(200),
      admin.from("profiles").select("id,username").limit(1000),
      admin
        .from("payout_events")
        .select("id,withdrawal_id,event,detail,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const names = new Map<string, string | null>();
    for (const p of (pRes.data ?? []) as Array<{ id: string; username: string | null }>) names.set(p.id, p.username);
    rows = ((wRes.data ?? []) as Array<Omit<AdminWithdrawal, "username">>).map((r) => ({
      ...r,
      username: names.get(r.user_id) ?? null,
    }));
    events = (eRes.data ?? []) as PayoutEvent[];
  } catch {
    rows = [];
    events = [];
  }

  return (
    <div className="space-y-4">
      <PayoutOps
        autoEnabled={settings.auto_payout_enabled}
        ceiling={Number(settings.auto_payout_max)}
        code={settings.currency_code}
        events={events}
      />
      <WithdrawalsManager
        rows={rows}
        symbol={settings.currency_symbol}
        code={settings.currency_code}
        decimals={settings.currency_decimals}
      />
    </div>
  );
}
