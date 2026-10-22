"use client";

import { useState } from "react";
import { CHECKOUT_TERMS, TERMS_VERSION } from "@/lib/terms";

export function CheckoutTerms({ onChange }: { onChange: (accepted: boolean) => void }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="font-display text-base font-bold text-white">Before you pay</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-400">
        {CHECKOUT_TERMS.map((term) => (
          <li key={term}>{term}</li>
        ))}
      </ul>
      <label className="mt-4 flex items-start gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => {
            setAccepted(e.target.checked);
            onChange(e.target.checked);
          }}
          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-ink-900 accent-gold-500"
        />
        <span>
          I have read and accept these terms.
          <span className="block text-[11px] text-slate-500">Terms version {TERMS_VERSION}</span>
        </span>
      </label>
    </div>
  );
}
