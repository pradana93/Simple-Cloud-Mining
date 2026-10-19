"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/admin/modal";
import { CopyButton } from "@/components/copy-button";
import { useToast } from "@/components/ui/toast";
import type { AllowlistEntry } from "@/lib/allowlist";
import { MAX_ALLOWLIST, shortAddress } from "@/lib/allowlist";

export function AllowlistManager({
  entries,
  code,
}: {
  entries: AllowlistEntry[];
  code: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<AllowlistEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const full = entries.length >= MAX_ALLOWLIST;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, address: address.trim() }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (j.ok) {
        push("Address saved to your allowlist", "success");
        setLabel("");
        setAddress("");
        router.refresh();
      } else {
        push(j.error ?? "Could not save the address", "error");
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      const res = await fetch("/api/allowlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: removing.id }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (j.ok) {
        push("Address removed", "success");
        setRemoving(null);
        router.refresh();
      } else {
        push(j.error ?? "Could not remove the address", "error");
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const locked = entries.length > 0;

  return (
    <section id="payout-addresses" className="panel scroll-mt-24 rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
          <ShieldCheck size={20} />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-white">Saved payout addresses</h2>
          <p className="text-xs text-slate-400">
            {locked
              ? `Payouts only go to the ${entries.length} address${entries.length === 1 ? "" : "es"} below.`
              : "Add an address to lock payouts to it. Until then, any address is accepted."}
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
          No saved addresses yet.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">
                  {e.label || "Untitled address"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-300">{shortAddress(e.address)}</span>
                  <CopyButton text={e.address} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRemoving(e)}
                aria-label={`Remove ${e.label || e.address}`}
                className="tap ml-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-300"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <form className="mt-5 space-y-4 border-t border-white/5 pt-5" onSubmit={add}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="allow-label">Name</Label>
              <Input
                id="allow-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Cold wallet"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="allow-address">{code} address</Label>
              <Input
                id="allow-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={`Your ${code} wallet address`}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>
          <Button type="submit" variant="secondary" disabled={saving || address.trim().length < 8}>
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving
              </>
            ) : (
              <>
                <Plus size={15} /> Save address
              </>
            )}
          </Button>
        </form>
      )}

      <Modal
        open={!!removing}
        onClose={() => (busy ? undefined : setRemoving(null))}
        title="Remove saved address?"
        description="Withdrawals to this address will be refused until you add it again."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)} disabled={busy}>
              Keep it
            </Button>
            <Button onClick={remove} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Removing
                </>
              ) : (
                "Remove address"
              )}
            </Button>
          </>
        }
      >
        {removing && (
          <p className="break-all font-mono text-sm text-slate-200">{removing.address}</p>
        )}
      </Modal>
    </section>
  );
}
