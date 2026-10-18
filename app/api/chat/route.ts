import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_LEN = 2000;

async function currentUserId(supabase: ReturnType<typeof createServerSupabase>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// The member side of the support thread: read history, send a line. RLS keeps
// every query scoped to the caller, so no explicit user_id filter is trusted.
export async function GET(req: Request) {
  const supabase = createServerSupabase();
  const userId = await currentUserId(supabase);
  if (!userId) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,sender,body,created_at,read_by_user")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  // `peek=1` loads history for the unread badge without clearing it.
  if (new URL(req.url).searchParams.get("peek") !== "1") {
    await supabase
      .from("chat_messages")
      .update({ read_by_user: true })
      .eq("user_id", userId)
      .eq("sender", "admin")
      .eq("read_by_user", false);
  }

  return NextResponse.json({ ok: true, messages: (data ?? []) as ChatMessage[] });
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const userId = await currentUserId(supabase);
  if (!userId) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  let body: { body?: unknown };
  try {
    body = (await req.json()) as { body?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const text = String(body.body ?? "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "Message is empty" }, { status: 422 });
  if (text.length > MAX_LEN) return NextResponse.json({ ok: false, error: `Keep it under ${MAX_LEN} characters` }, { status: 422 });

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ user_id: userId, sender: "user", body: text })
    .select("id,sender,body,created_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, message: data as ChatMessage });
}
