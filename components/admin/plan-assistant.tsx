"use client";
import { useState } from "react";
import { Check, Loader2, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCrypto } from "@/lib/utils";
import { formatFiat } from "@/lib/money";
import type { PlanContext, PlanProposal } from "@/lib/plan-goal";

const EXAMPLES = [
  "500 plan, 90 days, give the member 2x their money back",
  "cheap starter plan, free, 30 days",
  "0.5 plan for 60 days with 40% margin",
];

const SOURCE_LABEL: Record<string, string> = {
  builtin: "Built-in engine",
  openai: "OpenAI",
  anthropic: "Claude",
};

export function PlanAssistant({
  context,
  code,
  decimals,
  priceCurrency,
  onApply,
}: {
  context: PlanContext;
  code: string;
  decimals: number;
  priceCurrency: string;
  onApply: (p: PlanProposal) => void;
}) {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [source, setSource] = useState("");

  async function generate() {
    if (!goal.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, context }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; source?: string; proposal?: PlanProposal };
      if (!j.ok || !j.proposal) {
        setError(j.error ?? "Could not build a plan from that");
        return;
      }
      setProposal(j.proposal);
      setSource(j.source ?? "builtin");
      onApply(j.proposal);
    } catch {
      setError("Could not reach the assistant");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gold-500/25 bg-gold-500/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gold-300">
          <Sparkles size={15} className="text-gold-400" /> Plan assistant
        </div>
        {proposal && <Badge variant="slate">{SOURCE_LABEL[source] ?? source}</Badge>}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Describe the plan in plain words. It fills the fields, and you can still tweak every number below.
      </p>

      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={2}
        placeholder="e.g. 500 plan, 90 days, give the member 2x their money back"
        aria-label="Describe the plan"
        className="mt-3 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setGoal(ex)}
            className="tap inline-flex min-h-[44px] items-center rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:border-gold-500/50 hover:text-white"
          >
            {ex}
          </button>
        ))}
        <Button size="sm" onClick={generate} disabled={busy || !goal.trim()} className="ml-auto">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {busy ? "Building" : "Build plan"}
        </Button>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-300">{error}</p>}

      {proposal && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
            <Check size={13} /> Filled the form below with these numbers.
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Readout label={`Price (${priceCurrency})`} value={formatFiat(proposal.price, priceCurrency)} />
            <Readout label={`Daily (${code})`} value={formatCrypto(proposal.point_per_day, decimals)} />
            <Readout label="Term" value={`${proposal.duration} days`} />
            <Readout
              label="Margin"
              value={proposal.price > 0 ? `${proposal.ownerMarginPct.toFixed(1)}%` : "free"}
              tone={proposal.ownerProfit < 0 ? "bad" : "good"}
            />
          </div>

          <ul className="space-y-1 text-xs text-slate-300">
            {proposal.rationale.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold-400">â€º</span> {r}
              </li>
            ))}
          </ul>

          {proposal.assumptions.length > 0 && (
            <p className="text-[11px] text-slate-400">Assumed: {proposal.assumptions.join(" ")}</p>
          )}

          {proposal.warnings.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
              {proposal.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px] font-medium text-red-200">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Readout({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-950/50 px-2.5 py-1.5">
      <p className="text-[10px] font-medium text-slate-400">{label}</p>
      <p className={cn("font-mono mt-0.5 text-xs tabular-nums", tone === "bad" ? "text-red-300" : tone === "good" ? "text-emerald-300" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

