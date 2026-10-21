"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const MIN_PASSWORD = 10;

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        setHasSession(Boolean(data.session));
        setReady(true);
      })
      .catch(() => {
        setHasSession(false);
        setReady(true);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < MIN_PASSWORD) {
      setErr(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErr(error.message);
        return;
      }
      await supabase.auth.signOut();
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg py-12 sm:py-16">
      <Card className="p-2">
        <CardContent className="pt-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
            <ShieldCheck size={22} />
          </span>
          <h1 className="font-display mt-4 text-2xl font-bold text-white">Choose a new password</h1>
          {!ready ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={15} className="animate-spin" /> Checking your link
            </p>
          ) : done ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Password updated. Sign in with your new password.
              </p>
              <Link href="/login" className="font-semibold text-gold-300 hover:text-gold-400">
                Go to sign in
              </Link>
            </div>
          ) : !hasSession ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                This reset link is invalid or has expired. Request a new one.
              </p>
              <Link href="/forgot-password" className="font-semibold text-gold-300 hover:text-gold-400">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || password.length < MIN_PASSWORD || password !== confirm}>
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          )}
          {err && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
