import { createAdminSupabase } from "@/lib/supabase/admin";
import { ContactManager, type AdminMessage } from "@/components/admin/contact-manager";

export const dynamic = "force-dynamic";

export default async function AdminContact() {
  let rows: AdminMessage[] = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("contact")
      .select("id,name,email,subject,message,reference,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    rows = (data ?? []) as AdminMessage[];
  } catch {
    rows = [];
  }
  return <ContactManager rows={rows} />;
}
