import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeCheck, Hourglass, QrCode, ShieldCheck } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { CopyButton } from "@/components/copy-button";
import { Countdown } from "@/components/countdown";
import { InvoiceWatch } from "@/components/invoice-watch";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Invoice = {
  amount: number;
  status: string;
  plan_id: number;
  params: {
    address?: string;
    amount?: string;
    timeout?: number;
    txn_id?: string;
    payCoin?: string;
    ticker?: string;
    pending_amount?: number;
    pending_coin?: string;
    received_amount?: number;
    received_coin?: string;
  } | null;
  date: string;
};

const NETWORK: Record<string, string> = {
  BTC: "Bitcoin network",
  LTC: "Litecoin network",
  DOGE: "Dogecoin network",
  ETH: "Ethereum network",
  TRX: "TRON network",
  USDT: "TRON TRC20 network",
};

function statusView(status: string): { label: string; variant: "green" | "gold" | "red" | "slate" } {
  const value = status.toLowerCase();
  if (value === "paid") return { label: "Payment confirmed", variant: "green" };
  if (value === "waiting") return { label: "Payment detected, confirming", variant: "gold" };
  if (value === "canceled") return { label: "Invoice canceled", variant: "red" };
  return { label: "Waiting for payment", variant: "gold" };
}

export default async function InvoicePage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  let inv: Invoice | null = null;
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("transactions_history").select("*").eq("hash", hash).maybeSingle();
    inv = data as Invoice | null;
  } catch {
    inv = null;
  }
  if (!inv) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center sm:py-16">
        <h1 className="font-display text-2xl font-bold text-white">Invoice not found</h1>
        <p className="mt-2 text-sm text-slate-400">
          Check the link, or open your account history to find the invoice again.
        </p>
        <Link href="/account" className="mt-5 inline-block text-sm font-semibold text-gold-300">
          Open account history
        </Link>
      </div>
    );
  }

  const p = inv.params ?? {};
  const deadline = p.timeout ? new Date(new Date(inv.date).getTime() + p.timeout * 1000).toISOString() : null;
  const expired = Boolean(deadline && new Date(deadline).getTime() < Date.now());
  const settled = inv.status === "paid" || inv.status === "canceled";
  const view = statusView(inv.status);
  const coin = p.payCoin ?? "crypto";
  const network = NETWORK[coin] ?? "the selected network";
  const shownAmount =
    inv.status === "paid"
      ? p.received_amount ?? p.amount
      : inv.status === "waiting"
        ? p.pending_amount ?? p.amount
        : p.amount;
  const shownCoin = inv.status === "paid" ? p.received_coin ?? coin : inv.status === "waiting" ? p.pending_coin ?? coin : coin;

  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-14">
      <InvoiceWatch active={!settled} />
      <Link
        href="/account"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-gold-300"
      >
        <ArrowLeft size={15} /> Account history
      </Link>

      <div className="panel rounded-3xl p-7 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant={view.variant}>{view.label}</Badge>
          {deadline && !settled && (
            <span className="inline-flex items-center gap-2 text-sm text-slate-400">
              <Hourglass size={15} className="text-gold-300" /> <Countdown deadlineISO={deadline} />
            </span>
          )}
        </div>

        <h1 className="font-display mt-4 text-2xl font-bold text-white sm:text-3xl">
          {inv.status === "paid"
            ? "Payment received"
            : inv.status === "canceled"
              ? "This invoice is canceled"
              : "Complete your payment"}
        </h1>
        <p className="mt-1 break-all font-mono text-xs text-slate-400">Invoice {hash}</p>

        {inv.status === "canceled" ? (
          <div className="mt-6 space-y-4">
            <p className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm leading-relaxed text-red-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Do not send to this invoice. It was canceled. Create a new invoice from the plan page.
            </p>
            <Link
              href={`/purchase/${inv.plan_id}`}
              className="tap inline-flex h-11 items-center justify-center rounded-xl bg-gold-500 px-5 font-display text-sm font-bold text-ink-950 hover:bg-gold-400"
            >
              Create a new invoice
            </Link>
          </div>
        ) : p.address ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-white/[0.03] p-5 text-center ring-1 ring-white/10">
              <p className="text-xs font-medium text-slate-400">
                {inv.status === "paid" ? "Amount received" : inv.status === "waiting" ? "Amount detected" : "Send exactly"}
              </p>
              <p className="font-display mt-1 text-3xl font-bold text-gold-300">
                {shownAmount} {shownCoin}
              </p>
              <p className="mt-1 text-xs text-slate-400">{network}</p>
              <p className="mt-4 break-all rounded-xl bg-ink-950 p-4 font-mono text-sm text-slate-200 ring-1 ring-white/10">
                {p.address}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <CopyButton text={p.address} label="Copy address" />
                {p.amount && <CopyButton text={p.amount} label="Copy amount" />}
              </div>
            </div>

            {expired && inv.status === "pending" && (
              <p className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-100">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
                The 20-minute window has elapsed. If you already sent the payment, we still credit it
                after confirmation. Otherwise create a new invoice before sending.
              </p>
            )}

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-100">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-amber-300" />
                {inv.status === "paid"
                  ? "Payment confirmed. No further action is needed. We never ask for your wallet private key."
                  : inv.status === "waiting"
                    ? "Payment detected. Waiting for network confirmations. Do not send again unless support asks you to."
                    : `Send only ${coin} on ${network}. Do not send from an exchange that deducts a fee. Underpayments are not credited. Overpayments are not automatically refunded or credited; contact support with the transaction id if you send too much. We never ask for your wallet private key.`}
              </p>
            </div>

            {inv.status === "paid" ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <h2 className="font-display text-base font-bold text-white">Your plan is active</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  The payment is confirmed and the credit is in your balance. Open the console to
                  watch it accrue.
                </p>
                <Link
                  href="/dashboard"
                  className="tap mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-gold-500 px-5 font-display text-sm font-bold text-ink-950 hover:bg-gold-400"
                >
                  <BadgeCheck size={15} /> Open your console
                </Link>
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
                  <h2 className="font-display text-base font-bold text-white">What happens next</h2>
                  <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
                    {inv.status === "waiting" ? (
                      <>
                        <li>1. The payment was detected on the network.</li>
                        <li>2. The network is confirming the transaction.</li>
                        <li>3. The plan activates automatically and the credit lands in your balance.</li>
                      </>
                    ) : (
                      <>
                        <li>1. Send the exact amount to the address above.</li>
                        <li>2. The network confirms the transaction.</li>
                        <li>3. The plan activates automatically and the credit lands in your balance.</li>
                      </>
                    )}
                  </ol>
                  <p className="mt-3 text-xs text-slate-400">
                    This page checks for payment automatically. You can leave it open or come back
                    later from Account history.
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Need help?{" "}
                  <Link href="/contact" className="font-semibold text-gold-300">
                    Contact support
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-white/[0.03] p-5 text-sm text-slate-300 ring-1 ring-white/10">
            <p className="flex items-center gap-2">
              <QrCode size={16} className="text-gold-300" />
              Amount due: <b className="text-white">{inv.amount}</b>
            </p>
            <p className="mt-2 text-slate-400">
              This invoice has no deposit address. Contact support before sending anything.
            </p>
            <Link href="/contact" className="mt-3 inline-block font-semibold text-gold-300">
              Contact support
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

