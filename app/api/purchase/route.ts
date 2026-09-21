import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { buildGatewayUrl, createApiTransaction } from "@/lib/coinpayments";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { planId } = (await req.json()) as { planId: number };
  const settings = await getSettings();
  const admin = createAdminSupabase();

  const { data: plan } = await admin.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 });

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

  if (settings.coin_mode === "gateway") {
    const url = buildGatewayUrl({
      merchantId: process.env.COINPAYMENTS_MERCHANT_ID ?? "",
      planId: (plan as { id: number }).id,
      planName: (plan as { version: string }).version ?? String((plan as { id: number }).id),
      siteName: settings.sitename,
      amount: Number((plan as { price: number }).price),
      currency: settings.coin_cur1,
      invoice: hash,
      baseUrl,
    });
    await admin.from("transactions_history").insert({
      user_id: user.id,
      plan_id: planId,
      amount: Number((plan as { price: number }).price),
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
    amount: Number((plan as { price: number }).price),
    currency1: settings.coin_cur1,
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
    amount: Number((plan as { price: number }).price),
    hash,
    params: result.result as never,
  });
  return NextResponse.json({ ok: true, hash });
}
