import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const dynamic = "force-dynamic";
async function rowsOf(table: string) {
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from(table).select("*").order("id", { ascending: false }).limit(100);
    return (data ?? []) as Array<Record<string, unknown>>;
  } catch { return []; }
}
export default async function AdminFaqs() {
  const rows = await rowsOf("faqs");
  return <div className="space-y-4"><h1 className="text-2xl font-bold">FAQs</h1>
    <Card><CardHeader><CardTitle>Entries ({rows.length})</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
      {rows.map((r) => <div key={String(r.id)} className="border-b py-1"><b>{String(r.question)}</b></div>)}
    </CardContent></Card></div>;
}
