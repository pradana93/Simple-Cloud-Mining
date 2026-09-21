import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const dynamic = "force-dynamic";
export default async function AdminIpnLogs() {
  let rows: Array<{ id: number; message: string | null; status: string | null; created_at: string }> = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("ipn_errors").select("*").order("created_at", { ascending: false }).limit(100);
    rows = (data ?? []) as typeof rows;
  } catch { /* noop */ }
  return <div className="space-y-4"><h1 className="text-2xl font-bold">IPN logs</h1>
    <Card><CardHeader><CardTitle>Errors ({rows.length})</CardTitle></CardHeader><CardContent className="text-sm">
      {rows.map((r) => <div key={r.id} className="border-b py-1">{r.message} [{r.status ?? "-"}]</div>)}
    </CardContent></Card></div>;
}
