import Link from "next/link";
import { ArrowLeft, Hourglass, QrCode, ShieldCheck } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { CopyButton } from "@/components/copy-button";
import { Countdown } from "@/components/countdown";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Invoice = {
  amount: number;
  status: string;
  params: { address?: string; amount?: string; timeout?: number; txn_id?: string } | null;
  date: string;
};

export default async function InvoicePage({ params }: { params: { hash: string } }) {
  let inv: Invoice | null = null;
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("transactions_history").select("*").eq("hash", params.hash).maybeSingle();
    inv = data as Invoice | null;
  } catch {
    inv = null;
  }
  if (!inv) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Invoice not found</h1>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-gold-300">← Back to console</Link>
      </div>
    );
  }
  const p = inv.params ?? {};
  const deadline = p.timeout ? new Date(new Date(inv.date).getTime() + p.timeout * 1000).toISOString() : null;

  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-14">
      <Link href="/account" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-gold-300">
        <ArrowLeft size={15} /> Account history
      </Link>
      <div className="glass rounded-3xl p-7 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant={inv.status === "paid" ? "green" : "gold"}>{inv.status}</Badge>
          {deadline && inv.status !== "paid" && (
            <span className="inline-flex items-center gap-2 text-sm text-slate-400">
              <Hourglass size={15} className="text-gold-300" /> <Countdown deadlineISO={deadline} />
            </span>
          )}
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold text-white sm:text-3xl">Complete your payment</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">Invoice {params.hash}</p>

        {p.address ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-white/[0.03] p-5 text-center ring-1 ring-white/10">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Send exactly</p>
              <p className="font-display mt-1 text-3xl font-bold text-gold-300">{p.amount}</p>
              <p className="mt-4 break-all rounded-xl bg-ink-950 p-4 font-mono text-sm text-slate-200 ring-1 ring-white/10">
                {p.address}
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <CopyButton text={p.address} label="Copy address" />
                {p.amount && <CopyButton text={p.amount} label="Copy amount" />}
              </div>
            </div>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
              Your miner activates automatically once CoinPayments confirms the transaction.
              Send the exact amount — underpayments cannot be matched.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-white/[0.03] p-5 text-sm text-slate-300 ring-1 ring-white/10">
            <p className="flex items-center gap-2">
              <QrCode size={16} className="text-gold-300" />
              Amount due: <b className="text-white">{inv.amount}</b>
            </p>
            <p className="mt-2 text-slate-400">Follow the CoinPayments gateway to finish this invoice.</p>
          </div>
        )}
      </div>
    </div>
  );
}
