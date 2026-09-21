import { createServerSupabase } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { totalMiningRate } from "@/lib/mining";
import { formatCrypto } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { accrueOwnPlans } from "@/lib/accrue-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="py-10 text-center">
        <p className="mb-4">Please login to view your dashboard.</p>
        <Link href="/login"><Button>Login</Button></Link>
      </div>
    );
  }
  // Lazy accrual: Hobby cron runs daily only, so credit on view.
  await accrueOwnPlans(supabase, user.id);
  const s = await getSettings();
  const [{ data: profile }, { data: activePlans }, { data: paidPlans }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_plan_history").select("*, plan:plans(*)").eq("user_id", user.id).eq("status", "active"),
    supabase.from("plans").select("*").order("price"),
  ]);
  const rate = totalMiningRate((activePlans ?? []).map((r: { plan: { earning_rate: number | null } }) => ({ earning_rate: r.plan?.earning_rate ?? null })));

  return (
    <div className="space-y-6 py-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Balance</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatCrypto(Number((profile as { balance: number } | null)?.balance ?? 0), s.currency_decimals)} {s.currency_code}</CardContent></Card>
        <Card><CardHeader><CardTitle>Mining rate</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatCrypto(rate, 8)}/min</CardContent></Card>
        <Card><CardHeader><CardTitle>Active plans</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{(activePlans ?? []).length}</CardContent></Card>
      </div>
      <h2 className="text-xl font-semibold">Active miners</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {(activePlans ?? []).map((r: { id: number; expire_date: string | null; plan: { plan_name: string; version: string | null } }) => (
          <Card key={r.id}><CardContent className="pt-6 text-sm">
            <div className="font-semibold">{r.plan.plan_name} {r.plan.version}</div>
            <div className="text-zinc-500">Expires: {r.expire_date ?? "never"}</div>
          </CardContent></Card>
        ))}
      </div>
      <h2 className="text-xl font-semibold">Upgrade mining</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {(paidPlans ?? []).filter((p: { price: number }) => Number(p.price) > 0).map((p: { id: number; plan_name: string; price: number }) => (
          <Card key={p.id}><CardContent className="pt-6 text-sm">
            <div className="font-semibold">{p.plan_name}</div>
            <div>{formatCrypto(Number(p.price), s.currency_decimals)} {s.currency_code}</div>
            <Link href={`/purchase/${p.id}`}><Button className="mt-2 w-full">Buy</Button></Link>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
