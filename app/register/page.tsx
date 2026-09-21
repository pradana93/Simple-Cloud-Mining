"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function getRefCookie(): string | null {
  const m = document.cookie.match(/(?:^|; )ref=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function submit(fd: FormData) {
    setErr(null);
    const supabase = createClient();
    const username = String(fd.get("username"));
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      setErr(error?.message ?? "Signup failed");
      return;
    }
    // Create profile (username + referral + free plan handled server-side ideally;
    // here we create the profile row directly for the MVP migration)
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
  }
  return (
    <div className="mx-auto max-w-md py-10">
      <Card><CardHeader><CardTitle>Create account</CardTitle></CardHeader><CardContent>
        <form action={submit} className="space-y-3">
          <div><Label>Username (wallet label)</Label><Input name="username" minLength={3} required /></div>
          <div><Label>Email</Label><Input name="email" type="email" required /></div>
          <div><Label>Password</Label><Input name="password" type="password" minLength={4} required /></div>
          <Button type="submit" className="w-full">Sign up & claim free plan</Button>
        </form>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </CardContent></Card>
    </div>
  );
}
