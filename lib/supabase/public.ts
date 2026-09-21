import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types";

let memo: ReturnType<typeof createClient<Database>> | null = null;

/** Key-less public client (no cookies) — safe for cached/static rendering. */
export function getPublicSupabase() {
  if (!memo) {
    memo = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
    );
  }
  return memo;
}
