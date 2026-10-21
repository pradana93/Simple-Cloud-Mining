import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { createPayment, convertToCoin, paymentAddress } from "@/lib/cryptapi";
import { cryptoTicker, isPayableCoin } from "@/lib/checkout";
import { getFxTable } from "@/lib/fx";
import { requestIdempotencyKey } from "@/lib/ledger";
import { sendAlert } from "@/lib/alerts";

type StoredInvoice = {
  hash: string;
  status?: string | null;
  params?: { payCoin?: string } | null;
};

function invoiceResponse(row: StoredInvoice) {
  return NextResponse.json({
    ok: true,
    hash: row.hash,
    status: row.status ?? "pending",
    duplicate: true,
  });
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = (await req.json()) as { planId: number; coin?: string; idempotencyKey?: string };
  const { planId, coin } = body;
  const key = requestIdempotencyKey(req, user.id, "purchase", body.idempotencyKey);
  const admin = createAdminSupabase();

  const { data: existing } = await admin
    .from("transactions_history")
    .select("hash,status,params")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (existing) return invoiceResponse(existing as StoredInvoice);

  const settings = await getSettings();

  if (!isPayableCoin(coin, settings.pay_coins)) {
    return NextResponse.json({ ok: false, error: "Choose a coin to pay with." }, { status: 400 });
  }
  const payCoin = (coin as string).trim().toUpperCase();
  const ticker = cryptoTicker(payCoin);
  if (!ticker || !paymentAddress(payCoin)) {
    return NextResponse.json({ ok: false, error: `${payCoin} checkout is not configured.` }, { status: 503 });
  }

  const { data: plan } = await admin.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 });
  if (!(Number((plan as { price: number }).price) > 0)) {
    return NextResponse.json({ ok: false, error: "This plan cannot be purchased" }, { status: 400 });
  }

  const { count } = await admin
    .from("transactions_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("plan_id", planId)
    .eq("status", "pending");
  if ((count ?? 0) >= settings.max_pending_transactions) {
    return NextResponse.json({ ok: false, error: "Transaction limit reached. Wait for pending invoices to expire." }, { status: 400 });
  }

  const hash = crypto.randomBytes(16).toString("hex");
  const baseUrl = new URL(req.url).origin;

  // The plan is priced in the site price currency. The ledger stays in the
  // site currency, while the invoice shows an exact amount in the buyer's coin.
  const price = Number((plan as { price: number }).price);
  const priceCurrency = settings.price_currency.toUpperCase();
  let siteAmount = price;
  if (priceCurrency !== settings.currency_code.toUpperCase()) {
    const table = await getFxTable(settings.currency_code);
    const perCoin = table?.rates[priceCurrency] ?? 0;
    if (!(perCoin > 0)) {
      return NextResponse.json({ ok: false, error: "Live rates are unavailable right now. Try again in a minute." }, { status: 503 });
    }
    siteAmount = price / perCoin;
  }

  let payAmount: number;
  let payment: Awaited<ReturnType<typeof createPayment>>;
  try {
    payAmount = payCoin === settings.currency_code.toUpperCase()
      ? siteAmount
      : await convertToCoin(ticker, price, priceCurrency);
    payment = await createPayment({
      coin: payCoin,
      callbackUrl: `${baseUrl}/api/webhooks/cryptapi?invoice=${hash}`,
      confirmations: Number(settings.blockchain) || 1,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "CryptAPI checkout failed.";
    await sendAlert({
      title: "CryptAPI invoice could not be created",
      message,
      tags: { flow: "purchase", provider: "cryptapi" },
      extra: { userId: user.id, planId, coin: payCoin },
    });
    return NextResponse.json({ ok: false, error: "Checkout is temporarily unavailable. Try again in a minute." }, { status: 503 });
  }

  if (payment.minimum > payAmount) {
    return NextResponse.json({
      ok: false,
      error: `${payCoin} has a minimum payment of ${payment.minimum}. Choose another coin.`,
    }, { status: 400 });
  }

  const { error: insertError } = await admin.from("transactions_history").insert({
    user_id: user.id,
    plan_id: planId,
    amount: siteAmount,
    price_amount: price,
    price_currency: settings.price_currency,
    hash,
    idempotency_key: key,
    params: {
      provider: "cryptapi",
      address: payment.addressIn,
      amount: String(payAmount),
      timeout: 20 * 60,
      payCoin,
      ticker,
    },
  });
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await admin
        .from("transactions_history")
        .select("hash,status,params")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (raced) return invoiceResponse(raced as StoredInvoice);
    }
    await sendAlert({
      title: "Purchase invoice was not recorded",
      message: insertError.message,
      tags: { flow: "purchase", provider: "cryptapi" },
      extra: { userId: user.id, planId, hash },
    });
    return NextResponse.json({ ok: false, error: "Invoice created but could not be recorded. Contact support." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, hash });
}
