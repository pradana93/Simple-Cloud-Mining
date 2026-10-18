import { createServerSupabase } from "./supabase/server";
import type { SiteSettings } from "./types";

export const FALLBACK: SiteSettings = {
  id: 1,
  sitename: "Simple Cloud Mining",
  siteslogan: "Invest like rich",
  keywords: "cloud,mining,crypto",
  description: "Simple Cloud Mining",
  pagination: 10,
  max_pending_transactions: 3,
  min_withdraw: 0,
  max_withdraw: 100,
  aff_comission: 2,
  currency_name: "Dogecoin",
  currency_symbol: "Ð",
  currency_code: "DOGE",
  currency_decimals: 8,
  coin_cur1: "DOGE",
  coin_cur2: "DOGE",
  coin_mode: "gateway",
  coin_email: "user",
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
};

export async function getSettings(): Promise<SiteSettings> {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
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
