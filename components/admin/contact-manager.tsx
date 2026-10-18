"use client";
import { useMemo, useState } from "react";
import { Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/admin/modal";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { cn } from "@/lib/utils";

export type AdminMessage = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string | null;
};

const STATUSES = ["unread", "read", "replied"] as const;

function variant(s: string): "gold" | "slate" | "green" {
  if (s === "unread") return "gold";
  if (s === "replied") return "green";
  return "slate";
}

export function ContactManager({ rows }: { rows: AdminMessage[] }) {
  const { run, busy } = useAdminAction();
  const [confirming, setConfirming] = useState<AdminMessage | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const unread = useMemo(() => rows.filter((r) => r.status === "unread").length, [rows]);

  const setStatus = (m: AdminMessage, status: string) =>
    run("/api/admin/contact", { id: m.id, status }, { success: `Marked ${status}` });

  async function remove() {
    if (!confirming) return;
    const res = await run("/api/admin/contact", { id: confirming.id, action: "delete" }, { success: "Message deleted" });
    if (res.ok) setConfirming(null);
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Contact inbox</h1>
          <p className="text-xs text-slate-400">
            {rows.length} messages · {unread} unread
          </p>
        </div>
      </div>

      <div className="panel overflow-hidden rounded-3xl">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No messages. Submissions from the contact form land here.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((m) => (
              <div key={m.id} className="px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    onClick={() => setExpanded((v) => (v === m.id ? null : m.id))}
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={expanded === m.id}
                  >
                    <p className="flex items-center gap-2 font-medium text-white">
                      <Mail size={15} className="shrink-0 text-gold-400" />
                      {m.subject || "(no subject)"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {m.name} · {m.email}
                      {m.created_at ? ` · ${new Date(m.created_at).toLocaleString()}` : ""}
                    </p>
                    <p className={cn("mt-1 text-sm text-slate-300", expanded === m.id ? "" : "line-clamp-1")}>{m.message}</p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={variant(m.status)}>{m.status}</Badge>
                    <div role="radiogroup" aria-label="Message status" className="flex rounded-lg border border-slate-700 p-0.5">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          role="radio"
                          aria-checked={m.status === s}
                          onClick={() => setStatus(m, s)}
                          disabled={busy || m.status === s}
                          className={cn(
                            "tap min-h-[44px] rounded-md px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors disabled:opacity-100",
                            m.status === s ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirming(m)}
                      aria-label={`Delete message ${m.id}`}
                      className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Delete message"
        description={confirming ? `${confirming.name} · ${confirming.email}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              <Trash2 size={15} /> Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">This removes the message from the inbox permanently.</p>
      </Modal>
    </div>
  );
}
