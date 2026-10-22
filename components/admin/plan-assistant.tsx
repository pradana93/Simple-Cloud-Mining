"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCrypto } from "@/lib/utils";
import { formatFiat } from "@/lib/money";
import type { PlanContext, PlanProposal } from "@/lib/plan-goal";
import type { StrategyObjective, StrategyVariant } from "@/lib/plan-studio";

const EXAMPLES = [
  "Balanced plan at $25 for 90 days, members should get 70% back",
  "Premium $100 plan, 180 days, keep at least 25% margin",
  "Cheap starter at $5, 30 days, low risk",
  "Free starter plan for 30 days",
];

const SOURCE_LABEL: Record<string, string> = {
  builtin: "Local engine",
  custom: "Custom AI",
  openai: "[OI]",
  anthropic: "Claude",
};

const FIELD =
  "h-10 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  source?: string;
  aiConfigured?: boolean;
  variants?: StrategyVariant[];
  recommendedId?: string | null;
  assumptions?: string[];
  warnings?: string[];
  understood?: string[];
};

function StrategyCard({
  variant,
  code,
  decimals,
  priceCurrency,
  applied,
  onApply,
}: {
  variant: StrategyVariant;
  code: string;
  decimals: number;
  priceCurrency: string;
  applied: boolean;
  onApply: () => void;
}) {
  const free = variant.price <= 0;
  const double = variant.sensitivity.find((s) => s.priceMultiple === 2);

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-4",
        variant.recommended ? "border-gold-500/50 bg-gold-500/[0.06]" : "border-white/10 bg-ink-950/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-bold text-white">{variant.label}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {free ? "Free starter" : `${variant.payoutRatioPct.toFixed(0)}% of price paid out`}
          </p>
        </div>
        {variant.recommended && <Badge variant="gold">Recommended</Badge>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Readout label="Price" value={free ? "Free" : formatFiat(variant.price, priceCurrency)} />
        <Readout label="Term" value={`${variant.duration} days`} />
        <Readout
          label="Daily credit"
          value={`${formatCrypto(variant.point_per_day, decimals)} ${code}`}
          tone="good"
        />
        <Readout
          label="Total payout"
          value={`${formatCrypto(variant.payoutToUser, decimals)} ${code}`}
        />
        <Readout
          label="Net margin"
          value={free ? "n/a" : `${variant.netMarginPct.toFixed(1)}%`}
          tone={variant.netMarginPct < 0 ? "bad" : "good"}
        />
        <Readout
          label="Member ROI"
          value={`${variant.userRoiPct >= 0 ? "+" : ""}${variant.userRoiPct.toFixed(1)}%`}
          tone={variant.userRoiPct < 0 ? "bad" : "good"}
        />
      </div>

      {!free && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-[11px] leading-relaxed text-slate-400">
          <span className="text-slate-300">DOGE +100%:</span>{" "}
          {double ? (
            <>
              net {formatFiat(double.netProfit, priceCurrency)} ({double.netMarginPct.toFixed(1)}% margin)
            </>
          ) : (
            "rate unavailable"
          )}
          {" · "}
          <span className="text-slate-300">Break-even:</span>{" "}
          {variant.breakEvenDays > 0 ? `${variant.breakEvenDays.toFixed(1)} days` : "instant"}
        </div>
      )}

      {variant.warnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {variant.warnings.slice(0, 2).map((warning) => (
            <li key={warning} className="flex gap-1.5 text-[11px] leading-relaxed text-amber-200">
              <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {warning}
            </li>
          ))}
        </ul>
      )}

        <Button
          size="sm"
          variant={variant.recommended ? "gold" : "secondary"}
          className="mt-4 w-full"
          onClick={onApply}
        >
        {applied ? (
          <>
            <Check size={14} /> Applied
          </>
        ) : (
          "Use this plan"
        )}
      </Button>
    </div>
  );
}

function Readout({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-950/50 px-2.5 py-1.5">
      <p className="text-[10px] font-medium text-slate-400">{label}</p>
      <p
        className={cn(
          "font-mono mt-0.5 text-xs tabular-nums",
          tone === "bad" ? "text-red-300" : tone === "good" ? "text-emerald-300" : "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

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
  const [objective, setObjective] = useState<StrategyObjective>("balanced");
  const [price, setPrice] = useState(context.price ? String(context.price) : "");
  const [duration, setDuration] = useState(context.durationDays ? String(context.durationDays) : "");
  const [targetRoi, setTargetRoi] = useState("");
  const [minMargin, setMinMargin] = useState("15");
  const [maxPayout, setMaxPayout] = useState("85");
  const [freePlan, setFreePlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<StrategyVariant[]>([]);
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [source, setSource] = useState("builtin");
  const [aiConfigured, setAiConfigured] = useState(false);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [understood, setUnderstood] = useState<string[]>([]);
  const [applied, setApplied] = useState<string | null>(null);

  async function generate() {
    if (!goal.trim() && !price.trim() && !duration.trim() && !freePlan) {
      setError("Describe a goal or fill at least one field.");
      return;
    }
    setBusy(true);
    setError(null);
    setApplied(null);
    try {
      const res = await fetch("/api/admin/plans/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "strategy",
          goal,
          brief: {
            objective,
            price: price.trim() ? Number(price) : null,
            durationDays: duration.trim() ? Number(duration) : null,
            targetRoiPct: targetRoi.trim() ? Number(targetRoi) : null,
            minMarginPct: minMargin.trim() ? Number(minMargin) : 15,
            maxPayoutRatioPct: maxPayout.trim() ? Number(maxPayout) : 85,
            freePlan,
          },
          context: {
            ...context,
            price: price.trim() ? Number(price) : context.price,
            durationDays: duration.trim() ? Number(duration) : context.durationDays,
          },
        }),
      });
      const j = (await res.json()) as ApiResponse;
      if (!j.ok || !j.variants?.length) {
        setError(j.error ?? "Could not build a viable plan.");
        setVariants([]);
        setWarnings(j.warnings ?? []);
        return;
      }
      setVariants(j.variants);
      setRecommendedId(j.recommendedId ?? null);
      setSource(j.source ?? "builtin");
      setAiConfigured(Boolean(j.aiConfigured));
      setAssumptions(j.assumptions ?? []);
      setWarnings(j.warnings ?? []);
      setUnderstood(j.understood ?? []);
    } catch {
      setError("Could not reach the plan studio.");
    } finally {
      setBusy(false);
    }
  }

  function apply(variant: StrategyVariant) {
    onApply(variant);
    setApplied(variant.id);
  }

  return (
    <div className="rounded-2xl border border-gold-500/25 bg-gold-500/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gold-300">
          <Sparkles size={15} className="text-gold-400" /> Strategy Studio
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="slate">{SOURCE_LABEL[source] ?? source}</Badge>
          <span className="text-[10px] text-slate-400">
            {aiConfigured ? "AI parsing on" : "local math only"}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Set the goal and constraints, then compare three plans. The local engine calculates every
        number, including DOGE-price sensitivity. AI only reads your sentence when configured.
      </p>

      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={2}
        placeholder="e.g. $25 plan, 90 days, members should get 70% back, keep at least 15% margin"
        aria-label="Describe the plan"
        className="mt-3 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setGoal(example)}
            className="tap inline-flex min-h-[44px] items-center rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:border-gold-500/50 hover:text-white"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs font-medium text-slate-400">
          Objective
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value as StrategyObjective)}
            className={cn(FIELD, "mt-1")}
          >
            <option value="balanced">Balanced</option>
            <option value="profit">Owner profit</option>
            <option value="growth">Member growth</option>
            <option value="retention">Retention</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Price ({priceCurrency})
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="auto"
            className={cn(FIELD, "mt-1 font-mono")}
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Term (days)
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            inputMode="numeric"
            placeholder="90"
            className={cn(FIELD, "mt-1 font-mono")}
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Target member ROI (%)
          <input
            value={targetRoi}
            onChange={(e) => setTargetRoi(e.target.value)}
            inputMode="decimal"
            placeholder="optional"
            className={cn(FIELD, "mt-1 font-mono")}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-slate-400">
          Minimum owner margin (%)
          <input
            value={minMargin}
            onChange={(e) => setMinMargin(e.target.value)}
            inputMode="decimal"
            className={cn(FIELD, "mt-1 font-mono")}
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Maximum payout ratio (%)
          <input
            value={maxPayout}
            onChange={(e) => setMaxPayout(e.target.value)}
            inputMode="decimal"
            className={cn(FIELD, "mt-1 font-mono")}
          />
        </label>
        <label className="mt-6 flex items-center gap-2 text-xs font-medium text-slate-300">
          <input
            type="checkbox"
            checked={freePlan}
            onChange={(e) => setFreePlan(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-ink-900 accent-gold-500"
          />
          Free starter plan
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={generate} disabled={busy} className="ml-auto">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {busy ? "Comparing options" : "Generate 3 options"}
        </Button>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-300">{error}</p>}

      {variants.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-200">Comparison</span>
            {understood.slice(0, 4).map((item) => (
              <span key={item} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px]">
                {item}
              </span>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {variants.map((variant) => (
              <StrategyCard
                key={variant.id}
                variant={variant}
                code={code}
                decimals={decimals}
                priceCurrency={priceCurrency}
                applied={applied === variant.id}
                onApply={() => apply(variant)}
              />
            ))}
          </div>

          {recommendedId && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              Recommended for <span className="text-slate-200">{objective}</span>. You can still
              apply any variant and edit the numbers below.
            </p>
          )}

          {assumptions.length > 0 && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              Assumed: {assumptions.join(" ")}
            </p>
          )}

          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2">
              {[...new Set(warnings)].slice(0, 4).map((warning) => (
                <p key={warning} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-200">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {warning}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
