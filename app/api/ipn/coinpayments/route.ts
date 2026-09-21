import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { verifyIpnHmac } from "@/lib/coinpayments";
import { affiliateCommission, expirationForPlan } from "@/lib/mining";

/**
 * POST /api/ipn/coinpayments — port of GatewayIpn::coinpayments().
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
  const t = tx as { id: number; status: string; amount: number; user_id: string; plan_id: number };
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

  if (currency1 !== settings.coin_cur1) {
    await log("Original currency mismatch!", t.id, null, currency1);
    return new Response("IPN Error: currency", { status: 400 });
  }
  if (!(amount1 >= Number(t.amount))) {
    await log("Amount is less than order total!", t.id, null, String(amount1));
    return new Response("IPN Error: amount", { status: 400 });
  }

  if (status >= 100 || status === 2) {
    await admin.from("transactions_history").update({ status: "paid", paid_amount: amount1, txid: txnId }).eq("id", t.id);
    await admin.from("user_deposits").insert({ user_id: t.user_id, amount: amount1, tx: txnId, status: "SUCCESS", date_paid: new Date().toISOString() });
    const { data: plan } = await admin.from("plans").select("*").eq("id", t.plan_id).maybeSingle();
    if (plan) {
      const exp = expirationForPlan(Number((plan as { duration: number }).duration));
      await admin.from("user_plan_history").insert({
        user_id: t.user_id,
        plan_id: t.plan_id,
        status: "active",
        expire_date: exp.toISOString(),
        last_sum: new Date().toISOString(),
      });
      // Upline affiliate credit
      const { data: buyer } = await admin.from("profiles").select("id,reference_user_id").eq("id", t.user_id).maybeSingle();
      const refId = (buyer as { reference_user_id: string | null } | null)?.reference_user_id;
      if (refId) {
        const commission = affiliateCommission(amount1, settings.aff_comission);
        const { data: upline } = await admin.from("profiles").select("balance,affiliate_earns").eq("id", refId).maybeSingle();
        if (upline) {
          await admin.from("profiles").update({
            balance: Number((upline as { balance: number }).balance) + commission,
            affiliate_earns: Number((upline as { affiliate_earns: number }).affiliate_earns) + commission,
          }).eq("id", refId);
          await admin.from("affiliate_history").insert({ user_id: refId, amount: commission, status: "paid" });
        }
      }
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
