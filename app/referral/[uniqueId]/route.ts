import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// /referral/:unique_id records the referrer in a cookie, then sends the visitor
// to signup where the attribution is applied on the first console load. The
// lookup runs with the service role because profiles RLS only exposes a
// caller's own row, so an anonymous read would never find the referrer.
export async function GET(req: NextRequest, { params }: { params: Promise<{ uniqueId: string }> }) {
  const { uniqueId } = await params;
  const id = (uniqueId ?? "").trim();
  const dest = req.nextUrl.clone();
  dest.pathname = "/register";
  dest.search = "";

  const res = NextResponse.redirect(dest);
  if (/^\d+$/.test(id)) {
    try {
      const admin = createAdminSupabase();
      const { data } = await admin.from("profiles").select("id").eq("unique_id", Number(id)).maybeSingle();
      if (data) {
        res.cookies.set("ref", id, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
      }
    } catch {
      // DB unreachable; send them to signup without attribution.
    }
  }
  return res;
}
