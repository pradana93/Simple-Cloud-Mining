import { createServerSupabase } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCrypto } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const s = await getSettings();
  let deposits: Array<{ amount: number; tx: string | null; created_at: string }> = [];
  let withdrawals: Array<{ amount: number; tx: string | null; created_at: string; status: string }> = [];
  try {
    const supabase = createServerSupabase();
    const [d, w] = await Promise.all([
      supabase.from("user_deposits").select("amount,tx,created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("user_withdrawal").select("amount,tx,created_at,status").order("created_at", { ascending: false }).limit(20),
    ]);
    deposits = ((d as { data: unknown }).data ?? []) as typeof deposits;
    withdrawals = ((w as { data: unknown }).data ?? []) as typeof withdrawals;
  } catch {
    // DB unreachable — render empty lists.
  }
  return (
    <div className="space-y-6 py-6">
      <h1 className="text-3xl font-bold">Live payouts</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Latest deposits</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          {(deposits ?? []).map((d, i) => (
            <div key={i} className="flex justify-between border-b py-1"><span>{formatCrypto(Number(d.amount), s.currency_decimals)} {s.currency_code}</span><span className="text-zinc-500">{d.tx ?? "—"}</span></div>
          ))}
          {(deposits ?? []).length === 0 && <p className="text-zinc-500">No deposits yet.</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Latest withdrawals</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          {(withdrawals ?? []).map((w, i) => (
            <div key={i} className="flex justify-between border-b py-1"><span>{formatCrypto(Number(w.amount), s.currency_decimals)} {s.currency_code}</span><span className="text-zinc-500">{w.status}</span></div>
          ))}
          {(withdrawals ?? []).length === 0 && <p className="text-zinc-500">No withdrawals yet.</p>}
        </CardContent></Card>
      </div>
    </div>
  );
}
