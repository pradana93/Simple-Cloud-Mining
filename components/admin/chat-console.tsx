"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatSender, ChatThread } from "@/lib/types";

type Incoming = { id: number; user_id: string; sender: ChatSender; body: string; created_at: string; read_by_admin: boolean };

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Admin side of the support chat: a thread list on the left, the open
// conversation on the right. New member messages arrive over Realtime and bump
// the unread count on the matching thread.
export function ChatConsole({ initialThreads }: { initialThreads: ChatThread[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [threads, setThreads] = useState<ChatThread[]>(initialThreads);
  const [active, setActive] = useState<string | null>(initialThreads[0]?.userId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(initialThreads[0]));
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const activeRef = useRef(active);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  async function refreshThreads() {
    try {
      const r = await fetch("/api/admin/chat");
      const j = (await r.json()) as { ok?: boolean; threads?: ChatThread[] };
      if (j.ok && j.threads) setThreads(j.threads);
    } catch {
      // keep the current list on a transient failure
    }
  }

  async function openThread(userId: string) {
    setActive(userId);
    setLoading(true);
    setError(null);
    setThreads((prev) => prev.map((t) => (t.userId === userId ? { ...t, unread: 0 } : t)));
    try {
      const r = await fetch(`/api/admin/chat?userId=${encodeURIComponent(userId)}`);
      const j = (await r.json()) as { ok?: boolean; messages?: ChatMessage[]; error?: string };
      if (j.ok && j.messages) setMessages(j.messages);
      else setError(j.error ?? "Couldn't load this thread.");
    } catch {
      setError("Couldn't load this thread.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (active && messages.length === 0) void openThread(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, active]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as Incoming;
        if (m.user_id === activeRef.current) {
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender === "user") {
            void fetch("/api/admin/chat", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: m.user_id }),
            });
          }
        } else {
          setThreads((prev) => {
            if (!prev.some((t) => t.userId === m.user_id)) {
              void refreshThreads();
              return prev;
            }
            return prev
              .map((t) =>
                t.userId === m.user_id
                  ? { ...t, lastBody: m.body, lastSender: m.sender, lastAt: m.created_at, unread: m.sender === "user" ? t.unread + 1 : t.unread }
                  : t
              )
              .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
          });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: active, body: text }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; message?: ChatMessage };
      if (j.ok && j.message) {
        setDraft("");
        setMessages((prev) => (prev.some((x) => x.id === (j.message as ChatMessage).id) ? prev : [...prev, j.message as ChatMessage]));
        setThreads((prev) =>
          prev.map((t) => (t.userId === active ? { ...t, lastBody: text, lastSender: "admin", lastAt: (j.message as ChatMessage).created_at } : t))
        );
      } else {
        setError(j.error ?? "Reply didn't send.");
      }
    } catch {
      setError("Reply didn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  const activeThread = threads.find((t) => t.userId === active) ?? null;
  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Live chat</h1>
          <p className="text-xs text-slate-400">
            {threads.length} conversation{threads.length === 1 ? "" : "s"} · {totalUnread} unread
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <aside className={cn("panel overflow-hidden rounded-3xl", active && "hidden lg:block")}>
          {threads.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No conversations yet. Messages members send from the site land here.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {threads.map((t) => (
                <li key={t.userId}>
                  <button
                    onClick={() => openThread(t.userId)}
                    aria-current={t.userId === active}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      t.userId === active ? "bg-white/5" : "hover:bg-white/5"
                    )}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500/15 font-display text-sm font-bold text-gold-300">
                      {t.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-white">{t.username}</span>
                        <span className="shrink-0 text-[11px] text-slate-500">{when(t.lastAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="line-clamp-1 flex-1 text-xs text-slate-400">
                          {t.lastSender === "admin" ? "You: " : ""}
                          {t.lastBody}
                        </span>
                        {t.unread > 0 && (
                          <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-ink-950">
                            {t.unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={cn("panel flex h-[32rem] flex-col overflow-hidden rounded-3xl", !active && "hidden lg:flex")}>
          {!active ? (
            <div className="grid flex-1 place-items-center px-6 text-center text-sm text-slate-400">
              Pick a conversation to read and reply.
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <button
                  onClick={() => setActive(null)}
                  aria-label="Back to conversations"
                  className="tap grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:bg-white/5 lg:hidden"
                >
                  <ArrowLeft size={17} />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-display font-bold text-white">{activeThread?.username ?? "Member"}</p>
                  <p className="text-xs text-slate-400">Live support thread</p>
                </div>
              </header>

              <div ref={scrollRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {loading ? (
                  <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                    <Loader2 size={15} className="animate-spin" /> Loading thread
                  </p>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No messages in this thread yet.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                          m.sender === "admin" ? "bg-gold-500 text-ink-950" : "border border-white/10 bg-ink-800 text-slate-100"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={cn("mt-1 text-[10px]", m.sender === "admin" ? "text-ink-950/70" : "text-slate-400")}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {error && <p className="px-4 pb-1 text-xs text-red-300">{error}</p>}

              <form onSubmit={send} className="flex items-center gap-2 border-t border-white/10 p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                  placeholder="Reply to this member"
                  aria-label="Reply"
                  className="h-11 flex-1 rounded-xl border border-slate-700 bg-ink-900 px-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  aria-label="Send reply"
                  className="tap grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-500 text-ink-950 transition-colors hover:bg-gold-400 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
