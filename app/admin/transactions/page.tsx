import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type TxRow = {
  id: number;
  user_id: string | null;
  plan_id: number | null;
  amount: number | null;
  status: string | null;
  hash: string | null;
  date: string | null;
};

function statusVariant(s: string | null): "green" | "gold" | "red" | "slate" {
  const v = String(s ?? "").toLowerCase();
  if (["paid", "success"].includes(v)) return "green";
  if (["pending", "waiting", "processing"].includes(v)) return "gold";
  if (["canceled", "cancelled", "failed"].includes(v)) return "red";
  return "slate";
}

export default async function AdminTransactions() {
  let rows: TxRow[] = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("transactions_history")
      .select("id,user_id,plan_id,amount,status,hash,date")
      .order("date", { ascending: false })
      .limit(100);
    rows = (data ?? []) as TxRow[];
  } catch {
    rows = [];
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">Transactions</h1>
      <Card>
        <CardHeader><CardTitle>Invoices ({rows.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto text-sm">
          {rows.length === 0 ? (
            <p className="text-slate-400">No invoices yet. They appear here once a buyer starts checkout.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Member</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-2 pr-4 text-slate-300">{r.date ? new Date(r.date).toLocaleDateString() : ""}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-300">{String(r.user_id ?? "").slice(0, 8)}</td>
                    <td className="py-2 pr-4 text-slate-300">{r.plan_id != null ? `#${r.plan_id}` : ""}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums text-slate-200">{r.amount ?? ""}</td>
                    <td className="py-2 pr-4"><Badge variant={statusVariant(r.status)}>{r.status ?? "unknown"}</Badge></td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-400">{String(r.hash ?? "").slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
