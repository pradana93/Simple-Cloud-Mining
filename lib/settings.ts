import { createServerSupabase } from "./supabase/server";
import type { SiteSettings } from "./types";

const FALLBACK: SiteSettings = {
  id: 1,
  sitename: "Simple Cloud Mining",
  siteslogan: "Invest like rich",
  currency_name: "Dogecoin",
  currency_symbol: "Ð",
  currency_code: "DOGE",
  currency_decimals: 8,
  min_withdraw: 0,
  max_withdraw: 100,
  aff_comission: 2,
  max_pending_transactions: 3,
  coin_cur1: "DOGE",
  coin_cur2: "DOGE",
  coin_mode: "gateway",
  coin_email: "user",
  theme: "dogeminer",
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
