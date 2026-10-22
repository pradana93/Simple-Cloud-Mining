import { createServerSupabase } from "./supabase/server";
import { createAdminSupabase } from "./supabase/admin";
import type { SiteSettings } from "./types";

// Columns safe for public/anon reads. The SMTP credentials are excluded and the
// matching column grants on `settings` are withheld from anon/authenticated.
export const PUBLIC_SETTINGS_COLUMNS =
  "id,sitename,siteslogan,keywords,description,pagination,max_pending_transactions,min_withdraw,max_withdraw,aff_comission,currency_name,currency_symbol,currency_code,currency_decimals,fiat_enabled,fiat_currency,price_currency,coin_cur1,coin_cur2,cryptapi_btc_address,cryptapi_ltc_address,cryptapi_doge_address,cryptapi_eth_address,cryptapi_trx_address,cryptapi_usdt_trc20_address,facebook,telegram,twitter,vk,wallet_min,wallet_max,blockchain,theme,start_date,show_start_date,start_date_increment,header_codes,footer_codes,announce_enabled,announce_text,announce_link,checkin_enabled,checkin_amount,pay_coins,default_theme,games_enabled,games_min_bet,games_max_bet,games_disabled";

export const FALLBACK: SiteSettings = {
  id: 1,
  sitename: "Simple Cloud Mining",
  siteslogan: "A simple console for daily rewards",
  keywords: "cloud,mining,crypto",
  description: "Simple Cloud Mining",
  pagination: 10,
  max_pending_transactions: 3,
  min_withdraw: 0,
  max_withdraw: 100,
  aff_comission: 2,
  currency_name: "Dogecoin",
  currency_symbol: "Ã",
  currency_code: "DOGE",
  currency_decimals: 8,
  fiat_enabled: false,
  fiat_currency: "USD",
  price_currency: "USD",
  coin_cur1: "DOGE",
  coin_cur2: "DOGE",
  cryptapi_btc_address: null,
  cryptapi_ltc_address: null,
  cryptapi_doge_address: null,
  cryptapi_eth_address: null,
  cryptapi_trx_address: null,
  cryptapi_usdt_trc20_address: null,
  smtp_host: null,
  smtp_user: null,
  smtp_pass: null,
  smtp_port: null,
  smtp_secure: "null",
  smtp_sender: null,
  facebook: null,
  telegram: null,
  twitter: null,
  vk: null,
  wallet_min: 20,
  wallet_max: 50,
  blockchain: 1,
  theme: "dogeminer",
  start_date: null,
  show_start_date: "no",
  start_date_increment: 0,
  header_codes: null,
  footer_codes: null,
  announce_enabled: false,
  announce_text: null,
  announce_link: null,
  checkin_enabled: false,
  checkin_amount: 0,
  pay_coins: "BTC,DOGE,LTC,ETH,USDT,TRX",
  default_theme: "dark",
  games_enabled: false,
  games_min_bet: 0,
  games_max_bet: 0,
  games_edge_boost: 0,
  games_max_win: 0,
  games_disabled: "",
  games_config: {},
  games_tiers: [],
  games_schedule: { enabled: false, startHour: 0, endHour: 0, edgeDelta: 0 },
};

export async function getSettings(): Promise<SiteSettings> {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("settings")
      .select(PUBLIC_SETTINGS_COLUMNS)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data) return FALLBACK;
    return { ...FALLBACK, ...(data as Partial<SiteSettings>) };
  } catch {
    return FALLBACK;
  }
}

// Admin-only: full row including SMTP fields (service role bypasses the column grants).
export async function getAdminSettings(): Promise<SiteSettings> {
  try {
    const { data } = await createAdminSupabase()
      .from("settings")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data) return FALLBACK;
    return { ...FALLBACK, ...(data as Partial<SiteSettings>) };
  } catch {
    return FALLBACK;
  }
}

