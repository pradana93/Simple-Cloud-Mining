import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: { hash: string } }) {
  let inv: { amount: number; status: string; params: { address?: string; amount?: string; timeout?: number } | null; date: string } | null = null;
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("transactions_history").select("*").eq("hash", params.hash).maybeSingle();
    inv = data as typeof inv;
  } catch {
    inv = null;
  }
  if (!inv) return <p className="py-10">Invoice not found.</p>;
  const tx = inv as { amount: number; status: string; params: { address?: string; amount?: string; timeout?: number } | null; date: string };
  const p = (tx.params ?? {}) as { address?: string; amount?: string; timeout?: number };
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card><CardHeader><CardTitle>Invoice {params.hash}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Status: <b>{tx.status}</b></div>
          <div>Amount: <b>{tx.amount}</b></div>
          {p.address && <div>Send exactly <b>{p.amount}</b> to <code className="break-all">{p.address}</code></div>}
          {p.timeout && <div>Payment window: {p.timeout}s from {tx.date}</div>}
        </CardContent></Card>
    </div>
  );
}
