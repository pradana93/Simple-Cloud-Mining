import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const dynamic = "force-dynamic";
export default async function AdminWithdrawals() {
  let rows: Array<{ id: number; user_id: string; amount: number; status: string; created_at: string }> = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("user_withdrawal").select("*").order("created_at", { ascending: false }).limit(100);
    rows = (data ?? []) as typeof rows;
  } catch { /* noop */ }
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Withdrawals</h1>
    <Card><CardHeader><CardTitle>Requests ({rows.length})</CardTitle></CardHeader><CardContent className="text-sm">
      {rows.map((r) => <div key={r.id} className="flex justify-between border-b py-1"><span>#{r.id} {String(r.user_id).slice(0, 8)} — {r.amount}</span><span>{r.status}</span></div>)}
    </CardContent></Card></div>;
}
