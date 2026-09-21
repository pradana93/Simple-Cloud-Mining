import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCrypto } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getSettings();
  let plans: Array<{ id: number; plan_name: string; version: string | null; price: number; point_per_day: number | null; duration: number; profit: string | null; speed: string }> = [];
  let totalUsers = 0;
  try {
    const supabase = createServerSupabase();
    const { data: p } = await supabase.from("plans").select("*").order("price", { ascending: true });
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    plans = (p ?? []) as typeof plans;
    totalUsers = count ?? 0;
  } catch {
    // DB unreachable (e.g. env not configured) — render with empty catalog.
  }

  return (
    <div className="space-y-8 py-6">
      <section className="rounded-xl bg-zinc-900 p-10 text-white">
        <h1 className="text-4xl font-bold">{settings.sitename}</h1>
        <p className="mt-2 text-zinc-300">{settings.siteslogan} — {settings.currency_name} ({settings.currency_code}) cloud mining</p>
        <div className="mt-6 flex gap-3">
          <Link href="/register"><Button>Start mining</Button></Link>
          <Link href="/payouts"><Button variant="secondary">Live payouts</Button></Link>
        </div>
        <div className="mt-6 flex gap-8 text-sm text-zinc-300">
          <span>👥 {totalUsers ?? 0} miners</span>
          <span>⚡ {plans?.length ?? 0} plans</span>
          <span>🪙 {settings.coin_cur1}/{settings.coin_cur2}</span>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Mining plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(plans ?? []).map((p) => (
            <Card key={p.id}>
              <CardHeader><CardTitle>{p.plan_name} <span className="text-sm font-normal text-zinc-500">{p.version}</span></CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-3xl font-bold">{formatCrypto(Number(p.price), settings.currency_decimals)} <span className="text-sm">{settings.currency_code}</span></div>
                <div>⚡ {String(p.speed)} • 💰 {formatCrypto(Number(p.point_per_day ?? 0), settings.currency_decimals)}/day</div>
                <div>⏳ {p.duration} days • 📈 {p.profit ?? "-"}%</div>
                <Link href={p.price > 0 ? `/purchase/${p.id}` : "/register"}>
                  <Button className="mt-2 w-full">{Number(p.price) === 0 ? "Claim free plan" : "Purchase plan"}</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
