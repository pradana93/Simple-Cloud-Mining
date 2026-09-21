import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const dynamic = "force-dynamic";
export default async function AdminUrlchains() {
  let rows: Array<{ id: number; name: string; url: string }> = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("urlchains").select("*").order("id").limit(100);
    rows = (data ?? []) as typeof rows;
  } catch { /* noop */ }
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Blockchain explorers</h1>
    <Card><CardHeader><CardTitle>URL chains ({rows.length})</CardTitle></CardHeader><CardContent className="text-sm">
      {rows.map((r) => <div key={r.id} className="border-b py-1">{r.name} — {r.url}</div>)}
    </CardContent></Card></div>;
}
