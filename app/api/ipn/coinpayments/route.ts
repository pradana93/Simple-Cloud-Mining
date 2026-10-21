import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { verifyIpnHmac } from "@/lib/coinpayments";
import { recordEvent } from "@/lib/risk-telemetry";
import { firstRow } from "@/lib/ledger";

/**
 * POST /api/ipn/coinpayments: port of GatewayIpn::coinpayments().
 * CoinPayments sends application/x-www-form-urlencoded with HMAC header.
 */
export async function POST(req: Request) {
  const admin = createAdminSupabase();
  const settings = await getSettings();
  const raw = await req.text();
  const form = new URLSearchParams(raw);
  const g = (k: string) => form.get(k);

  const invoice = g("invoice");
  const ipnMode = g("ipn_mode");
  const merchant = g("merchant");
  const sentHmac = req.headers.get("hmac") ?? req.headers.get("HMAC");
  const ipnType = g("ipn_type");

  if (ipnType === "withdrawal" && form.get("converted_to")) {
    return new Response("IPN OK");
  }

  const log = async (message: string, transaction_id: number | null, status: string | null, content: string | null) => {
    await admin.from("ipn_errors").insert({ transaction_id, message, status, content });
  };

  const { data: tx } = await admin.from("transactions_history").select("*").eq("hash", invoice ?? "").maybeSingle();
  if (!tx) {
    await log("Transaction not found!", null, null, invoice);
    return new Response("IPN Error: Transaction not found!", { status: 400 });
  }
  const t = tx as {
    id: number;
    status: string;
    amount: number;
    price_amount: number | null;
    price_currency: string | null;
    user_id: string;
    plan_id: number;
  };
  if (t.status === "paid") {
    await log("Transaction already paid!", t.id, null, invoice);
    return new Response("IPN Error: already paid");
  }
  if (!ipnMode || ipnMode !== "hmac") {
    await log("IPN Mode is not HMAC!", t.id, null, ipnMode);
    return new Response("IPN Error: mode", { status: 400 });
  }
  const secret = process.env.COINPAYMENTS_IPN_SECRET ?? "";
  if (!verifyIpnHmac(raw, sentHmac, secret)) {
    await log("HMAC signature does not match", t.id, null, sentHmac);
    return new Response("IPN Error: HMAC", { status: 400 });
  }
  if (!merchant || merchant !== (process.env.COINPAYMENTS_MERCHANT_ID ?? "")) {
    await log("No or incorrect Merchant ID passed", t.id, null, merchant);
    return new Response("IPN Error: merchant", { status: 400 });
  }

  const currency1 = g("currency1");
  const amount1 = Number(g("amount1"));
  const status = Number(g("status"));
  const txnId = g("txn_id");

  // Invoices are billed in the price currency recorded when they were created.
  const invoiceCurrency = t.price_currency ?? settings.price_currency;
  if (currency1 !== invoiceCurrency) {
    await log("Original currency mismatch!", t.id, null, currency1);
    return new Response("IPN Error: currency", { status: 400 });
  }
  const billed = Number(t.price_amount ?? t.amount);
  if (!(amount1 >= billed)) {
    await log("Amount is less than order total!", t.id, null, String(amount1));
    return new Response("IPN Error: amount", { status: 400 });
  }

  if (status >= 100 || status === 2) {
    // Claim the invoice exactly once. The deposit, active rig, and upline
    // commission all commit or roll back together inside the database.
    const paidCrypto = Number(t.amount);
    const { data, error } = await admin.rpc("activate_paid_invoice", {
      p_tx_id: t.id,
      p_txid: txnId,
      p_paid: paidCrypto,
    });
    if (error) return new Response("IPN Error: activation failed", { status: 500 });

    const row = firstRow<{ status?: string; claimed?: unknown; commission?: unknown }>(data);
    if (row?.status !== "paid" && row?.status !== "already_paid") {
      await log("Invoice activation was refused", t.id, row?.status ?? null, invoice);
      return new Response("IPN Error: activation refused", { status: 500 });
    }
    if (row?.status === "paid") {
      await recordEvent({ userId: t.user_id, kind: "deposit", detail: { amount: paidCrypto, txid: txnId, planId: t.plan_id } });
    }
  } else if (status === 1) {
    await admin.from("transactions_history").update({ status: "waiting" }).eq("id", t.id);
  } else if (status < 0) {
    await admin.from("transactions_history").update({ status: "canceled" }).eq("id", t.id);
  }
  return new Response("IPN OK");
}

export async function GET() {
  return NextResponse.json({ ok: true, usage: "POST CoinPayments IPN here" });
}
