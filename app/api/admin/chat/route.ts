import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";
import { countUnreadChat, getChatMessages, listChatThreads } from "@/lib/chat";
import type { ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_LEN = 2000;

// Admin inbox: GET lists threads, GET ?userId= opens one (and clears its unread
// flag), GET ?unread=1 is the nav badge. POST sends a reply as the admin.
export async function GET(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  if (url.searchParams.get("unread") === "1") {
    return NextResponse.json({ ok: true, unread: await countUnreadChat() });
  }
  const userId = url.searchParams.get("userId");
  if (userId) {
    return NextResponse.json({ ok: true, messages: await getChatMessages(userId, { markRead: true }) });
  }
  return NextResponse.json({ ok: true, threads: await listChatThreads() });
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let body: { userId?: unknown; body?: unknown };
  try {
    body = (await req.json()) as { userId?: unknown; body?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const userId = String(body.userId ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!userId) return NextResponse.json({ ok: false, error: "A thread is required" }, { status: 422 });
  if (!text) return NextResponse.json({ ok: false, error: "Message is empty" }, { status: 422 });
  if (text.length > MAX_LEN) return NextResponse.json({ ok: false, error: `Keep it under ${MAX_LEN} characters` }, { status: 422 });

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("chat_messages")
    .insert({ user_id: userId, sender: "admin", body: text })
    .select("id,sender,body,created_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  await admin
    .from("chat_messages")
    .update({ read_by_admin: true })
    .eq("user_id", userId)
    .eq("sender", "user")
    .eq("read_by_admin", false);

  return NextResponse.json({ ok: true, message: data as ChatMessage });
}

// Clear the unread flag for one thread without reloading its history.
export async function PATCH(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let body: { userId?: unknown };
  try {
    body = (await req.json()) as { userId?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const userId = String(body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ ok: false, error: "A thread is required" }, { status: 422 });

  await createAdminSupabase()
    .from("chat_messages")
    .update({ read_by_admin: true })
    .eq("user_id", userId)
    .eq("sender", "user")
    .eq("read_by_admin", false);

  return NextResponse.json({ ok: true });
}
