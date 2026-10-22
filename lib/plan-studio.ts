import { planNetEconomics } from "./plan-math";
import type { PlanContext, PlanIntent, PlanProposal } from "./plan-goal";

// Deterministic strategy engine. The language model, when configured, only
// turns a sentence into intent. Every number, guardrail, and sensitivity case
// is calculated here so the preview matches the saved plan exactly.

export type StrategyObjective = "profit" | "balanced" | "growth" | "retention";

export type StrategyBrief = {
  objective?: StrategyObjective;
  price?: number | null;
  durationDays?: number | null;
  targetRoiPct?: number | null;
  minMarginPct?: number | null;
  maxPayoutRatioPct?: number | null;
  freePlan?: boolean;
};

export type StrategySensitivity = {
  label: string;
  priceMultiple: number;
  netProfit: number;
  netMarginPct: number;
};

export type StrategyVariant = PlanProposal & {
  id: "conservative" | "balanced" | "aggressive" | "free";
  label: string;
  recommended: boolean;
  score: number;
  netProfit: number;
  netMarginPct: number;
  processorFee: number;
  affiliateCost: number;
  payoutRatioPct: number;
  sensitivity: StrategySensitivity[];
  minWithdrawCovered: boolean;
};

export type StrategyResult = {
  variants: StrategyVariant[];
  recommendedId: string | null;
  objective: StrategyObjective;
  assumptions: string[];
  warnings: string[];
  understood: string[];
};

const round = (n: number, d = 8) => Number(n.toFixed(d));
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const DEFAULT_PRICE: Record<StrategyObjective, number> = {
  profit: 50,
  balanced: 25,
  growth: 10,
  retention: 5,
};

const DEFAULT_PAYOUT_RATIO: Record<StrategyObjective, number> = {
  profit: 45,
  balanced: 70,
  growth: 85,
  retention: 75,
};

function objectiveOf(value: unknown): StrategyObjective {
  return value === "profit" || value === "growth" || value === "retention" ? value : "balanced";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function scoreOf(
  objective: StrategyObjective,
  netMarginPct: number,
  userRoiPct: number,
  duration: number,
  netProfit: number,
  minMarginPct: number,
  sensitivity: StrategySensitivity[],
  minWithdrawCovered: boolean
): number {
  const base =
    objective === "profit"
      ? netMarginPct * 1.2 + Math.min(0, userRoiPct) * 0.2
      : objective === "growth"
        ? userRoiPct + netMarginPct * 0.4
        : objective === "retention"
          ? userRoiPct * 0.9 + Math.min(24, duration / 90) * 4 + netMarginPct * 0.3
          : netMarginPct * 0.7 + userRoiPct * 0.7;

  let penalty = 0;
  if (netProfit <= 0) penalty += 100;
  if (netMarginPct < minMarginPct) penalty += 50;
  if ((sensitivity.find((s) => s.priceMultiple === 2)?.netProfit ?? 0) < 0) penalty += 20;
  if (!minWithdrawCovered) penalty += 15;
  return round(base - penalty, 4);
}

function variantWarnings(
  netProfit: number,
  netMarginPct: number,
  minMarginPct: number,
  userRoiPct: number,
  breakEvenDays: number,
  duration: number,
  sensitivity: StrategySensitivity[],
  minWithdrawCovered: boolean,
  price: number
): string[] {
  const warnings: string[] = [];
  if (price > 0 && netProfit <= 0) warnings.push("This plan loses money at the current DOGE price.");
  if (price > 0 && netMarginPct < minMarginPct) {
    warnings.push(`Net margin is below your ${minMarginPct.toFixed(0)}% floor.`);
  }
  if (userRoiPct < -30) warnings.push("Members lose more than 30% of the price over the term.");
  if (sensitivity.find((s) => s.priceMultiple === 2)?.netProfit !== undefined) {
    const double = sensitivity.find((s) => s.priceMultiple === 2)!;
    if (double.netProfit < 0) warnings.push("At 2x the current DOGE price, this plan loses money.");
  }
  if (!minWithdrawCovered) warnings.push("The total payout is below the configured withdrawal minimum.");
  if (price > 0 && breakEvenDays > duration) {
    warnings.push("Members do not recover the price inside the plan term.");
  }
  return warnings;
}

export function generateStrategy(
  intent: PlanIntent,
  brief: StrategyBrief,
  context: PlanContext = {}
): StrategyResult {
  const objective = objectiveOf(brief.objective);
  const priceCurrency = context.currencyCode ?? "USD";
  const cryptoCode = context.cryptoCode ?? "DOGE";
  const c2p = Number(context.cryptoToPrice ?? 1) || 0;
  const processorPct = Math.max(0, context.processorPct ?? 0.25);
  const affiliatePct = Math.max(0, context.affiliatePct ?? 0);
  const minMarginPct = clamp(numberOrNull(brief.minMarginPct) ?? 15, 0, 90);
  const maxPayoutRatioPct = clamp(numberOrNull(brief.maxPayoutRatioPct) ?? 85, 5, 100);
  const minWithdraw = Math.max(0, context.minWithdraw ?? 0);
  const assumptions: string[] = [];
  const warnings: string[] = [];
  const understood: string[] = [];

  const requestedPrice = numberOrNull(brief.price) ?? intent.price ?? context.price ?? null;
  const price = requestedPrice == null ? DEFAULT_PRICE[objective] : Math.max(0, requestedPrice);
  const duration = Math.max(
    1,
    Math.round(numberOrNull(brief.durationDays) ?? intent.durationDays ?? context.durationDays ?? 90)
  );
  if (requestedPrice == null) assumptions.push(`Price defaulted to ${price} ${priceCurrency}.`);
  if (numberOrNull(brief.durationDays) == null && intent.durationDays == null && context.durationDays == null) {
    assumptions.push("Term defaulted to 90 days.");
  }
  assumptions.push(`Fees: ${processorPct}% processor, ${affiliatePct}% affiliate.`);
  if (!(c2p > 0)) {
    return {
      variants: [],
      recommendedId: null,
      objective,
      assumptions,
      warnings: ["Live DOGE rate is unavailable. A strategy cannot be calculated safely."],
      understood,
    };
  }

  const free = Boolean(brief.freePlan) || price <= 0;
  if (free) {
    const daily = Math.max(0, numberOrNull(intent.dailyYield) ?? context.pointPerDay ?? 0.02);
    const total = round(daily * duration);
    const cost = round(total * c2p);
    const minWithdrawCovered = minWithdraw <= 0 || total >= minWithdraw;
    const variant: StrategyVariant = {
      id: "free",
      label: "Free starter",
      recommended: true,
      score: 0,
      plan_name: intent.name ?? "Free Plan",
      version: intent.version ?? "",
      price: 0,
      point_per_day: round(daily),
      duration,
      speed: intent.speed ?? "1",
      profit: intent.profit ?? "Free starter plan",
      is_default: true,
      payoutToUser: total,
      ownerProfit: round(-cost),
      ownerMarginPct: 0,
      userRoiPct: 0,
      breakEvenDays: 0,
      dailyRatePct: 0,
      netProfit: round(-cost),
      netMarginPct: 0,
      processorFee: 0,
      affiliateCost: 0,
      payoutRatioPct: 0,
      sensitivity: [],
      minWithdrawCovered,
      rationale: [
        `Free starter: ${daily} ${cryptoCode}/day for ${duration} days.`,
        `Costs the house about ${cost.toFixed(2)} ${priceCurrency} at the current DOGE rate.`,
      ],
      assumptions: [...assumptions, "Free starter plan: no revenue."],
      warnings: minWithdrawCovered ? [] : ["The free plan total is below the withdrawal minimum."],
      understood: [...understood, "free starter plan"],
    };
    return {
      variants: [variant],
      recommendedId: "free",
      objective,
      assumptions: variant.assumptions,
      warnings: variant.warnings,
      understood: variant.understood,
    };
  }

  let targetRatio: number;
  if (numberOrNull(brief.targetRoiPct) != null) {
    targetRatio = 100 + Number(brief.targetRoiPct);
    understood.push(`${brief.targetRoiPct}% member ROI target`);
  } else if (intent.userMultiple != null) {
    targetRatio = intent.userMultiple * 100;
    understood.push(`${intent.userMultiple}x payout target`);
  } else if (intent.userRoiPct != null) {
    targetRatio = 100 + intent.userRoiPct;
    understood.push(`${intent.userRoiPct}% member ROI`);
  } else if (intent.payoutRatioPct != null) {
    targetRatio = intent.payoutRatioPct;
    understood.push(`${intent.payoutRatioPct}% payout ratio`);
  } else if (intent.ownerMarginPct != null) {
    targetRatio = 100 - intent.ownerMarginPct;
    understood.push(`${intent.ownerMarginPct}% owner margin`);
  } else if (intent.dailyRatePct != null) {
    targetRatio = intent.dailyRatePct * duration;
    understood.push(`${intent.dailyRatePct}% daily payout`);
  } else if (intent.dailyYield != null) {
    targetRatio = (intent.dailyYield * duration * c2p * 100) / price;
    understood.push(`${intent.dailyYield} ${cryptoCode}/day`);
  } else {
    targetRatio = DEFAULT_PAYOUT_RATIO[objective];
    assumptions.push(`No payout target given; started from a ${targetRatio}% payout ratio.`);
  }

  // The floor protects the owner after fees. The ceiling protects members from
  // a plan that returns almost nothing.
  const capRatio = Math.min(maxPayoutRatioPct, 100 - minMarginPct - processorPct - affiliatePct);
  if (capRatio < 5) {
    return {
      variants: [],
      recommendedId: null,
      objective,
      assumptions,
      warnings: [
        "Your margin floor and payout cap leave no room for a viable plan. Lower the margin floor or raise the payout cap.",
      ],
      understood,
    };
  }
  const base = clamp(targetRatio, 5, capRatio);
  const ratios: Array<{ id: StrategyVariant["id"]; label: string; ratio: number }> = [
    { id: "conservative", label: "Conservative", ratio: clamp(base * 0.8, 5, capRatio) },
    { id: "balanced", label: "Balanced", ratio: clamp(base * 0.9, 5, capRatio) },
    { id: "aggressive", label: "Aggressive", ratio: base },
  ];

  const variants: StrategyVariant[] = ratios.map(({ id, label, ratio }) => {
    const totalPayoutPrice = price * (ratio / 100);
    const daily = round(totalPayoutPrice / duration / c2p);
    const total = round(daily * duration);
    const e = planNetEconomics({
      price,
      point_per_day: daily,
      duration,
      cryptoToPrice: c2p,
      processorPct,
      affiliatePct,
    });
    const sensitivity: StrategySensitivity[] = [0.75, 1.5, 2].map((multiple) => {
      const at = planNetEconomics({
        price,
        point_per_day: daily,
        duration,
        cryptoToPrice: c2p * multiple,
        processorPct,
        affiliatePct,
      });
      return {
        label: multiple === 0.75 ? "DOGE -25%" : multiple === 1.5 ? "DOGE +50%" : "DOGE +100%",
        priceMultiple: multiple,
        netProfit: round(at.netProfit, 4),
        netMarginPct: round(at.netMarginPct, 4),
      };
    });
    const minWithdrawCovered = minWithdraw <= 0 || total >= minWithdraw;
    const warningsForVariant = variantWarnings(
      e.netProfit,
      e.netMarginPct,
      minMarginPct,
      e.userRoiPct,
      e.breakEvenDays,
      duration,
      sensitivity,
      minWithdrawCovered,
      price
    );
    const score = scoreOf(
      objective,
      e.netMarginPct,
      e.userRoiPct,
      duration,
      e.netProfit,
      minMarginPct,
      sensitivity,
      minWithdrawCovered
    );
    const double = sensitivity.find((s) => s.priceMultiple === 2);
    return {
      id,
      label,
      recommended: false,
      score,
      plan_name: intent.name ?? (intent.version ? `Plan ${intent.version}` : "Plan"),
      version: intent.version ?? "",
      price: round(price, 8),
      point_per_day: daily,
      duration,
      speed: intent.speed ?? "1",
      profit:
        intent.profit ??
        `${e.userRoiPct >= 0 ? "+" : ""}${e.userRoiPct.toFixed(0)}% ROI in ${duration} days`,
      is_default: false,
      payoutToUser: total,
      ownerProfit: round(e.ownerProfit, 8),
      ownerMarginPct: round(e.ownerMarginPct, 4),
      userRoiPct: round(e.userRoiPct, 4),
      breakEvenDays: round(e.breakEvenDays, 4),
      dailyRatePct: round((daily * c2p * 100) / price, 4),
      netProfit: round(e.netProfit, 4),
      netMarginPct: round(e.netMarginPct, 4),
      processorFee: round(e.processorFee, 4),
      affiliateCost: round(e.affiliateCost, 4),
      payoutRatioPct: round(ratio, 2),
      sensitivity,
      minWithdrawCovered,
      rationale: [
        `Pays out ${ratio.toFixed(0)}% of the price: ${total.toFixed(8)} ${cryptoCode} over ${duration} days.`,
        `Net margin ${e.netMarginPct.toFixed(1)}% after ${processorPct}% processor and ${affiliatePct}% affiliate.`,
        `Member ROI ${e.userRoiPct >= 0 ? "+" : ""}${e.userRoiPct.toFixed(1)}%; break-even ${e.breakEvenDays.toFixed(1)} days.`,
        double
          ? `At 2x the current DOGE price, net margin becomes ${double.netMarginPct.toFixed(1)}%.`
          : "DOGE sensitivity unavailable.",
      ],
      assumptions,
      warnings: warningsForVariant,
      understood,
    };
  });

  const best = variants.reduce((a, b) => (b.score > a.score ? b : a), variants[0]);
  for (const variant of variants) variant.recommended = variant.id === best.id;
  warnings.push(...variants.flatMap((v) => v.warnings));
  return {
    variants,
    recommendedId: best.id,
    objective,
    assumptions,
    warnings: [...new Set(warnings)],
    understood: [...new Set(understood)],
  };
}
