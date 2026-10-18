import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { TransactionsManager, type AdminInvoice } from "@/components/admin/transactions-manager";

export const dynamic = "force-dynamic";

export default async function AdminTransactions() {
  const settings = await getSettings();
  let rows: AdminInvoice[] = [];
  try {
    const admin = createAdminSupabase();
    const [tRes, pRes] = await Promise.all([
      admin
        .from("transactions_history")
        .select("id,user_id,plan_id,amount,status,hash,date")
        .order("date", { ascending: false })
        .limit(200),
      admin.from("profiles").select("id,username").limit(1000),
    ]);
    const names = new Map<string, string | null>();
    for (const p of (pRes.data ?? []) as Array<{ id: string; username: string | null }>) names.set(p.id, p.username);
    rows = ((tRes.data ?? []) as Array<Omit<AdminInvoice, "username">>).map((r) => ({
      ...r,
      username: r.user_id ? names.get(r.user_id) ?? null : null,
    }));
  } catch {
    rows = [];
  }

  return (
    <TransactionsManager
      rows={rows}
      symbol={settings.currency_symbol}
      code={settings.currency_code}
      decimals={settings.currency_decimals}
    />
  );
}
