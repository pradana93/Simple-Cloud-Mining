"use client";
import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(formData: FormData) {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name")),
          email: String(formData.get("email")),
          subject: String(formData.get("subject")),
          message: String(formData.get("message")),
          company: String(formData.get("company") ?? ""),
        }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setMsg(
        j.ok
          ? { ok: true, text: j.message ?? "Message received. We reply within 24 hours." }
          : { ok: false, text: j.error ?? "Send failed" }
      );
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Send failed" });
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto max-w-xl py-10 sm:py-14">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
          <Mail size={24} />
        </span>
        <h1 className="font-display mt-4 text-3xl font-bold text-white sm:text-4xl">Talk to a human</h1>
        <p className="mt-2 text-slate-400">Support, sales and partnership inquiries.</p>
      </div>
      <div className="panel mt-8 rounded-3xl p-7">
        <form action={submit} className="space-y-4">
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="name">Name</Label><Input id="name" name="name" placeholder="Satoshi" required /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="you@wallet.com" required /></div>
          </div>
          <div><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" minLength={5} placeholder="Withdrawal question" required /></div>
          <div>
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message" name="message" minLength={10} required rows={5} placeholder="How can we help?"
              className="w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : <><Send size={15} /> Send message</>}
          </Button>
        </form>
        {msg && (
          <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}


