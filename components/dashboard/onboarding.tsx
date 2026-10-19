"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Rocket, ShieldCheck, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "scm_onboarding_done";

export type OnboardingStep = {
  id: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
};

export function Onboarding({ steps }: { steps: OnboardingStep[] }) {
  const [dismissed, setDismissed] = useState(true);
  const remaining = steps.filter((s) => !s.done).length;

  useEffect(() => {
    let done = null;
    try {
      done = localStorage.getItem(KEY);
    } catch {
      done = null;
    }
    setDismissed(done === "1");
  }, []);

  if (dismissed || remaining === 0) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  const pct = Math.round(((steps.length - remaining) / steps.length) * 100);

  return (
    <section className="panel rounded-3xl border-t-2 border-t-gold-500/60 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
            <Rocket size={20} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Get the most out of your console</h2>
            <p className="text-xs text-slate-400">
              {remaining} step{remaining === 1 ? "" : "s"} left. {pct}% complete.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss checklist"
          className="tap grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X size={17} />
        </button>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.id}>
            {step.done ? (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <Check size={12} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{step.label}</p>
                  <p className="text-xs text-slate-400">{step.hint}</p>
                </div>
              </div>
            ) : (
              <Link
                href={step.href}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 transition-colors hover:border-gold-500/40"
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300">
                  <ArrowRight size={12} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{step.label}</p>
                  <p className="text-xs text-slate-400">{step.hint}</p>
                </div>
              </Link>
            )}
          </li>
        ))}
      </ul>

      <p className={cn("mt-4 flex items-center gap-2 text-xs text-slate-400")}>
        <ShieldCheck size={13} className="text-gold-400" />
        <span className="inline-flex items-center gap-1.5">
          <Wallet size={13} /> Tip: add a payout address before you withdraw.
        </span>
      </p>
    </section>
  );
}
