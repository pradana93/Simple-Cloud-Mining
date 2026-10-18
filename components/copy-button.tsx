"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { push } = useToast();
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      push("Copied to clipboard", "success");
      setTimeout(() => setDone(false), 2000);
    } catch {
      push("Clipboard unavailable", "error");
    }
  }

  return (
    <button
      onClick={copy}
      className="tap panel inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-gold-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
    >
      {done ? (
        <Check size={14} className={cn("text-emerald-400", "animate-scale-in")} />
      ) : (
        <Copy size={14} />
      )}
      {done ? "Copied" : label}
    </button>
  );
}
