import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types";

/** Service-role client — server only. Never expose to browser. */
export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}
