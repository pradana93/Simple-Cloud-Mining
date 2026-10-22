"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Calculator, Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCrypto } from "@/lib/utils";
import { formatFiat } from "@/lib/money";
import { parseGoal, type PlanContext, type PlanProposal } from "@/lib/plan-goal";
import { planNetEconomics } from "@/lib/plan-math";
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
  "$5 plan, 90 days, $0.10 daily profit",
  "$20 plan, 30 days, $0.05 daily profit",
  "$100 plan, 180 days, 1.4x total payout",
  "$25 plan, 90 days, +40% member ROI",
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

function numeric(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type Preview =
  | { free: true }
  | {
      free: false;
      price: number;
      duration: number;
      totalFiat: number;
      dailyCrypto: number;
      totalCrypto: number;
      userRoiPct: number;
      netProfit: number;
      netMarginPct: number;
      breakEvenDays: number;
      warnings: string[];
    }
  | { error: string };

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
  const memberProfit = memberValue - variant.price;
  const roi = `${variant.userRoiPct >= 0 ? "+" : ""}${variant.userRoiPct.toFixed(1)}%`;
  const houseCost = Math.abs(variant.netProfit);
  const houseCostPct = Math.abs(variant.netMarginPct);

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
              label={variant.netProfit < 0 ? "House top-up" : "You keep"}
              value={money(houseCost, priceCurrency)}
              detail={
                variant.netProfit < 0
                  ? `${houseCostPct.toFixed(1)}% of price`
                  : `${variant.netMarginPct.toFixed(1)}% margin`
              }
              tone={variant.netProfit < 0 ? "bad" : "good"}
            />
            <Metric label="Member ROI" value={roi} tone={variant.userRoiPct < 0 ? "bad" : "good"} />
            <Metric
              label="Member profit"
              value={money(memberProfit, priceCurrency)}
              tone={memberProfit < 0 ? "bad" : "good"}
            />
            <Metric
              label="If DOGE doubles"
              value={
                double
                  ? `${money(Math.abs(double.netProfit), priceCurrency)} ${
                      double.netProfit < 0 ? "top-up" : "kept"
                    }`
                  : "Rate unavailable"
              }
              detail={
                double
                  ? double.netProfit < 0
                    ? `${Math.abs(double.netMarginPct).toFixed(1)}% of price`
                    : `${double.netMarginPct.toFixed(1)}% margin`
                  : undefined
              }
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

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-950/50 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "font-mono mt-0.5 text-xs font-semibold tabular-nums",
          tone === "bad" ? "text-red-300" : tone === "good" ? "text-emerald-300" : "text-slate-100"
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
  const goalId = useId();
  const [goal, setGoal] = useState("");
  const [objective, setObjective] = useState<StrategyObjective>("balanced");
  const [price, setPrice] = useState(context.price && context.price > 0 ? String(context.price) : "");
  const [duration, setDuration] = useState(context.durationDays ? String(context.durationDays) : "30");
  const [dailyProfit, setDailyProfit] = useState("");
  const [targetRoi, setTargetRoi] = useState("");
  const [minMargin, setMinMargin] = useState("0");
  const [maxPayout, setMaxPayout] = useState("300");
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

  useEffect(() => {
    setVariants([]);
    setWarnings([]);
    setAssumptions([]);
    setUnderstood([]);
    setApplied(null);
  }, [price, duration, dailyProfit, targetRoi, minMargin, maxPayout, objective, freePlan]);

  const preview = useMemo<Preview>(() => {
    if (freePlan) return { free: true };

    const p = numeric(price);
    const d = numeric(duration);
    const dp = numeric(dailyProfit);
    const tr = numeric(targetRoi);
    const c2p = Number(context.cryptoToPrice ?? 0);

    const hasSentence = Boolean(goal.trim());
    if (p == null || p <= 0) {
      return {
        error: hasSentence
          ? "Use Fill calculator to load the sentence, or enter a plan price."
          : "Enter a plan price, or mark this as a free starter.",
      };
    }
    if (d == null || d < 1) return { error: "Enter a term of at least one day." };
    if (dp != null && dp < 0) return { error: "Daily member profit cannot be negative." };
    if (tr != null && tr < -100) return { error: "Target member ROI cannot be below -100%." };
    if (dp == null && tr == null) {
      return {
        error: hasSentence
          ? "Use Fill calculator to load the sentence, or enter daily profit / target ROI."
          : "Add a daily member profit or a target member ROI to see the live preview.",
      };
    }
    if (!(c2p > 0)) return { error: "The live DOGE rate is unavailable, so the preview cannot be calculated." };

    const targetRatio = dp != null ? ((p + dp * d) / p) * 100 : 100 + tr!;
    const processorPct = Math.max(0, context.processorPct ?? 0.25);
    const affiliatePct = Math.max(0, context.affiliatePct ?? 0);
    const minMarginPct = Math.min(90, Math.max(0, numeric(minMargin) ?? 0));
    const maxPayoutRatioPct = Math.min(300, Math.max(5, numeric(maxPayout) ?? 300));
    const marginCap =
      minMarginPct > 0 ? 100 - minMarginPct - processorPct - affiliatePct : maxPayoutRatioPct;
    const capRatio = Math.min(maxPayoutRatioPct, marginCap);
    if (capRatio < 5) {
      return { error: "The margin floor and payout cap leave no room for a viable plan." };
    }

    const effectiveRatio = Math.min(targetRatio, capRatio);
    const totalFiat = p * (effectiveRatio / 100);
    const dailyCrypto = Number((totalFiat / d / c2p).toFixed(8));
    const totalCrypto = Number((dailyCrypto * d).toFixed(8));
    const e = planNetEconomics({
      price: p,
      point_per_day: dailyCrypto,
      duration: d,
      cryptoToPrice: c2p,
      processorPct,
      affiliatePct,
    });
    const warnings: string[] = [];
    if (dp != null && tr != null) {
      warnings.push("Daily member profit takes priority; the target ROI field is ignored.");
    }
    if (e.userRoiPct < 0) warnings.push("Members get back less than the price they paid.");
    if (e.netProfit < 0) warnings.push("The house funds a top-up after processor and affiliate costs.");
    if (e.breakEvenDays > d) warnings.push("Members do not recover the price inside the term.");
    if (targetRatio > capRatio + 0.01) {
      warnings.push(
        `The requested payout is capped at ${capRatio.toFixed(1)}% by the maximum payout rule.`
      );
    }

    return {
      free: false,
      price: p,
      duration: d,
      totalFiat,
      dailyCrypto,
      totalCrypto,
      userRoiPct: e.userRoiPct,
      netProfit: e.netProfit,
      netMarginPct: e.netMarginPct,
      breakEvenDays: e.breakEvenDays,
      warnings,
    };
  }, [freePlan, price, duration, dailyProfit, targetRoi, minMargin, maxPayout, goal, context]);

  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);
    setGoal("");
    setFreePlan(Boolean(preset.free));
    setPrice(preset.price);
    setDuration(preset.duration);
    setObjective(preset.objective);
    setDailyProfit("");
    setTargetRoi("");
    setMinMargin("0");
    setMaxPayout("300");
    setVariants([]);
    setWarnings([]);
    setAssumptions([]);
    setUnderstood([]);
    setApplied(null);
    setError(null);
  }

  function setGoalText(value: string) {
    setGoal(value);
    if (activePreset) {
      setDailyProfit("");
      setTargetRoi("");
      setMinMargin("0");
      setMaxPayout("300");
    }
    setActivePreset(null);
  }

  function fillFromGoal(text = goal) {
    const intent = parseGoal(text, context);
    const p = intent.price ?? numeric(price) ?? context.price ?? null;
    const d = intent.durationDays ?? numeric(duration) ?? context.durationDays ?? null;
    const c2p = Number(context.cryptoToPrice ?? 0);
    let filled = false;

    if (intent.price != null) {
      setPrice(String(intent.price));
      filled = true;
    }
    if (intent.durationDays != null) {
      setDuration(String(intent.durationDays));
      filled = true;
    }
    if (intent.isDefault) {
      setFreePlan(true);
      setPrice("");
      filled = true;
    }

    if (intent.dailyProfit != null) {
      setDailyProfit(String(intent.dailyProfit));
      setTargetRoi("");
      filled = true;
    } else {
      let roi: number | null = null;
      if (intent.userRoiPct != null) roi = intent.userRoiPct;
      else if (intent.userMultiple != null) roi = (intent.userMultiple - 1) * 100;
      else if (intent.payoutRatioPct != null) roi = intent.payoutRatioPct - 100;
      else if (intent.ownerMarginPct != null) roi = -intent.ownerMarginPct;
      else if (intent.dailyRatePct != null && d != null) roi = intent.dailyRatePct * d - 100;
      else if (intent.dailyYield != null && p != null && p > 0 && d != null && c2p > 0) {
        roi = (intent.dailyYield * d * c2p * 100) / p - 100;
      }
      if (roi != null) {
        setTargetRoi(String(Number(roi.toFixed(2))));
        filled = true;
      }
    }

    setGoal(text);
    setActivePreset(null);
    setVariants([]);
    setWarnings([]);
    setAssumptions([]);
    setUnderstood([]);
    setApplied(null);
    setError(
      filled
        ? null
        : "I could not find a price, term, daily profit, ROI, or payout in that sentence. Enter the fields below."
    );
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
    const numericDailyProfit = dailyProfit.trim() ? Number(dailyProfit) : null;
    if (numericDailyProfit != null && (!Number.isFinite(numericDailyProfit) || numericDailyProfit < 0)) {
      setError("Enter a daily member profit of zero or more.");
      return;
    }
    const numericTargetRoi = targetRoi.trim() ? Number(targetRoi) : null;
    if (numericTargetRoi != null && (!Number.isFinite(numericTargetRoi) || numericTargetRoi < -100)) {
      setError("Enter a target member ROI of -100% or more, or leave it blank.");
      return;
    }
    const numericMinMargin = minMargin.trim() ? Number(minMargin) : 0;
    const numericMaxPayout = maxPayout.trim() ? Number(maxPayout) : 300;
    if (!Number.isFinite(numericMinMargin) || !Number.isFinite(numericMaxPayout)) {
      setError("Payout rules must be numbers.");
      return;
    }
    if (!goal.trim() && "error" in preview) {
      setError(preview.error);
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
            dailyProfit: numericDailyProfit,
            targetRoiPct: numericTargetRoi,
            minMarginPct: numericMinMargin,
            maxPayoutRatioPct: numericMaxPayout,
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
        setError(j.error ?? j.warnings?.[0] ?? "Could not build a viable plan.");
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
            Enter the price, daily member profit, and term. The live preview shows the payout, member
            ROI, and house margin before anything is generated or saved.
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

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              Daily member profit ({priceCurrency})
              <input
                value={dailyProfit}
                onChange={(e) => {
                  setDailyProfit(e.target.value);
                  setActivePreset(null);
                }}
                inputMode="decimal"
                min="0"
                step="0.01"
                disabled={freePlan}
                placeholder="0.00"
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
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Daily profit is paid on top of the price. Total returned = price + (daily profit × days).
          </p>

          <div
            aria-live="polite"
            className={cn(
              "mt-4 rounded-xl border px-3 py-3",
              "error" in preview
                ? "border-white/10 bg-ink-950/40"
                : "border-emerald-500/20 bg-emerald-500/[0.04]"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-300">Live preview</p>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                Updates as you type
              </span>
            </div>
            {"error" in preview ? (
              <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-amber-200">
                <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {preview.error}
              </p>
            ) : preview.free ? (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Free starter: no price and no member deposit. The house funds the daily credit.
              </p>
            ) : (
              <>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <PreviewStat label="Total back" value={money(preview.totalFiat, priceCurrency)} />
                  <PreviewStat
                    label="Member ROI"
                    value={`${preview.userRoiPct >= 0 ? "+" : ""}${preview.userRoiPct.toFixed(1)}%`}
                    tone={preview.userRoiPct < 0 ? "bad" : "good"}
                  />
                  <PreviewStat
                    label="Daily credit"
                    value={`${formatCrypto(preview.dailyCrypto, decimals)} ${code}`}
                  />
                  <PreviewStat
                    label={preview.netProfit < 0 ? "House top-up" : "House keeps"}
                    value={money(Math.abs(preview.netProfit), priceCurrency)}
                    tone={preview.netProfit < 0 ? "bad" : "good"}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Total payout {formatCrypto(preview.totalCrypto, decimals)} {code} over{" "}
                  {preview.duration} days · break-even {preview.breakEvenDays.toFixed(1)} days ·
                  house margin {preview.netMarginPct.toFixed(1)}%
                </p>
                {preview.warnings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {preview.warnings.map((warning) => (
                      <li
                        key={warning}
                        className="flex gap-1.5 text-[11px] leading-relaxed text-amber-200"
                      >
                        <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {warning}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-ink-950/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={goalId} className="text-xs font-medium text-slate-300">
                Or describe the plan (optional)
              </label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fillFromGoal()}
                disabled={!goal.trim()}
              >
                <Sparkles size={13} /> Fill calculator
              </Button>
            </div>
            <textarea
              id={goalId}
              value={goal}
              onChange={(e) => setGoalText(e.target.value)}
              rows={2}
              placeholder="e.g. $20 plan, 30 days, $0.10 daily profit"
              className="mt-2 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Reads a price, term, daily profit, total payout, or ROI. Click an example to fill the
              calculator.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => fillFromGoal(example)}
                  className="text-left text-[11px] text-slate-400 underline decoration-slate-700 underline-offset-2 hover:text-slate-200"
                >
                  {example}
                </button>
              ))}
            </div>
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
                Owner margin floor (%)
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
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              A payout ratio above 100% means the member profits. The daily profit field is the
              direct way to set the total. Leave the owner margin floor at 0 for member-positive
              plans, or raise it to cap the payout for house margin.
            </p>
          </details>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={generate} disabled={busy || (!goal.trim() && "error" in preview)}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
              {busy ? "Building plans" : "Build plan options"}
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
              <dt className="font-medium text-slate-300">Daily member profit</dt>
              <dd className="text-slate-500">
                Extra {priceCurrency} the member earns each day, on top of getting the price back.
              </dd>
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
              <dt className="font-medium text-slate-300">Member profit</dt>
              <dd className="text-slate-500">Total returned minus the price they paid.</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-300">House margin</dt>
              <dd className="text-slate-500">
                What is left after the payout, processor fee, and affiliate cut. A negative result is
                the top-up the house funds.
              </dd>
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
                over {resultDuration} days. Your target sets the top payout; lower options step it down
                so you can compare.
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
