import { unstable_cache } from "next/cache";
import { getPublicSupabase } from "./supabase/public";
import { FALLBACK } from "./settings";
import type { Plan, SiteSettings } from "./types";

/**
 * Cached public catalog — the performance fix.
 * Public pages (home, payouts, faq, affiliate) read through here instead of
 * hitting Supabase on every request. ISR-style revalidation keeps TTFB fast.
 */

export const getCachedSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    try {
      const { data } = await getPublicSupabase()
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
  },
  ["site-settings"],
  { revalidate: 300 }
);

export const getCachedPlans = unstable_cache(
  async (): Promise<Plan[]> => {
    try {
      const { data } = await getPublicSupabase()
        .from("plans")
        .select("*")
        .order("price", { ascending: true });
      return (data ?? []) as Plan[];
    } catch {
      return [];
    }
  },
  ["plans"],
  { revalidate: 60 }
);

export const getCachedFaqs = unstable_cache(
  async (): Promise<Array<{ id: number; question: string; answer: string }>> => {
    try {
      const { data } = await getPublicSupabase().from("faqs").select("*").order("id");
      return (data ?? []) as Array<{ id: number; question: string; answer: string }>;
    } catch {
      return [];
    }
  },
  ["faqs"],
  { revalidate: 300 }
);

export const getCachedContents = unstable_cache(
  async (): Promise<{ affiliate: string | null; payouts: string | null; contact: string | null }> => {
    try {
      const { data } = await getPublicSupabase()
        .from("contents")
        .select("*")
        .order("id")
        .limit(1)
        .maybeSingle();
      const row = (data ?? {}) as { affiliate?: string; payouts?: string; contact?: string };
      return { affiliate: row.affiliate ?? null, payouts: row.payouts ?? null, contact: row.contact ?? null };
    } catch {
      return { affiliate: null, payouts: null, contact: null };
    }
  },
  ["contents"],
  { revalidate: 300 }
);

export type PayoutEntry = {
  amount: number;
  tx: string | null;
  created_at: string;
  status?: string;
};

export const getCachedPayouts = unstable_cache(
  async (): Promise<{ deposits: PayoutEntry[]; withdrawals: PayoutEntry[] }> => {
    try {
      const supabase = getPublicSupabase();
      const [d, w] = await Promise.all([
        supabase.from("user_deposits").select("amount,tx,created_at").order("created_at", { ascending: false }).limit(12),
        supabase.from("user_withdrawal").select("amount,tx,created_at,status").order("created_at", { ascending: false }).limit(12),
      ]);
      return {
        deposits: (((d as { data: unknown }).data ?? []) as PayoutEntry[]),
        withdrawals: (((w as { data: unknown }).data ?? []) as PayoutEntry[]),
      };
    } catch {
      return { deposits: [], withdrawals: [] };
    }
  },
  ["payouts"],
  { revalidate: 30 }
);

export const getCachedStats = unstable_cache(
  async (): Promise<{ miners: number; totalDeposits: number; totalPaid: number }> => {
    try {
      const supabase = getPublicSupabase();
      const [u, d, w] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_deposits").select("amount").limit(5000),
        supabase.from("user_withdrawal").select("amount").limit(5000),
      ]);
      const sum = (rows: unknown) =>
        ((rows ?? []) as Array<{ amount: number }>).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      return {
        miners: (u as { count: number | null }).count ?? 0,
        totalDeposits: sum((d as { data: unknown }).data),
        totalPaid: sum((w as { data: unknown }).data),
      };
    } catch {
      return { miners: 0, totalDeposits: 0, totalPaid: 0 };
    }
  },
  ["site-stats"],
  { revalidate: 60 }
);
