import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminUrlchains() {
  let rows: Array<{ id: number; name: string; url: string }> = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("urlchains").select("*").order("id").limit(100);
    rows = (data ?? []) as typeof rows;
  } catch {
    rows = [];
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">Blockchain explorers</h1>
      <Card>
        <CardHeader><CardTitle>URL chains ({rows.length})</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {rows.length === 0 ? (
            <p className="text-slate-400">No explorers configured. These back the transaction links shown to members.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-white">{r.name}</span>
                  <span className="font-mono text-xs text-slate-400">{r.url}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
