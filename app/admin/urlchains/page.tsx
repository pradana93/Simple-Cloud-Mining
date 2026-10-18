import { createAdminSupabase } from "@/lib/supabase/admin";
import { UrlchainsManager, type AdminChain } from "@/components/admin/urlchains-manager";

export const dynamic = "force-dynamic";

export default async function AdminUrlchains() {
  let rows: AdminChain[] = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("urlchains").select("id,name,url").order("id");
    rows = (data ?? []) as AdminChain[];
  } catch {
    rows = [];
  }
  return <UrlchainsManager rows={rows} />;
}
