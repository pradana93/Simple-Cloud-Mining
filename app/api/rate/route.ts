import { NextResponse } from "next/server";
import { getCachedSettings } from "@/lib/catalog";
import { getFxRate } from "@/lib/fx";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getCachedSettings();
  if (!s.fiat_enabled) return NextResponse.json({ enabled: false });
  const fx = await getFxRate(s.currency_code, s.fiat_currency);
  return NextResponse.json({
    enabled: true,
    crypto: s.currency_code,
    fiat: s.fiat_currency,
    rate: fx?.rate ?? null,
    source: fx?.source ?? null,
    fetchedAt: fx?.fetchedAt ?? null,
  });
}
