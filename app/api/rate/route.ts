import { NextResponse } from "next/server";
import { getCachedSettings } from "@/lib/catalog";
import { getMoneyCfg } from "@/lib/currency";
import { cross, getFxTable, SUPPORTED_FIATS } from "@/lib/fx";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getCachedSettings();
  const table = s.fiat_enabled ? await getFxTable(s.currency_code) : null;
  const cfg = await getMoneyCfg(s, table);
  return NextResponse.json(
    {
      enabled: s.fiat_enabled,
      crypto: s.currency_code,
      display: cfg.fiatCurrency,
      priceCurrency: cfg.priceCurrency,
      rate: table?.rates[cfg.fiatCurrency] ?? null,
      priceToDisplay: table ? cross(table.rates, cfg.priceCurrency, cfg.fiatCurrency) || null : null,
      source: table?.source ?? null,
      fetchedAt: table?.fetchedAt ?? null,
      currencies: SUPPORTED_FIATS,
    },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
  );
}
