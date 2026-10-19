"use client";
import { useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function submit(fd: FormData) {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(fd.get("username")),
          password: String(fd.get("password")),
        }),
      });
      const j = await res.json();
      if (j.totpRequired) {
        setTicket(j.ticket ?? "");
        setCode("");
        return;
      }
      if (!j.ok) {
        setErr(j.error ?? "Login failed");
        return;
      }
      window.location.href = j.isAdmin ? "/admin" : "/dashboard";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function verify(fd: FormData) {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, code: String(fd.get("code")) }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "That code is not valid");
        if (j.expired) setTicket(null);
        return;
      }
      window.location.href = j.isAdmin ? "/admin" : "/dashboard";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 py-10 sm:py-14 lg:grid-cols-2">
      <div className="panel relative hidden rounded-3xl p-10 lg:block">
        <h2 className="font-display text-3xl font-bold leading-tight text-white">
          Welcome back to the <span className="gold-text">mine.</span>
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Your rigs keep hashing while you are away. Sign in to watch earnings land, manage miners,
          and withdraw to your wallet.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-slate-300">
          {["Per-minute accrual, credited on every visit", "Withdrawals within your configured limits", "Public payout ledger"].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> {t}
            </li>
          ))}
        </ul>
      </div>
      <Card className="p-2">
        <CardContent className="pt-6">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <Logo className="h-9 w-9" />
            <span className="font-display text-lg font-bold text-white">Sign in</span>
          </div>
          {ticket === null ? (
            <>
              <h1 className="font-display hidden text-2xl font-bold text-white lg:block">Sign in</h1>
              <p className="mt-1 text-sm text-slate-400">Username and password. No email needed.</p>
              <form action={submit} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" name="username" autoComplete="username" placeholder="satoshi_01" required />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Unlocking rigs
                    </>
                  ) : (
                    "Enter console"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
                <ShieldCheck size={22} />
              </span>
              <h1 className="font-display mt-4 text-2xl font-bold text-white">Enter your code</h1>
              <p className="mt-1 text-sm text-slate-400">
                Open your authenticator app and type the current 6-digit code.
              </p>
              <form action={verify} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="code">Authenticator code</Label>
                  <Input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="font-mono tracking-[0.4em]"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Checking
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} /> Verify and continue
                    </>
                  )}
                </Button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setTicket(null);
                  setErr(null);
                }}
                className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-gold-300"
              >
                <KeyRound size={14} /> Use a different account
              </button>
            </>
          )}
          {err && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p>}
          {ticket === null && (
            <p className="mt-6 text-center text-sm text-slate-400">
              No account?{" "}
              <Link href="/register" className="font-semibold text-gold-300 hover:text-gold-400">
                Claim free hashrate
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
