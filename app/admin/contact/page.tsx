import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminContact() {
  let rows: Array<{ id: number; name: string; email: string; subject: string; status: string }> = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("contact").select("*").order("created_at", { ascending: false }).limit(100);
    rows = (data ?? []) as typeof rows;
  } catch {
    rows = [];
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">Contact messages</h1>
      <Card>
        <CardHeader><CardTitle>Inbox ({rows.length})</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {rows.length === 0 ? (
            <p className="text-slate-400">No messages. Submissions from the contact form land here.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-white">{r.name} <span className="text-slate-400">({r.email})</span></span>
                  <span className="text-slate-300">{r.subject}</span>
                  <span className="text-xs text-slate-400">{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
