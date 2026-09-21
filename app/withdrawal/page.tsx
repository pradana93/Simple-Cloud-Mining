"use client";
import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WithdrawalPage() {
  const [msg, setMsg] = useState<string | null>(null);
  async function submit(fd: FormData) {
    setMsg(null);
    const res = await fetch("/api/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(fd.get("amount")) }),
    });
    const j = await res.json();
    setMsg(j.ok ? "Withdraw requested successfully!" : `Error: ${j.error}`);
  }
  return (
    <div className="mx-auto max-w-md py-10">
      <Card><CardHeader><CardTitle>Request withdrawal</CardTitle></CardHeader><CardContent>
        <form action={submit} className="space-y-3">
          <div><Label>Amount</Label><Input name="amount" type="number" step="0.00000001" min="0" required /></div>
          <Button type="submit" className="w-full">Confirm withdrawal</Button>
        </form>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </CardContent></Card>
    </div>
  );
}
