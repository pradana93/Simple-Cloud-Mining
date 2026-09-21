import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const dynamic = "force-dynamic";
export default async function AdminTransactions() {
  let rows: Array<Record<string, string | number>> = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("transactions_history").select("*").order("date", { ascending: false }).limit(100);
    rows = (data ?? []) as typeof rows;
  } catch { /* noop */ }
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Transactions</h1>
    <Card><CardHeader><CardTitle>Invoices ({rows.length})</CardTitle></CardHeader><CardContent className="overflow-x-auto text-xs">
      <table className="w-full border-collapse"><thead><tr>{["id", "user_id", "plan_id", "amount", "status", "hash"].map((c) => <th key={c} className="border p-1 text-left">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}><td className="border p-1">{r.id}</td><td className="border p-1">{String(r.user_id).slice(0, 8)}</td><td className="border p-1">{r.plan_id}</td><td className="border p-1">{r.amount}</td><td className="border p-1">{r.status}</td><td className="border p-1">{String(r.hash ?? "").slice(0, 16)}</td></tr>)}</tbody></table>
    </CardContent></Card></div>;
}
