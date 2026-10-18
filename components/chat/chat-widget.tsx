"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

// Member side of the support thread. Messages land over Realtime (see
// supabase/003_chat.sql), so a reply from the team appears without a refresh.
// Only mounted for signed-in members; ChatDock gates that.
export default function ChatWidget() {
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const openRef = useRef(open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setUid(data.session?.user.id ?? null);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/chat?peek=1");
        const j = (await res.json()) as { ok?: boolean; messages?: ChatMessage[] };
        if (!alive) return;
        if (j.ok && j.messages) {
          setMessages(j.messages);
          setUnread(j.messages.filter((m) => m.sender === "admin" && !m.read_by_user).length);
        } else {
          setError("Couldn't load the conversation.");
        }
      } catch {
        if (alive) setError("Couldn't load the conversation.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`chat-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `user_id=eq.${uid}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender === "admin" && !openRef.current) setUnread((u) => u + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, uid]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  function toggle() {
    setOpen((v) => !v);
    setUnread(0);
    if (!open) {
      setError(null);
      fetch("/api/chat")
        .then((r) => r.json())
        .then((j: { ok?: boolean; messages?: ChatMessage[] }) => {
          if (j.ok && j.messages) {
            setMessages(j.messages);
            setLoading(false);
          }
        })
        .catch(() => setError("Couldn't refresh the conversation."));
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; message?: ChatMessage };
      if (j.ok && j.message) {
        setDraft("");
        setMessages((prev) => (prev.some((x) => x.id === (j.message as ChatMessage).id) ? prev : [...prev, j.message as ChatMessage]));
      } else {
        setError(j.error ?? "Message didn't send.");
      }
    } catch {
      setError("Message didn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (!uid) return null;

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Support chat"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="panel fixed bottom-24 right-4 z-50 flex h-[min(70vh,30rem)] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-2xl"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="font-display text-sm font-bold text-white">Support</p>
              <p className="text-xs text-slate-400">Replies from the mining team</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="tap grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <X size={17} />
            </button>
          </header>

          <div ref={scrollRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                <Loader2 size={15} className="animate-spin" /> Loading conversation
              </p>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                {error ?? "No messages yet. Send us a line and we'll reply here."}
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                      m.sender === "user"
                        ? "bg-gold-500 text-ink-950"
                        : "border border-white/10 bg-ink-800 text-slate-100"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={cn("mt-1 text-[10px]", m.sender === "user" ? "text-ink-950/70" : "text-slate-400")}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {error && messages.length > 0 && (
            <p className="px-4 pb-1 text-xs text-red-300">{error}</p>
          )}

          <form onSubmit={send} className="flex items-center gap-2 border-t border-white/10 p-3">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              placeholder="Type a message"
              aria-label="Message"
              className="h-11 flex-1 rounded-xl border border-slate-700 bg-ink-900 px-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send message"
              className="tap grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-500 text-ink-950 transition-colors hover:bg-gold-400 disabled:opacity-50"
            >
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </form>
        </section>
      )}

      <button
        onClick={toggle}
        aria-label={open ? "Close support chat" : "Open support chat"}
        aria-expanded={open}
        className="tap fixed bottom-6 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-gold-500 text-ink-950 shadow-lg transition-colors hover:bg-gold-400"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-ink-950">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </>
  );
}
