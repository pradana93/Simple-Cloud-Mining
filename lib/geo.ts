// Best-effort local currency for a visitor, used as the default fiat display.
// Country comes from the edge header (Vercel sets x-vercel-ip-country); a
// language header is the fallback. Everything resolves to a fiat we can price.

const EU = new Set([
  "AT", "BE", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PT", "SK", "SI", "ES", "HR",
]);

const COUNTRY: Record<string, string> = {
  US: "USD", GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK",
  AU: "AUD", CA: "CAD", NZ: "NZD",
  BR: "BRL", MX: "MXN", AR: "ARS",
  IN: "INR", ID: "IDR", MY: "MYR", SG: "SGD", PH: "PHP", TH: "THB", VN: "VND",
  JP: "JPY", KR: "KRW", CN: "CNY", HK: "HKD", TW: "TWD",
  AE: "AED", SA: "SAR", TR: "TRY", IL: "ILS",
  NG: "NGN", ZA: "ZAR", KE: "KES", EG: "EGP",
};

// Language subtag -> country, for the Accept-Language fallback.
const LANG: Record<string, string> = {
  en: "US", de: "DE", fr: "FR", es: "ES", it: "IT", pt: "BR", nl: "NL",
  sv: "SE", no: "NO", da: "DK", pl: "PL", cs: "CZ", tr: "TR", ru: "US",
  id: "ID", ms: "MY", th: "TH", vi: "VN", ja: "JP", ko: "KR", zh: "CN",
  hi: "IN", ar: "AE", he: "IL", hi_IN: "IN",
};

export function currencyForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const cc = country.toUpperCase();
  if (EU.has(cc)) return "EUR";
  return COUNTRY[cc] ?? null;
}

export function currencyForLocale(acceptLanguage: string | null | undefined): string | null {
  if (!acceptLanguage) return null;
  const first = acceptLanguage.split(",")[0]?.trim() ?? "";
  const parts = first.split("-");
  const region = parts[1]?.toUpperCase();
  if (region) {
    const byRegion = currencyForCountry(region);
    if (byRegion) return byRegion;
  }
  const lang = parts[0]?.toLowerCase();
  if (lang && LANG[lang]) return currencyForCountry(LANG[lang]);
  return null;
}

export function detectCurrency(
  country: string | null | undefined,
  acceptLanguage: string | null | undefined
): string | null {
  return currencyForCountry(country) ?? currencyForLocale(acceptLanguage);
}
