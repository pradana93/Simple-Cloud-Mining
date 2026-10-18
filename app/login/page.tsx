"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(fd: FormData) {
    setErr(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      });
      if (error) setErr(error.message);
      else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
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
          <h1 className="font-display hidden text-2xl font-bold text-white lg:block">Sign in</h1>
          <p className="mt-1 text-sm text-slate-400">Access your mining console.</p>
          <form action={submit} className="mt-6 space-y-4">
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="you@wallet.com" required /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" placeholder="••••••••" required /></div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Unlocking rigs…" : "Enter console"}
            </Button>
          </form>
          {err && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p>}
          <p className="mt-6 text-center text-sm text-slate-400">
            No account?{" "}
            <Link href="/register" className="font-semibold text-gold-300 hover:text-gold-400">
              Claim free hashrate
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
