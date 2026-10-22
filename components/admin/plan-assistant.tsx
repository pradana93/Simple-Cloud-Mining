"use client";

import { useId, useState } from "react";
import { Calculator, Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCrypto } from "@/lib/utils";
import { formatFiat } from "@/lib/money";
import type { PlanContext, PlanProposal } from "@/lib/plan-goal";
import type { StrategyObjective, StrategyVariant } from "@/lib/plan-studio";

type Preset = {
  id: string;
  label: string;
  detail: string;
  price: string;
  duration: string;
  objective: StrategyObjective;
  free?: boolean;
};

const PRESETS: Preset[] = [
  { id: "free", label: "Free", detail: "$0 / 30 days", price: "", duration: "30", objective: "growth", free: true },
  { id: "entry", label: "Entry", detail: "$1 / 30 days", price: "1", duration: "30", objective: "growth" },
  { id: "growth", label: "Growth", detail: "$5 / 90 days", price: "5", duration: "90", objective: "growth" },
  { id: "balanced", label: "Balanced", detail: "$25 / 90 days", price: "25", duration: "90", objective: "balanced" },
  { id: "premium", label: "Premium", detail: "$100 / 180 days", price: "100", duration: "180", objective: "profit" },
];

const EXAMPLES = [
  "$1 entry plan, 30 days, keep 15% margin",
  "$5 plan, 90 days, 85% back",
  "$25 balanced, 70% back",
  "$100 premium, 180 days, keep 40% margin",
];

const SOURCE_LABEL: Record<string, string> = {
  builtin: "Local parser",
  custom: "Custom AI",
  openai: "OpenAI",
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

function money(value: number, currency: string): string {
  return `${value < 0 ? "-" : ""}${formatFiat(Math.abs(value), currency)}`;
}

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
  const memberValue = variant.price * (variant.payoutRatioPct / 100);
  const roi = `${variant.userRoiPct >= 0 ? "+" : ""}${variant.userRoiPct.toFixed(1)}%`;

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
          <p className="mt-1 text-xs text-slate-400">
            {free ? "No charge" : `${variant.payoutRatioPct.toFixed(0)}% of the price returned`}
          </p>
        </div>
        {variant.recommended && <Badge variant="gold">Recommended</Badge>}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-300">
        {free ? (
          "A no-cost starter plan. The house pays the daily credit."
        ) : (
          <>
            A member pays <span className="font-mono text-white">{formatFiat(variant.price, priceCurrency)}</span> and
            gets <span className="font-mono text-white">{formatFiat(memberValue, priceCurrency)}</span> back over{" "}
            {variant.duration} days.
          </>
        )}
      </p>

      <dl className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs">
        <Metric label="Daily credit" value={`${formatCrypto(variant.point_per_day, decimals)} ${code}`} />
        <Metric label="Total payout" value={`${formatCrypto(variant.payoutToUser, decimals)} ${code}`} />
        {free ? (
          <Metric label="House cost" value={money(variant.netProfit, priceCurrency)} tone="bad" />
        ) : (
          <>
            <Metric
              label="You keep"
              value={money(variant.netProfit, priceCurrency)}
              detail={`${variant.netMarginPct.toFixed(1)}% margin`}
              tone={variant.netProfit < 0 ? "bad" : "good"}
            />
            <Metric label="Member ROI" value={roi} tone={variant.userRoiPct < 0 ? "bad" : "good"} />
            <Metric
              label="If DOGE doubles"
              value={double ? `${money(double.netProfit, priceCurrency)} kept` : "Rate unavailable"}
              detail={double ? `${double.netMarginPct.toFixed(1)}% margin` : undefined}
              tone={double && double.netProfit < 0 ? "bad" : "good"}
            />
          </>
        )}
      </dl>

      {variant.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
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
        className="mt-auto w-full"
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

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right">
        <span
          className={cn(
            "font-mono tabular-nums",
            tone === "bad" ? "text-red-300" : tone === "good" ? "text-emerald-300" : "text-white"
          )}
        >
          {value}
        </span>
        {detail && <span className="ml-1 text-[10px] text-slate-500">({detail})</span>}
      </dd>
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
  const goalId = useId();
  const [goal, setGoal] = useState("");
  const [objective, setObjective] = useState<StrategyObjective>("balanced");
  const [price, setPrice] = useState(context.price && context.price > 0 ? String(context.price) : "");
  const [duration, setDuration] = useState(context.durationDays ? String(context.durationDays) : "30");
  const [targetRoi, setTargetRoi] = useState("");
  const [minMargin, setMinMargin] = useState("15");
  const [maxPayout, setMaxPayout] = useState("85");
  const [freePlan, setFreePlan] = useState(Boolean(context.isEdit && context.price === 0));
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<StrategyVariant[]>([]);
  const [source, setSource] = useState("builtin");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [understood, setUnderstood] = useState<string[]>([]);
  const [applied, setApplied] = useState<string | null>(null);

  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);
    setGoal("");
    setFreePlan(Boolean(preset.free));
    setPrice(preset.price);
    setDuration(preset.duration);
    setObjective(preset.objective);
    setTargetRoi("");
    setMinMargin("15");
    setMaxPayout("85");
    setVariants([]);
    setWarnings([]);
    setAssumptions([]);
    setUnderstood([]);
    setApplied(null);
    setError(null);
  }

  async function generate() {
    const numericPrice = freePlan ? 0 : price.trim() ? Number(price) : null;
    if (numericPrice != null && (!Number.isFinite(numericPrice) || numericPrice < 0)) {
      setError("Enter a price of zero or more.");
      return;
    }
    const numericDuration = duration.trim() ? Number(duration) : null;
    if (numericDuration != null && (!Number.isFinite(numericDuration) || numericDuration < 1)) {
      setError("Enter a term of at least one day.");
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
            price: numericPrice,
            durationDays: numericDuration,
            targetRoiPct: targetRoi.trim() ? Number(targetRoi) : null,
            minMarginPct: minMargin.trim() ? Number(minMargin) : 15,
            maxPayoutRatioPct: maxPayout.trim() ? Number(maxPayout) : 85,
            freePlan,
          },
          context: {
            ...context,
            price: context.isEdit ? context.price : context.price && context.price > 0 ? context.price : undefined,
            durationDays: numericDuration ?? context.durationDays,
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
      setSource(j.source ?? "builtin");
      setAiConfigured(Boolean(j.aiConfigured));
      setAssumptions(j.assumptions ?? []);
      setWarnings(j.warnings ?? []);
      setUnderstood(j.understood ?? []);
    } catch {
      setError("Could not reach the plan assistant.");
    } finally {
      setBusy(false);
    }
  }

  function apply(variant: StrategyVariant) {
    onApply(variant);
    setApplied(variant.id);
  }

  const parserLabel = SOURCE_LABEL[source] ?? source;
  const globalWarnings = [...new Set(warnings)].filter(
    (warning) => !variants.some((variant) => variant.warnings.includes(warning))
  );
  const resultPrice = variants[0]?.price ?? 0;
  const resultDuration = variants[0]?.duration ?? 0;

  return (
    <section className="rounded-2xl border border-gold-500/25 bg-gold-500/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gold-300">
            <Calculator size={15} className="text-gold-400" /> AI plan assistant
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            Pick a starting point or describe the plan. Every price, payout, and margin is calculated
            here, so the preview matches the plan you save.
          </p>
        </div>
        <span className="text-[11px] text-slate-400">Local math engine</span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <div>
          <fieldset>
            <legend className="text-xs font-medium text-slate-300">Quick starts</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={activePreset === preset.id}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "tap rounded-xl border px-3 py-2 text-left transition-colors",
                    activePreset === preset.id
                      ? "border-gold-500/70 bg-gold-500/10 text-white"
                      : "border-slate-700 bg-ink-950/40 text-slate-300 hover:border-gold-500/40 hover:text-white"
                  )}
                >
                  <span className="block font-display text-xs font-semibold">{preset.label}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{preset.detail}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <label htmlFor={goalId} className="text-xs font-medium text-slate-300">
              Describe the plan (optional)
            </label>
            <textarea
              id={goalId}
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                setActivePreset(null);
              }}
              rows={2}
              placeholder="e.g. $1 entry plan, 30 days, members get 70% back"
              className="mt-1 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
            />
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setGoal(example)}
                  className="text-left text-[11px] text-slate-400 underline decoration-slate-700 underline-offset-2 hover:text-slate-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-slate-400">
              Price ({priceCurrency})
              <input
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setActivePreset(null);
                }}
                inputMode="decimal"
                min="0"
                step="0.01"
                disabled={freePlan}
                placeholder="auto"
                className={cn(FIELD, "mt-1 font-mono disabled:opacity-50")}
              />
            </label>
            <label className="block text-xs font-medium text-slate-400">
              Term (days)
              <input
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  setActivePreset(null);
                }}
                inputMode="numeric"
                min="1"
                placeholder="30"
                className={cn(FIELD, "mt-1 font-mono")}
              />
            </label>
            <label className="block text-xs font-medium text-slate-400">
              Objective
              <select
                value={objective}
                onChange={(e) => {
                  setObjective(e.target.value as StrategyObjective);
                  setActivePreset(null);
                }}
                className={cn(FIELD, "mt-1")}
              >
                <option value="balanced">Balanced</option>
                <option value="profit">More owner profit</option>
                <option value="growth">Member growth</option>
                <option value="retention">Longer retention</option>
              </select>
            </label>
          </div>

          <label className="mt-3 flex items-start gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={freePlan}
              onChange={(e) => {
                setFreePlan(e.target.checked);
                setActivePreset(null);
                if (e.target.checked) setPrice("");
              }}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-ink-900 accent-gold-500"
            />
            <span>
              Free starter plan
              <span className="block text-[11px] text-slate-500">No price. This can be the default plan.</span>
            </span>
          </label>

          <details className="mt-4 rounded-xl border border-white/10 bg-ink-950/30 px-3 py-2.5">
            <summary className="cursor-pointer text-xs font-medium text-slate-300">
              Payout rules (advanced)
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Payout ratio is the share of the price returned to the member before fees. ROI is the
              total return for the member: 0% means they get their price back, 100% means they double it.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-medium text-slate-400">
                Target member ROI (%)
                <input
                  value={targetRoi}
                  onChange={(e) => {
                    setTargetRoi(e.target.value);
                    setActivePreset(null);
                  }}
                  inputMode="decimal"
                  placeholder="optional"
                  className={cn(FIELD, "mt-1 font-mono")}
                />
              </label>
              <label className="block text-xs font-medium text-slate-400">
                Minimum owner margin (%)
                <input
                  value={minMargin}
                  onChange={(e) => {
                    setMinMargin(e.target.value);
                    setActivePreset(null);
                  }}
                  inputMode="decimal"
                  className={cn(FIELD, "mt-1 font-mono")}
                />
              </label>
              <label className="block text-xs font-medium text-slate-400">
                Maximum payout ratio (%)
                <input
                  value={maxPayout}
                  onChange={(e) => {
                    setMaxPayout(e.target.value);
                    setActivePreset(null);
                  }}
                  inputMode="decimal"
                  className={cn(FIELD, "mt-1 font-mono")}
                />
              </label>
            </div>
          </details>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={generate} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
              {busy ? "Building plans" : "Compare 3 options"}
            </Button>
            <span className="text-[11px] text-slate-500">Nothing is saved until you use a plan.</span>
          </div>

          {error && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-300">
              {error}
            </p>
          )}
        </div>

        <aside className="self-start rounded-xl border border-white/10 bg-ink-950/40 p-3.5">
          <p className="text-xs font-semibold text-slate-200">What the numbers mean</p>
          <dl className="mt-3 space-y-3 text-[11px] leading-relaxed">
            <div>
              <dt className="font-medium text-slate-300">Price</dt>
              <dd className="text-slate-500">What the member pays in {priceCurrency}.</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-300">Daily credit</dt>
              <dd className="text-slate-500">How much {code} lands in their balance each day.</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-300">Payout ratio</dt>
              <dd className="text-slate-500">The share of the price they get back before fees.</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-300">You keep</dt>
              <dd className="text-slate-500">What is left after the payout, processor fee, and affiliate cut.</dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-500">
            {aiConfigured == null
              ? "The sentence box is optional. The quick starts and fields work without an AI key."
              : aiConfigured
                ? "An AI parser is available for the sentence box."
                : "No AI key is configured. The local parser still reads the sentence."}{" "}
            The app calculates every number; an AI only reads words.
          </p>
        </aside>
      </div>

      {variants.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-200">Choose a plan</p>
              <p className="mt-1 text-xs text-slate-400">
                {variants.length} options for {resultPrice > 0 ? formatFiat(resultPrice, priceCurrency) : "a free starter"}{" "}
                over {resultDuration} days. Each one clears your margin floor or says why it does not.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">Read by {parserLabel}</p>
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

          {globalWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2">
              {globalWarnings.slice(0, 4).map((warning) => (
                <p key={warning} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-200">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {warning}
                </p>
              ))}
            </div>
          )}

          {(assumptions.length > 0 || understood.length > 0) && (
            <details className="rounded-xl border border-white/10 bg-ink-950/30 px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-medium text-slate-300">Assumptions</summary>
              {understood.length > 0 && (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Read as: <span className="text-slate-300">{understood.join(", ")}</span>.
                </p>
              )}
              {assumptions.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-500">
                  {assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </details>
          )}
        </div>
      )}
    </section>
  );
}
