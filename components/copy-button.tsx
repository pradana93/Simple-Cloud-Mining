"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <button
      onClick={copy}
      className="glass inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-gold-500/50 hover:text-white"
    >
      {done ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      {done ? "Copied" : label}
    </button>
  );
}
