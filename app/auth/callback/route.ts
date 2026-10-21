import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") ?? "/reset-password";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/reset-password";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=reset", url.origin));
  }

  try {
    const { error } = await createServerSupabase().auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=reset", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=reset", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
