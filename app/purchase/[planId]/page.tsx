import { createServerSupabase } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PurchaseButton } from "@/components/purchase-button";
import { formatCrypto } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PurchasePage({ params }: { params: { planId: string } }) {
  const s = await getSettings();
  const supabase = createServerSupabase();
  const { data: plan } = await supabase.from("plans").select("*").eq("id", Number(params.planId)).maybeSingle();
  if (!plan) return <p className="py-10">Plan not found.</p>;
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card><CardHeader><CardTitle>Purchase {(plan as { plan_name: string }).plan_name}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-2xl font-bold">{formatCrypto(Number((plan as { price: number }).price), s.currency_decimals)} {s.currency_code}</div>
          <div>Pay with {s.coin_cur1} → {s.coin_cur2} via CoinPayments ({s.coin_mode} mode).</div>
          <PurchaseButton planId={Number(params.planId)} />
        </CardContent></Card>
    </div>
  );
}
