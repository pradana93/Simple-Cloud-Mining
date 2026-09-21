"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, WalletMinimal } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function WithdrawalPage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(fd: FormData) {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(fd.get("amount")) }),
      });
      const j = await res.json();
      setMsg(j.ok ? { ok: true, text: "Withdraw requested — track it in Account history." } : { ok: false, text: `Error: ${j.error}` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto max-w-md py-10 sm:py-14">
      <Link href="/dashboard" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-gold-300">
        <ArrowLeft size={15} /> Back to console
      </Link>
      <Card className="p-2">
        <CardContent className="pt-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
            <WalletMinimal size={22} />
          </span>
          <h1 className="font-display mt-4 text-2xl font-bold text-white">Withdraw earnings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Funds leave your mining balance immediately and enter manual review.
          </p>
          <form action={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.00000001" min="0" placeholder="0.00000000" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Broadcasting…" : "Confirm withdrawal"}
            </Button>
          </form>
          {msg && (
            <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
              {msg.text}
            </p>
          )}
          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
            Withdrawals respect the min/max limits configured by the operator. Make sure your
            payout wallet is set before requesting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
