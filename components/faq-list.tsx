"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FaqList({ faqs }: { faqs: Array<{ id: number; question: string; answer: string }> }) {
  const [open, setOpen] = useState<number | null>(0);
  if (faqs.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-slate-500">
        Answers are syncing — check back in a minute.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.id} className={cn("glass overflow-hidden rounded-2xl transition-colors", isOpen && "border-gold-500/40")}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="font-display text-[15px] font-bold text-white">{f.question}</span>
              <ChevronDown size={18} className={cn("shrink-0 text-gold-300 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="prose-dark border-t border-white/10 px-6 py-5 text-sm" dangerouslySetInnerHTML={{ __html: f.answer }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
