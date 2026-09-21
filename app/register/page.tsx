"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function getRefCookie(): string | null {
  const m = document.cookie.match(/(?:^|; )ref=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(fd: FormData) {
    setErr(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const username = String(fd.get("username"));
      const email = String(fd.get("email"));
      const password = String(fd.get("password"));
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error || !data.user) {
        setErr(error?.message ?? "Signup failed");
        return;
      }
      const ref = getRefCookie();
      let reference_user_id: string | null = null;
      if (ref) {
        const { data: upline } = await supabase.from("profiles").select("id").eq("unique_id", Number(ref)).maybeSingle();
        if (upline) reference_user_id = (upline as { id: string }).id;
      }
      const { error: pErr } = await supabase.from("profiles").insert({
        id: data.user.id,
        username,
        email,
        unique_id: Math.floor(10000 + Math.random() * 89999),
        reference_user_id,
      });
      if (pErr) {
        setErr(pErr.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto grid max-w-4xl gap-6 py-10 sm:py-14 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden rounded-3xl border border-gold-500/25 bg-gradient-to-b from-gold-500/[0.12] to-ink-900 p-10 lg:block">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest text-emerald-300 ring-1 ring-emerald-500/40">
            <Gift size={12} /> Free miner included
          </span>
          <h2 className="font-display mt-5 text-3xl font-bold leading-tight text-white">
            Free hashrate in <span className="gold-text">30 seconds.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Create your account and a free mining contract starts hashing instantly —
            upgrade later for up to 50,000+ coins a day.
          </p>
          <ol className="mt-8 space-y-4 text-sm">
            {[
              ["01", "Create account", "Email + password. No wallet needed yet."],
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
              {loading ? "Spinning up miner…" : <>Claim free miner <ArrowRight size={16} /></>}
            </Button>
          </form>
          {err && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p>}
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
