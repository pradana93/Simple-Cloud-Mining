import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  let rows: Array<Record<string, unknown>> = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("profiles").select("id,username,email,balance,affiliate_earns,is_admin,created_at").order("created_at", { ascending: false }).limit(100);
    rows = (data ?? []) as Array<Record<string, unknown>>;
  } catch { /* build without env */ }
  return (
    <div className="space-y-4"><h1 className="text-2xl font-bold">Users</h1>
      <Card><CardHeader><CardTitle>Members ({rows.length})</CardTitle></CardHeader><CardContent className="overflow-x-auto text-xs">
        <table className="w-full border-collapse"><thead><tr><th className="border p-1 text-left">username</th><th className="border p-1 text-left">email</th><th className="border p-1 text-left">balance</th><th className="border p-1 text-left">admin</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td className="border p-1">{String(r.username)}</td><td className="border p-1">{String(r.email ?? "")}</td><td className="border p-1">{String(r.balance)}</td><td className="border p-1">{String(r.is_admin)}</td></tr>)}</tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
