"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/admin/modal";
import { useToast } from "@/components/ui/toast";
import { formatCrypto } from "@/lib/utils";

type Counts = {
  members: number;
  activeRigs: number;
  invoices: number;
  deposits: number;
  withdrawals: number;
  games: number;
  chatMessages: number;
  contactMessages: number;
  balance: number;
};

export function ResetProgress({
  symbol,
  code,
  decimals,
}: {
  symbol: string;
  code: string;
  decimals: number;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [backupReady, setBackupReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review() {
    setOpen(true);
    setConfirm("");
    setBackupReady(false);
    setCounts(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-progress");
      const j = (await res.json()) as { ok?: boolean; counts?: Counts; error?: string };
      if (!j.ok || !j.counts) {
        setError(j.error ?? "Could not load the reset preview.");
        return;
      }
      setCounts(j.counts);
    } catch {
      setError("Could not load the reset preview.");
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    if (confirm.trim() !== "RESET") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!j.ok) {
        setError(j.error ?? "Reset failed.");
        push(j.error ?? "Reset failed.", "error");
        return;
      }
      push(j.message ?? "App progression reset.", "success");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Reset failed.");
      push("Reset failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel rounded-3xl border-red-500/20 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-300">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Reset app progression</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">
              Start the app fresh. This removes members and all activity, but keeps admin accounts,
              settings, plans, FAQs, content, payment addresses, and the audit log.
            </p>
          </div>
        </div>
        <Button variant="destructive" onClick={review}>
          Review reset
        </Button>
      </div>

      <div className="mt-5 grid gap-3 text-xs leading-relaxed text-slate-400 sm:grid-cols-2">
        <p className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-3">
          Removed: non-admin accounts, balances, rigs, invoices, deposits, withdrawals, referrals,
          chat, game history, risk data, login attempts, and payout logs.
        </p>
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          Kept: admin accounts and their two-factor setup, site settings, plans, FAQs, content,
          payment addresses, and the admin audit log.
        </p>
      </div>

      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Reset app progression"
        description="This cannot be undone. Review the counts before you type RESET."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={reset}
              disabled={busy || loading || confirm.trim() !== "RESET" || !backupReady}
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Resetting
                </>
              ) : (
                <>
                  <Trash2 size={15} /> Reset app
                </>
              )}
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin text-gold-300" /> Loading counts...
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
            {error}
          </p>
        ) : counts ? (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Members", counts.members],
                ["Active rigs", counts.activeRigs],
                ["Invoices", counts.invoices],
                ["Deposits", counts.deposits],
                ["Withdrawals", counts.withdrawals],
                ["Game rounds", counts.games],
                ["Chat messages", counts.chatMessages],
                ["Contact messages", counts.contactMessages],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <dt className="text-[11px] text-slate-400">{label}</dt>
                  <dd className="font-mono mt-1 text-lg font-medium tabular-nums text-white">
                    {Number(value).toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-400">
              Member balances held:{" "}
              <span className="font-mono text-slate-200">
                {symbol}
                {formatCrypto(counts.balance, decimals)} {code}
              </span>
            </p>
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4 text-xs leading-relaxed text-red-100">
              Type <span className="font-mono font-bold">RESET</span> to confirm. Your admin account
              and two-factor setup stay intact.
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-300">
              <input
                type="checkbox"
                checked={backupReady}
                onChange={(event) => setBackupReady(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-ink-900 accent-gold-500"
              />
              <span>
                I have a recent backup, or I accept that this reset cannot be undone. Run
                <span className="font-mono text-slate-100"> npm run backup </span>
                before resetting if you need one.
              </span>
            </label>
            <div className="mt-5">
              <Label htmlFor="reset-confirm">Confirmation</Label>
              <Input
                id="reset-confirm"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="RESET"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">No reset preview available.</p>
        )}
      </Modal>
    </section>
  );
}
