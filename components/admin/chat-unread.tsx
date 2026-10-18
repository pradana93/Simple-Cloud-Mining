"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Unread count for the admin nav. Refreshes over Realtime so a new member
// message shows up as a badge without a page reload.
export function ChatUnread() {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/admin/chat?unread=1");
        const j = (await r.json()) as { ok?: boolean; unread?: number };
        if (alive && j.ok && typeof j.unread === "number") setCount(j.unread);
      } catch {
        // ignore; the badge simply stays as-is
      }
    };
    void load();
    const channel = supabase
      .channel("admin-chat-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => void load())
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (count === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-ink-950">
      {count > 99 ? "99+" : count}
    </span>
  );
}
