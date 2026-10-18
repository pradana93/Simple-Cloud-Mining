import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Row = { id: number; user_id: string; amount: number; status: string; created_at: string };

function statusVariant(s: string): "green" | "gold" | "red" | "slate" {
  const v = s.toLowerCase();
  if (["paid", "success"].includes(v)) return "green";
  if (["pending", "waiting", "processing"].includes(v)) return "gold";
  if (["canceled", "cancelled", "failed"].includes(v)) return "red";
  return "slate";
}

export default async function AdminWithdrawals() {
  let rows: Row[] = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("user_withdrawal").select("*").order("created_at", { ascending: false }).limit(100);
    rows = (data ?? []) as Row[];
  } catch {
    rows = [];
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">Withdrawals</h1>
      <Card>
        <CardHeader><CardTitle>Requests ({rows.length})</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {rows.length === 0 ? (
            <p className="text-slate-400">No withdrawal requests. New requests need manual review here.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-mono text-xs text-slate-400">#{r.id} {String(r.user_id).slice(0, 8)}</span>
                  <span className="font-mono tabular-nums text-white">{Number(r.amount)}</span>
                  <Badge variant={statusVariant(String(r.status ?? ""))}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
