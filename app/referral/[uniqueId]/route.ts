import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";

/** Legacy: /referral/:unique_id sets a cookie then redirects home. */
export async function GET(
  _req: Request,
  { params }: { params: { uniqueId: string } }
) {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("unique_id", Number(params.uniqueId))
    .maybeSingle();
  if (data) {
    cookies().set("ref", params.uniqueId, { maxAge: 86400, path: "/" });
  }
  redirect("/");
}
