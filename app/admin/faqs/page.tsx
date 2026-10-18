import { createAdminSupabase } from "@/lib/supabase/admin";
import { FaqsManager, type AdminFaq } from "@/components/admin/faqs-manager";

export const dynamic = "force-dynamic";

export default async function AdminFaqs() {
  let rows: AdminFaq[] = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.from("faqs").select("id,question,answer").order("id");
    rows = (data ?? []) as AdminFaq[];
  } catch {
    rows = [];
  }
  return <FaqsManager rows={rows} />;
}
