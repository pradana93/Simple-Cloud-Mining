import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import {
  amountCovers,
  isConfirmed,
  parseCryptapiWebhook,
  verifyCryptapiSignature,
} from "@/lib/cryptapi";
import { recordEvent } from "@/lib/risk-telemetry";
import { firstRow } from "@/lib/ledger";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InvoiceParams = {
  provider?: string;
  address?: string;
  amount?: string;
  payCoin?: string;
  ticker?: string;
};

type Invoice = {
  id: number;
  status: string;
  amount: number;
  user_id: string;
  plan_id: number;
  params: (InvoiceParams & Record<string, unknown>) | null;
};

function ok() {
  return new Response("*ok*", { status: 200, headers: { "content-type": "text/plain" } });
}

function normalizeCoin(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/_/g, "/");
}

function coinMatches(webhookCoin: string | null, params: InvoiceParams): boolean {
  const seen = normalizeCoin(webhookCoin);
  return Boolean(seen) && (seen === normalizeCoin(params.ticker) || seen === normalizeCoin(params.payCoin));
}

async function handle(req: Request, body: string | null) {
  const admin = createAdminSupabase();
  const settings = await getSettings();
  const isPost = req.method === "POST";
  const signature = req.headers.get("x-ca-signature");
  const signed = isPost ? body ?? "" : req.url;

  const log = async (message: string, transactionId: number | null, status: string | null, content: string | null) => {
    await admin.from("ipn_errors").insert({
      transaction_id: transactionId,
      message: `cryptapi: ${message}`,
      status,
      content: content?.slice(0, 2000) ?? null,
    });
  };

  if (!verifyCryptapiSignature(signed, signature)) {
    await log("invalid webhook signature", null, null, isPost ? body : req.url);
    return new Response("Invalid signature", { status: 401 });
  }

  const source = isPost ? new URLSearchParams(body ?? "") : new URL(req.url).searchParams;
  const payment = parseCryptapiWebhook(source);

  if (!payment.addressIn) {
    await log("missing address_in", null, null, source.toString());
    return ok();
  }

  const { data: found } = await admin
    .from("transactions_history")
    .select("id,status,amount,user_id,plan_id,params")
    .eq("params->>address", payment.addressIn)
    .maybeSingle();
  const tx = found as Invoice | null;
  if (!tx) {
    await log("invoice not found", null, null, payment.addressIn);
    return ok();
  }
  const params = tx.params ?? {};

  if (tx.status === "paid") return ok();

  if (params.provider !== "cryptapi" || !coinMatches(payment.coin, params)) {
    await log("coin or provider mismatch", tx.id, payment.coin, payment.addressIn);
    return new Response("Payment mismatch", { status: 400 });
  }

  if (payment.pending === 1) {
    if (tx.status === "pending") {
      await admin
        .from("transactions_history")
        .update({
          status: "waiting",
          params: {
            ...(tx.params ?? {}),
            pending_amount: payment.value,
            pending_coin: payment.coin,
            pending_at: new Date().toISOString(),
          },
        })
        .eq("id", tx.id);
    }
    return ok();
  }

  const required = Number(settings.blockchain) || 1;
  if (!isConfirmed(payment, required)) {
    await log("not enough confirmations", tx.id, String(payment.confirmations), payment.addressIn);
    return ok();
  }

  const expected = Number(params.amount);
  if (!amountCovers(payment.value, expected)) {
    await log("amount below invoice", tx.id, String(payment.value), `expected ${expected}`);
    return ok();
  }

  if (!payment.txid) {
    await log("missing txid_in", tx.id, null, payment.addressIn);
    return new Response("Missing transaction id", { status: 400 });
  }

  if (payment.value > expected + 1e-8) {
    await log("overpayment", tx.id, String(payment.value), `expected ${expected}`);
    await sendAlert({
      title: "Crypto overpayment",
      message: `Invoice ${params.address ?? tx.id} received ${payment.value} ${payment.coin ?? ""}, expected ${expected}.`,
      level: "warning",
      tags: { flow: "deposit", provider: "cryptapi" },
      extra: { transactionId: tx.id, userId: tx.user_id, txid: payment.txid },
    });
  }

  await admin
    .from("transactions_history")
    .update({
      params: {
        ...(tx.params ?? {}),
        received_amount: payment.value,
        received_coin: payment.coin,
        received_confirmations: payment.confirmations,
        received_at: new Date().toISOString(),
      },
    })
    .eq("id", tx.id);

  const { data, error } = await admin.rpc("activate_paid_invoice", {
    p_tx_id: tx.id,
    p_txid: payment.txid,
    p_paid: Number(tx.amount),
  });
  if (error) {
    await log("activation failed", tx.id, null, error.message);
    return new Response("Activation failed", { status: 500 });
  }

  const row = firstRow<{ status?: string; claimed?: unknown; commission?: unknown }>(data);
  if (row?.status !== "paid" && row?.status !== "already_paid") {
    await log("activation refused", tx.id, row?.status ?? null, payment.addressIn);
    return new Response("Activation refused", { status: 500 });
  }
  if (row?.status === "paid") {
    try {
      const { data: buyer } = await admin
        .from("profiles")
        .select("reference_user_id")
        .eq("id", tx.user_id)
        .maybeSingle();
      const referrer = (buyer as { reference_user_id: string | null } | null)?.reference_user_id ?? null;
      if (referrer) {
        const { error: bonusError } = await admin.rpc("post_referral_bonus", {
          p_referee: tx.user_id,
          p_referrer: referrer,
          p_paid: Number(tx.amount),
          p_tx_id: tx.id,
        });
        if (bonusError) await log("referral bonus failed", tx.id, null, bonusError.message);
      }
    } catch {
      // Activation already succeeded; a bonus failure must not fail the webhook.
    }
    await recordEvent({
      userId: tx.user_id,
      kind: "deposit",
      detail: { amount: Number(tx.amount), txid: payment.txid, planId: tx.plan_id, coin: payment.coin },
    });
  }
  return ok();
}

export async function POST(req: Request) {
  return handle(req, await req.text());
}

export async function GET(req: Request) {
  return handle(req, null);
}

export async function HEAD() {
  return NextResponse.json({ ok: true, provider: "cryptapi" });
}
