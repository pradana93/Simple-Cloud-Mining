"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function submit(fd: FormData) {
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    if (error) setErr(error.message);
    else router.push("/dashboard");
  }
  return (
    <div className="mx-auto max-w-md py-10">
      <Card><CardHeader><CardTitle>Login</CardTitle></CardHeader><CardContent>
        <form action={submit} className="space-y-3">
          <div><Label>Email</Label><Input name="email" type="email" required /></div>
          <div><Label>Password</Label><Input name="password" type="password" required /></div>
          <Button type="submit" className="w-full">Login</Button>
        </form>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </CardContent></Card>
    </div>
  );
}
