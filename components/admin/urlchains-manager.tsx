"use client";
import { useState } from "react";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Modal } from "@/components/admin/modal";
import { useAdminAction } from "@/components/admin/use-admin-action";

export type AdminChain = { id: number; name: string; url: string };

export function UrlchainsManager({ rows }: { rows: AdminChain[] }) {
  const { run, busy } = useAdminAction();
  const [editing, setEditing] = useState<AdminChain | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<AdminChain | null>(null);
  const open = editing !== undefined;

  function startCreate() {
    setName("");
    setUrl("https://");
    setErrors({});
    setEditing(null);
  }
  function startEdit(c: AdminChain) {
    setName(c.name);
    setUrl(c.url);
    setErrors({});
    setEditing(c);
  }
  function close() {
    setEditing(undefined);
    setErrors({});
  }

  async function save() {
    const body = { name, url };
    const res = editing
      ? await run("/api/admin/urlchains", { id: editing.id, ...body }, { method: "PATCH", success: "Explorer updated" })
      : await run("/api/admin/urlchains", body, { success: "Explorer added" });
    if (res.ok) close();
    else if (res.errors) setErrors(res.errors as Record<string, string>);
  }
  async function remove() {
    if (!confirming) return;
    const res = await run("/api/admin/urlchains", { id: confirming.id }, { method: "DELETE", success: "Explorer removed" });
    if (res.ok) setConfirming(null);
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <AdminPageHeader title="Blockchain explorers" description={<>{rows.length} chains · back the transaction links shown to members</>} />
        <Button onClick={startCreate}>
          <Plus size={15} /> New explorer
        </Button>
      </div>

      <div className="panel overflow-hidden rounded-3xl">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No explorers configured yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-white">
                    <Link2 size={15} className="shrink-0 text-gold-400" />
                    {c.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{c.url}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(c)} aria-label={`Edit ${c.name}`}>
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirming(c)}
                    aria-label={`Remove ${c.name}`}
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
        title={editing ? "Edit explorer" : "New explorer"}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {editing ? "Save explorer" : "Add explorer"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="c-name">Chain name</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={errors.name ? "border-red-500/60 focus:border-red-500/70 focus:ring-red-500/25" : ""}
              placeholder="Dogecoin"
            />
            {errors.name && <p className="mt-1.5 text-xs text-red-300">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="c-url">Explorer URL</Label>
            <Input
              id="c-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={errors.url ? "border-red-500/60 focus:border-red-500/70 focus:ring-red-500/25" : ""}
              placeholder="https://dogechain.info/tx/"
            />
            {errors.url && <p className="mt-1.5 text-xs text-red-300">{errors.url}</p>}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Remove explorer"
        description={confirming ? confirming.name : undefined}
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
        <p className="text-sm text-slate-300">Transaction links for this chain will no longer resolve.</p>
      </Modal>
    </div>
  );
}
