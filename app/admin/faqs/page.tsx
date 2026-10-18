import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function rowsOf(table: string) {
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from(table).select("*").order("id", { ascending: false }).limit(100);
    return (data ?? []) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

export default async function AdminFaqs() {
  const rows = await rowsOf("faqs");
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">FAQs</h1>
      <Card>
        <CardHeader><CardTitle>Entries ({rows.length})</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {rows.length === 0 ? (
            <p className="text-slate-400">No entries. Add rows to the `faqs` table to publish answers on the FAQ page.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div key={String(r.id)} className="py-2 text-white">{String(r.question)}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
