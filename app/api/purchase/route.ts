import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { buildGatewayUrl, createApiTransaction } from "@/lib/coinpayments";
import { getFxTable } from "@/lib/fx";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { planId } = (await req.json()) as { planId: number };
  const settings = await getSettings();
  const admin = createAdminSupabase();

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

  const hash = crypto.createHash("md5").update(`${process.env.COINPAYMENTS_IPN_SECRET ?? "hash"}${Date.now()}`).digest("hex");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // The plan is priced in the site price currency and billed that way so the
  // buyer can settle in any coin CoinPayments accepts. The ledger stays in the
  // site crypto, so convert the price once here and store both amounts.
  const price = Number((plan as { price: number }).price);
  const priceCurrency = settings.price_currency.toUpperCase();
  let cryptoAmount = price;
  if (priceCurrency !== settings.currency_code.toUpperCase()) {
    const table = await getFxTable(settings.currency_code);
    const perCoin = table?.rates[priceCurrency] ?? 0;
    if (!(perCoin > 0)) {
      return NextResponse.json({ ok: false, error: "Live rates are unavailable right now. Try again in a minute." }, { status: 503 });
    }
    cryptoAmount = price / perCoin;
  }

  if (settings.coin_mode === "gateway") {
    const url = buildGatewayUrl({
      merchantId: process.env.COINPAYMENTS_MERCHANT_ID ?? "",
      planId: (plan as { id: number }).id,
      planName: (plan as { version: string }).version ?? String((plan as { id: number }).id),
      siteName: settings.sitename,
      amount: price,
      currency: settings.price_currency,
      invoice: hash,
      baseUrl,
    });
    await admin.from("transactions_history").insert({
      user_id: user.id,
      plan_id: planId,
      amount: cryptoAmount,
      price_amount: price,
      price_currency: settings.price_currency,
      hash,
      params: { gateway_url: url },
    });
    return NextResponse.json({ ok: true, redirectUrl: url, hash });
  }

  // API mode
  const { data: profile } = await admin.from("profiles").select("email").eq("id", user.id).maybeSingle();
  const buyerEmail = settings.coin_email === "user"
    ? ((profile as { email: string } | null)?.email ?? "")
    : (process.env.SMTP_SENDER ?? "");
  if (!buyerEmail) return NextResponse.json({ ok: false, error: "Update your contact email before purchasing." }, { status: 400 });

  const result = await createApiTransaction({
    privateKey: process.env.COINPAYMENTS_PRIVATE_KEY ?? "",
    publicKey: process.env.COINPAYMENTS_PUBLIC_KEY ?? "",
    amount: price,
    currency1: settings.price_currency,
    currency2: settings.coin_cur2,
    buyerEmail,
    itemName: `Purchase of Mining Plan ${(plan as { version: string }).version} on ${settings.sitename}`,
    itemNumber: (plan as { id: number }).id,
    invoice: hash,
    ipnUrl: `${baseUrl}/api/ipn/coinpayments`,
  });
  if ((result as { error?: string }).error !== "ok") {
    return NextResponse.json({ ok: false, error: "CoinPayments error. Contact admin." }, { status: 502 });
  }
  await admin.from("transactions_history").insert({
    user_id: user.id,
    plan_id: planId,
    amount: cryptoAmount,
    price_amount: price,
    price_currency: settings.price_currency,
    hash,
    params: result.result as never,
  });
  return NextResponse.json({ ok: true, hash });
}
