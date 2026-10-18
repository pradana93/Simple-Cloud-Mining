"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(fd: FormData) {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const username = String(fd.get("username"));
      const email = String(fd.get("email"));
      const password = String(fd.get("password"));
      // Username travels as auth metadata; the DB trigger creates the profile
      // and free miner server-side, so no RLS insert can fail.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) {
        setErr(error.message);
        return;
      }
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setMsg("Account created. Confirm your email, then sign in. Your free miner activates on first login.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto grid max-w-4xl gap-6 py-10 sm:py-14 lg:grid-cols-2">
      <div className="panel relative hidden rounded-3xl border-gold-500/20 p-10 lg:block">
        <h2 className="font-display text-3xl font-bold leading-tight text-white">
          Free hashrate in <span className="gold-text">30 seconds.</span>
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Create your account and a free mining contract starts hashing instantly. Upgrade later
          for a higher daily yield.
        </p>
        <ol className="mt-8 space-y-4 text-sm">
          {[
            ["01", "Create account", "Username and password. Sign in with your username."],
            ["02", "Free miner activates", "It starts earning on the spot."],
            ["03", "Upgrade anytime", "Deploy paid rigs via CoinPayments."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-4">
              <span className="font-display text-lg font-bold text-gold-400">{n}</span>
              <span>
                <span className="block font-semibold text-white">{t}</span>
                <span className="block text-slate-400">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <Card className="p-2">
        <CardContent className="pt-6">
          <h1 className="font-display text-2xl font-bold text-white">Create account</h1>
          <p className="mt-1 text-sm text-slate-400">Free miner activates on signup.</p>
          <form action={submit} className="mt-6 space-y-4">
            <div><Label htmlFor="username">Username</Label><Input id="username" name="username" minLength={3} placeholder="satoshi_01" required /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="you@wallet.com" required /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" minLength={4} placeholder="Min. 4 characters" required /></div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Spinning up miner…" : "Claim free miner"}
            </Button>
          </form>
          {err && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p>}
          {msg && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{msg}</p>}
          <p className="mt-6 text-center text-sm text-slate-400">
            Have an account?{" "}
            <Link href="/login" className="font-semibold text-gold-300 hover:text-gold-400">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
