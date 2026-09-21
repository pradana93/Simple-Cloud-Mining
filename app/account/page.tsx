import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { accrueOwnPlans } from "@/lib/accrue-user";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="py-10 text-center"><Link href="/login"><Button>Login</Button></Link></div>;
  }
  // Lazy accrual: Hobby cron runs daily only, so credit on view.
  await accrueOwnPlans(supabase, user.id);
  const [referrals, aff, deposits, withdrawals, pending] = await Promise.all([
    supabase.from("profiles").select("username,created_at").eq("reference_user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("affiliate_history").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("user_deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("user_withdrawal").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("transactions_history").select("*").eq("user_id", user.id).neq("status", "paid").order("date", { ascending: false }),
  ]);
  return (
    <div className="space-y-6 py-6">
      <h1 className="text-3xl font-bold">Account history</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Referrals ({referrals.data?.length ?? 0})</CardTitle></CardHeader><CardContent className="text-sm">{(referrals.data ?? []).map((r: { username: string }, i: number) => <div key={i}>{r.username}</div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Affiliate earnings</CardTitle></CardHeader><CardContent className="text-sm">{(aff.data ?? []).map((a: { id: number; amount: number; status: string }) => <div key={a.id}>{a.amount} — {a.status}</div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Deposits</CardTitle></CardHeader><CardContent className="text-sm">{(deposits.data ?? []).map((d: { id: number; amount: number; status: string }) => <div key={d.id}>{d.amount} — {d.status}</div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Withdrawals</CardTitle></CardHeader><CardContent className="text-sm">{(withdrawals.data ?? []).map((w: { id: number; amount: number; status: string }) => <div key={w.id}>{w.amount} — {w.status}</div>)}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Pending invoices</CardTitle></CardHeader><CardContent className="text-sm">
        {(pending.data ?? []).map((t: { hash: string | null; amount: number; status: string }) => (
          <div key={t.hash}>Invoice <Link className="underline" href={`/invoice/${t.hash}`}>{t.hash}</Link> — {t.amount} ({t.status})</div>
        ))}
      </CardContent></Card>
    </div>
  );
}
