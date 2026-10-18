"use client";
import { useState } from "react";
import { HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Modal } from "@/components/admin/modal";
import { useAdminAction } from "@/components/admin/use-admin-action";

export type AdminFaq = { id: number; question: string; answer: string };

const areaClass =
  "w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25";

export function FaqsManager({ rows }: { rows: AdminFaq[] }) {
  const { run, busy } = useAdminAction();
  const [editing, setEditing] = useState<AdminFaq | null | undefined>(undefined);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<AdminFaq | null>(null);
  const open = editing !== undefined;

  function startCreate() {
    setQuestion("");
    setAnswer("");
    setErrors({});
    setEditing(null);
  }
  function startEdit(f: AdminFaq) {
    setQuestion(f.question);
    setAnswer(f.answer);
    setErrors({});
    setEditing(f);
  }
  function close() {
    setEditing(undefined);
    setErrors({});
  }

  async function save() {
    const body = { question, answer };
    const res = editing
      ? await run("/api/admin/faqs", { id: editing.id, ...body }, { method: "PATCH", success: "FAQ updated" })
      : await run("/api/admin/faqs", body, { success: "FAQ added" });
    if (res.ok) close();
    else if (res.errors) setErrors(res.errors as Record<string, string>);
  }
  async function remove() {
    if (!confirming) return;
    const res = await run("/api/admin/faqs", { id: confirming.id }, { method: "DELETE", success: "FAQ removed" });
    if (res.ok) setConfirming(null);
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <AdminPageHeader title="FAQs" description={<>{rows.length} answers published on the FAQ page</>} />
        <Button onClick={startCreate}>
          <Plus size={15} /> New FAQ
        </Button>
      </div>

      <div className="panel overflow-hidden rounded-3xl">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No FAQs yet. Add the first question to help newcomers.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((f) => (
              <div key={f.id} className="flex items-start justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-white">
                    <HelpCircle size={15} className="shrink-0 text-gold-400" />
                    {f.question}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{f.answer}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(f)} aria-label={`Edit FAQ ${f.id}`}>
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirming(f)}
                    aria-label={`Remove FAQ ${f.id}`}
                    className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={close}
        title={editing ? "Edit FAQ" : "New FAQ"}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {editing ? "Save FAQ" : "Add FAQ"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="f-q">Question</Label>
            <Input
              id="f-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={errors.question ? "border-red-500/60 focus:border-red-500/70 focus:ring-red-500/25" : ""}
              placeholder="How fast are payouts?"
            />
            {errors.question && <p className="mt-1.5 text-xs text-red-300">{errors.question}</p>}
          </div>
          <div>
            <Label htmlFor="f-a">Answer</Label>
            <textarea
              id="f-a"
              rows={5}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className={`${areaClass} ${errors.answer ? "border-red-500/60" : ""}`}
              placeholder="Payouts are processed manually within 24 hours."
            />
            {errors.answer && <p className="mt-1.5 text-xs text-red-300">{errors.answer}</p>}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Remove FAQ"
        description={confirming ? confirming.question : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              <Trash2 size={15} /> Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">It will disappear from the public FAQ page immediately.</p>
      </Modal>
    </div>
  );
}
