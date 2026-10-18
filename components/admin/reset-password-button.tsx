"use client";
import { useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function ResetPasswordButton({ userId, username }: { userId: string; username: string }) {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [pw, setPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    if (!window.confirm(`Reset the password for ${username}? Their current password stops working immediately.`)) return;
    setLoading(true);
    setPw(null);
    try {
      const r = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const j = await r.json();
      if (!j.ok) {
        push(j.error ?? "Reset failed", "error");
        return;
      }
      setPw(j.password as string);
      push(`New password issued for ${username}`, "success");
    } catch {
      push("Reset failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!pw) return;
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      push("Clipboard unavailable", "error");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="tap inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-gold-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
        Reset password
      </button>
      {pw && (
        <div className="animate-scale-in flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">
          <code className="font-mono text-xs text-emerald-200">{pw}</code>
          <button onClick={copy} aria-label="Copy new password" className="tap grid h-11 w-11 shrink-0 place-items-center rounded-lg text-emerald-300 transition-colors hover:text-white">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}
    </div>
  );
}
