import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  username: string | null;
  email: string | null;
  balance: number | null;
  is_admin: boolean | null;
  created_at: string | null;
};

export default async function AdminUsers() {
  let rows: UserRow[] = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("profiles")
      .select("id,username,email,balance,is_admin,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data ?? []) as UserRow[];
  } catch {
    rows = [];
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">Members</h1>
      <Card>
        <CardHeader><CardTitle>Registered members ({rows.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto text-sm">
          {rows.length === 0 ? (
            <p className="text-slate-400">No members yet. Accounts appear here after signup.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-2 pr-4 font-medium">Member</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Balance</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Joined</th>
                  <th className="py-2 pr-4 font-medium">Credentials</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-2 pr-4 font-medium text-white">{r.username ?? "unknown"}</td>
                    <td className="py-2 pr-4 text-slate-300">{r.email ?? ""}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums text-slate-200">{Number(r.balance ?? 0)}</td>
                    <td className="py-2 pr-4">
                      {r.is_admin ? <Badge variant="gold">admin</Badge> : <span className="text-slate-400">member</span>}
                    </td>
                    <td className="py-2 pr-4 text-slate-300">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</td>
                    <td className="py-2 pr-4">
                      <ResetPasswordButton userId={r.id} username={r.username ?? "member"} />
                    </td>
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
