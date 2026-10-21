"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) setErr(error.message);
      else setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg py-12 sm:py-16">
      <Card className="p-2">
        <CardContent className="pt-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
            <Mail size={22} />
          </span>
          <h1 className="font-display mt-4 text-2xl font-bold text-white">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter the email on your account. If it exists, we will send a one-time reset link.
          </p>
          {sent ? (
            <p className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Check your inbox for the reset link. It expires shortly.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Sending
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          )}
          {err && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p>}
          <p className="mt-6 text-center text-sm text-slate-400">
            <Link href="/login" className="font-semibold text-gold-300 hover:text-gold-400">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
