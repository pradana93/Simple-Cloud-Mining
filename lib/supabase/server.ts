import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../types";

export function createServerSupabase() {
  const cookieStore = cookies();
  // Never throw on missing env (e.g. a host without vars configured);
  // use placeholders so construction succeeds, and let queries fail
  // gracefully so pages fall back to safe defaults.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
  return createServerClient<Database>(url, anon, {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll();
        },
        async setAll(cookiesToSet) {
          try {
            const store = await cookieStore;
            cookiesToSet.forEach(({ name, value, options }) =>
              store.set(name, value, options)
            );
          } catch {
            // Server Component; ignored
          }
        },
      },
    }
  );
}
