import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminIpnLogs() {
  let rows: Array<{ id: number; message: string | null; status: string | null; created_at: string }> = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("ipn_errors").select("*").order("created_at", { ascending: false }).limit(100);
    rows = (data ?? []) as typeof rows;
  } catch {
    rows = [];
  }
  return (
    <div className="space-y-4">
      <AdminPageHeader title="IPN logs" />
      <Card>
        <CardHeader><CardTitle>CoinPayments callback errors ({rows.length})</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {rows.length === 0 ? (
            <p className="text-slate-400">No callback errors recorded. A clean log means every IPN was accepted.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-white">{r.message ?? "no message"}</span>
                  <span className="text-xs text-slate-400">{r.status ?? "unknown"}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
