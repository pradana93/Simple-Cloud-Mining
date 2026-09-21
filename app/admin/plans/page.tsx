import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function table<T>(name: string, order = "id") {
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from(name).select("*").order(order, { ascending: false }).limit(100);
    return (data ?? []) as T[];
  } catch {
    return [] as T[];
  }
}

function Generic({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  const cols = rows.length ? Object.keys(rows[0]).slice(0, 8) : [];
  return (
    <Card><CardHeader><CardTitle>{title} ({rows.length})</CardTitle></CardHeader><CardContent className="overflow-x-auto text-xs">
      <table className="w-full border-collapse">
        <thead><tr>{cols.map((c) => <th key={c} className="border p-1 text-left">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="border p-1">{String(r[c] ?? "")?.slice(0, 60)}</td>)}</tr>)}</tbody>
      </table>
    </CardContent></Card>
  );
}

export default async function AdminPlans() {
  const rows = await table<Record<string, unknown>>("plans");
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Plans</h1><Generic title="plans" rows={rows} /></div>;
}
