import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const dynamic = "force-dynamic";
export default async function AdminContact() {
  let rows: Array<{ id: number; name: string; email: string; subject: string; status: string }> = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("contact").select("*").order("created_at", { ascending: false }).limit(100);
    rows = (data ?? []) as typeof rows;
  } catch { /* noop */ }
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Contact messages</h1>
    <Card><CardHeader><CardTitle>Inbox ({rows.length})</CardTitle></CardHeader><CardContent className="text-sm">
      {rows.map((r) => <div key={r.id} className="border-b py-1">{r.name} ({r.email}) — {r.subject} [{r.status}]</div>)}
    </CardContent></Card></div>;
}
