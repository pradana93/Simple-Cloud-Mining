import { createAdminSupabase } from "./supabase/admin";
import type { ChatMessage, ChatSender, ChatThread } from "./types";

// Server-side chat queries for the admin console. Uses the service-role client
// because thread grouping and unread counts span every member's rows, which RLS
// (correctly) hides from a normal session.

type Row = {
  id: number;
  user_id: string;
  sender: ChatSender;
  body: string;
  created_at: string;
  read_by_admin: boolean;
};

export async function listChatThreads(): Promise<ChatThread[]> {
  try {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("chat_messages")
      .select("id,user_id,sender,body,created_at,read_by_admin")
      .order("created_at", { ascending: false })
      .limit(1000);
    const rows = (data ?? []) as Row[];

    const order: string[] = [];
    const threads = new Map<string, ChatThread>();
    for (const r of rows) {
      const existing = threads.get(r.user_id);
      if (!existing) {
        order.push(r.user_id);
        threads.set(r.user_id, {
          userId: r.user_id,
          username: "",
          lastBody: r.body,
          lastSender: r.sender,
          lastAt: r.created_at,
          unread: r.sender === "user" && !r.read_by_admin ? 1 : 0,
        });
      } else if (r.sender === "user" && !r.read_by_admin) {
        existing.unread += 1;
      }
    }
    if (order.length === 0) return [];

    const { data: profs } = await admin.from("profiles").select("id,username").in("id", order);
    const names = new Map<string, string>(
      ((profs ?? []) as Array<{ id: string; username: string }>).map((p) => [p.id, p.username])
    );
    return order.map((id) => ({ ...(threads.get(id) as ChatThread), username: names.get(id) ?? "Unknown member" }));
  } catch {
    return [];
  }
}

export async function getChatMessages(userId: string, opts: { markRead?: boolean } = {}): Promise<ChatMessage[]> {
  try {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("chat_messages")
      .select("id,sender,body,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (opts.markRead) {
      await admin
        .from("chat_messages")
        .update({ read_by_admin: true })
        .eq("user_id", userId)
        .eq("sender", "user")
        .eq("read_by_admin", false);
    }
    return (data ?? []) as ChatMessage[];
  } catch {
    return [];
  }
}

export async function countUnreadChat(): Promise<number> {
  try {
    const { count } = await createAdminSupabase()
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender", "user")
      .eq("read_by_admin", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}
