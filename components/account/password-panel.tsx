"use client";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const MIN_PASSWORD = 10;

export function PasswordPanel() {
  const { push } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      push("New passwords do not match", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) {
        push(j.error ?? "Could not update the password", "error");
        return;
      }
      push("Password updated", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      push(err instanceof Error ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
          <KeyRound size={20} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-white">Password</h2>
          <p className="text-xs text-slate-400">Change the password used to sign in.</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={busy || newPassword.length < MIN_PASSWORD || newPassword !== confirm}>
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </section>
  );
}
