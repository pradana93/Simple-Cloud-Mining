// Turns a plain-English plan goal into numbers, then solves the missing field.
// The arithmetic always lives here (never in the LLM) so results match the calculator exactly.

import { planEconomics } from "./plan-math";

export const DEFAULT_OWNER_MARGIN = 50;

export type PlanContext = {
  price?: number;
  durationDays?: number;
  pointPerDay?: number;
  currencyCode?: string;
  cryptoCode?: string;
  cryptoToPrice?: number;
  affiliatePct?: number;
  processorPct?: number;
  minWithdraw?: number;
  maxWithdraw?: number;
  isEdit?: boolean;
};

export type PlanIntent = {
  price?: number | null;
  durationDays?: number | null;
  dailyRatePct?: number | null;
  dailyYield?: number | null;
  dailyProfit?: number | null;
  userRoiPct?: number | null;
  userMultiple?: number | null;
  payoutRatioPct?: number | null;
  ownerMarginPct?: number | null;
  name?: string | null;
  version?: string | null;
  speed?: string | null;
  profit?: string | null;
  isDefault?: boolean | null;
};

export type PlanProposal = {
  plan_name: string;
  version: string;
  price: number;
  point_per_day: number;
  duration: number;
  speed: string;
  profit: string;
  is_default: boolean;
  payoutToUser: number;
  ownerProfit: number;
  ownerMarginPct: number;
  userRoiPct: number;
  breakEvenDays: number;
  dailyRatePct: number;
  rationale: string[];
  assumptions: string[];
  warnings: string[];
  understood: string[];
};

const round = (n: number, d = 8) => Number(n.toFixed(d));

function toNum(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function firstMatch(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = toNum(m[1]);
      if (n != null) return n;
    }
  }
  return null;
}

const WORDS: Record<string, number> = { double: 2, triple: 3, quadruple: 4, half: 0.5 };

// Deterministic reading of a goal sentence. Only fills what was actually stated.
export function parseGoal(goal: string, context: PlanContext = {}): PlanIntent {
  const text = goal.toLowerCase();
  const intent: PlanIntent = {};

  // Read daily profit before price. Otherwise "$0.10 daily profit" looks like
  // a $0.10 plan price to the generic dollar matcher.
  const dailyProfitPatterns = [
    /(?:\$|usd\s*)?\s*([\d][\d,]*(?:\.\d+)?)\s*(?:usd|dollars?)?\s*(?:daily\s+)?profit\b/,
    /([\d][\d,]*(?:\.\d+)?)\s*(?:usd|dollars?)?\s*(?:per\s*day|daily|a\s*day|\/\s*day)\s*(?:member\s+)?profit\b/,
    /(?:daily\s+(?:member\s+)?profit|(?:member\s+)?profit\s+per\s*day)\D{0,12}?([\d][\d,]*(?:\.\d+)?)/,
    /(?:member\s+)?profit\D{0,12}?([\d][\d,]*(?:\.\d+)?)(?!\s*%)\s*(?:per\s*day|daily|a\s*day|\/\s*day)/,
  ];
  const dailyProfitMatch = dailyProfitPatterns.map((re) => text.match(re)).find(Boolean) ?? null;
  const dailyProfit = dailyProfitMatch ? toNum(dailyProfitMatch[1]) : null;
  if (dailyProfit != null) intent.dailyProfit = dailyProfit;

  const priceText = dailyProfitMatch ? text.replace(dailyProfitMatch[0], " ") : text;
  const price = firstMatch(priceText, [
    /(?:price|cost|charge|priced(?:\s*at)?|sell(?:ing)?\s+for|go(?:es)?\s+for)\s*[:=]?\s*\$?\s*([\d][\d,]*(?:\.\d+)?)/,
    /\$\s*([\d][\d,]*(?:\.\d+)?)/,
    /(?:for|at)\s*[:=]?\s*\$?\s*([\d][\d,]*(?:\.\d+)?)(?![\d])(?!\s*(?:days?|weeks?|months?|years?|per\s*day|daily|a\s*day))/,
    /\$?\s*([\d][\d,]*(?:\.\d+)?)(?![\d])\s*(?:doge|coins?|usd|dollars?)/,
    /([\d][\d,]*(?:\.\d+)?)(?![\d])\s*(?:plan|tier)/,
    /(?:plan|tier)\s*(?:at|for|is|costs?)?\s*([\d][\d,]*(?:\.\d+)?)/,
  ]);
  if (price != null) intent.price = price;

  const days = firstMatch(text, [/([\d]+(?:\.\d+)?)\s*(?:days?)\b/]);
  const weeks = firstMatch(text, [/([\d]+(?:\.\d+)?)\s*(?:weeks?)\b/]);
  const months = firstMatch(text, [/([\d]+(?:\.\d+)?)\s*(?:months?|mos?)\b/]);
  const years = firstMatch(text, [/([\d]+(?:\.\d+)?)\s*(?:years?|yrs?)\b/]);
  if (days != null) intent.durationDays = Math.round(days);
  else if (weeks != null) intent.durationDays = Math.round(weeks * 7);
  else if (months != null) intent.durationDays = Math.round(months * 30);
  else if (years != null) intent.durationDays = Math.round(years * 365);

  const dailyRate = firstMatch(text, [/([\d]+(?:\.\d+)?)\s*%\s*(?:per\s*day|daily|a\s*day|\/\s*day)/]);
  if (dailyRate != null) intent.dailyRatePct = dailyRate;

  const multipleWord = text.match(/\b(double|triple|quadruple|half)\b/)?.[1];
  const multipleNum = firstMatch(text, [/([\d]+(?:\.\d+)?)\s*x\b/]);
  if (multipleNum != null) intent.userMultiple = multipleNum;
  else if (multipleWord) intent.userMultiple = WORDS[multipleWord];

  if (intent.dailyRatePct == null) {
    const roi = firstMatch(text, [
      /([\d]+(?:\.\d+)?)\s*%\s*(?:roi|return|gain|apy)/,
      /(?:roi|return|gain|profit\s+for\s+(?:the\s+)?(?:miner|user|member))\D{0,12}?([\d]+(?:\.\d+)?)\s*%/,
    ]);
    if (roi != null) intent.userRoiPct = roi;

    const payoutRatio = firstMatch(text, [
      /([\d]+(?:\.\d+)?)\s*%\s*(?:(?:total\s+)?payout|paid\s+out|returned|to\s+members?|of\s+price)/,
      /(?:(?:total\s+)?payout|paid\s+out|returned|members?\s+get|members?\s+receive)\D{0,14}?([\d]+(?:\.\d+)?)\s*%/,
    ]);
    if (payoutRatio != null) intent.payoutRatioPct = payoutRatio;

    const margin = firstMatch(text, [
      /([\d]+(?:\.\d+)?)\s*%\s*(?:margin|for\s+(?:us|me|the\s+house)|ours)/,
      /(?:margin|keep|take|cut|profit\s+margin)\D{0,14}?([\d]+(?:\.\d+)?)\s*%/,
    ]);
    if (margin != null) intent.ownerMarginPct = margin;

    const dailyYield = firstMatch(text, [/([\d]+(?:\.\d+)?)\s*(?:coins?|doge)?\s*(?:per\s*day|daily|a\s*day)/]);
    if (dailyYield != null && intent.userRoiPct == null && intent.ownerMarginPct == null && intent.userMultiple == null) {
      intent.dailyYield = dailyYield;
    }
  }

  const name = goal.match(/(?:called|call\s+it|name\s+it|named|labelled|labeled)\s+["']?([A-Za-z0-9][A-Za-z0-9 ._\-]{1,38})["']?/i);
  if (name) intent.name = name[1].trim().replace(/\s+(for|with|that|which|and)$/i, "").trim();

  const version = goal.match(/\b(?:version|v)\s*([0-9]+(?:\.[0-9]+)*)/i);
  if (version) intent.version = version[1];

  const speed = goal.match(/([0-9.]+\s*(?:kh\/s|mh\/s|gh\/s|th\/s|h\/s|hash(?:es)?\s*\/\s*s))/i);
  if (speed) intent.speed = speed[1].replace(/\s+/g, " ").trim();

  if (/\b(free|default|starter|zero[- ]?cost)\b/.test(text)) intent.isDefault = true;

  if (context.isEdit && context.price != null) {
    const down = firstMatch(text, [/([\d]+(?:\.\d+)?)\s*%\s*(?:cheaper|less|lower|discount)/]);
    const up = firstMatch(text, [/(?:more|higher|expensive|increase|raise)\D{0,8}([\d]+(?:\.\d+)?)\s*%/]);
    if (down != null) intent.price = round(context.price * (1 - down / 100), 8);
    else if (up != null) intent.price = round(context.price * (1 + up / 100), 8);
  }

  return intent;
}

// Keep only the fields the model claimed, coerced to numbers. Anything else is dropped.
export function coerceIntent(raw: unknown): PlanIntent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: PlanIntent = {};
  const numKeys: Array<keyof PlanIntent> = [
    "price",
    "durationDays",
    "dailyRatePct",
    "dailyYield",
    "dailyProfit",
    "userRoiPct",
    "userMultiple",
    "payoutRatioPct",
    "ownerMarginPct",
  ];
  for (const k of numKeys) {
    const v = Number(r[k]);
    if (r[k] !== null && r[k] !== undefined && r[k] !== "" && Number.isFinite(v)) (out[k] as number) = v;
  }
  for (const k of ["name", "version", "speed", "profit"] as const) {
    if (typeof r[k] === "string" && r[k]) out[k] = (r[k] as string).slice(0, 120);
  }
  if (typeof r.isDefault === "boolean") out.isDefault = r.isDefault;
  return out;
}

// Fill the gaps and return a ready-to-use plan, with the reasoning shown to the admin.
export function solvePlan(intent: PlanIntent, context: PlanContext = {}): PlanProposal {
  const assumptions: string[] = [];
  const warnings: string[] = [];
  const understood: string[] = [];
  const code = context.currencyCode ?? "DOGE";
  const cryptoCode = context.cryptoCode ?? "DOGE";
  // price is set in the site price currency; yields credit in the site crypto.
  const c2p = Number(context.cryptoToPrice ?? 1) || 1;

  let price = intent.price ?? null;
  if (price == null && context.price != null) {
    price = context.price;
    if (context.isEdit) assumptions.push("Kept the current price.");
  }
  if (price == null) {
    price = 0;
  } else {
    understood.push(`price ${price} ${code}`);
  }

  let isDefault = intent.isDefault ?? null;
  if (isDefault == null) isDefault = price === 0;
  if (price === 0 && !isDefault) {
    warnings.push("No price was given; leaving it at zero so you can set it yourself.");
  }

  let duration = intent.durationDays ?? null;
  if (duration == null && context.durationDays != null && context.isEdit) {
    duration = context.durationDays;
    assumptions.push("Kept the current duration.");
  }
  if (duration == null || duration < 1) {
    duration = 90;
    assumptions.push("Term defaulted to 90 days.");
  } else {
    understood.push(`${duration}-day term`);
  }

  let payout: number | null = null;
  let basis = "";
  if (intent.dailyYield != null) {
    payout = intent.dailyYield * duration;
    basis = `${intent.dailyYield} ${cryptoCode}/day`;
  } else if (intent.dailyProfit != null) {
    payout = price + intent.dailyProfit * duration;
    basis = `${intent.dailyProfit} ${code}/day member profit`;
  } else if (intent.dailyRatePct != null) {
    payout = price * (intent.dailyRatePct / 100) * duration;
    basis = `${intent.dailyRatePct}% of price per day`;
  } else if (intent.userMultiple != null) {
    payout = price * intent.userMultiple;
    basis = `${intent.userMultiple}x the price`;
  } else if (intent.userRoiPct != null) {
    payout = price * (1 + intent.userRoiPct / 100);
    basis = `${intent.userRoiPct}% return`;
  } else if (intent.payoutRatioPct != null) {
    payout = price * (intent.payoutRatioPct / 100);
    basis = `${intent.payoutRatioPct}% of price paid out`;
  } else if (intent.ownerMarginPct != null) {
    payout = price * (1 - intent.ownerMarginPct / 100);
    basis = `${intent.ownerMarginPct}% owner margin`;
  } else {
    payout = price * (1 - DEFAULT_OWNER_MARGIN / 100);
    assumptions.push(`No payout target given; kept a ${DEFAULT_OWNER_MARGIN}% owner margin.`);
  }
  if (basis) understood.push(basis);

  const dailyPrice = duration > 0 ? round(Math.max(0, payout) / duration, 8) : 0;
  const daily = round(dailyPrice / c2p);
  const totalPayout = round(daily * duration);
  const e = planEconomics({ price, point_per_day: daily, duration, cryptoToPrice: c2p });

  if (price <= 0 && !isDefault) warnings.push("Price is zero but this is not marked as the free plan.");
  if (price > 0 && e.ownerProfit < 0) {
    warnings.push(`This pays out more than it charges: the house loses ${Math.abs(e.ownerProfit).toFixed(2)} ${code} per sale.`);
  }
  if (e.ownerMarginPct > 90 && price > 0) warnings.push("Owner margin is above 90%; members barely earn anything.");
  if (price > 0 && dailyPrice > price) warnings.push("A single day pays out more than the plan costs.");
  if (price > 0 && e.breakEvenDays > 0 && e.breakEvenDays > duration) {
    warnings.push("Members would not recover the price inside the term.");
  }

  const plan_name =
    intent.name ??
    (isDefault ? "Free Plan" : intent.version ? `Plan ${intent.version}` : "");
  const profit =
    intent.profit ??
    (intent.userMultiple != null
      ? `Up to ${intent.userMultiple}x`
      : price > 0
        ? `${e.userRoiPct >= 0 ? "+" : ""}${e.userRoiPct.toFixed(0)}% ROI in ${duration} days`
        : "Free starter plan");

  const rationale = [
    `Price ${price} ${code}, term ${duration} days.`,
    `Credits ${daily.toFixed(8)} ${cryptoCode}/day (${round(daily * 1440, 8)}/min) for a total of ${totalPayout.toFixed(8)} ${cryptoCode}.`,
    price > 0
      ? `House keeps ${e.ownerProfit.toFixed(2)} ${code} per sale (${e.ownerMarginPct.toFixed(1)}% margin).`
      : "Free plan: no revenue, used to on-board members.",
  ];

  return {
    plan_name,
    version: intent.version ?? "",
    price: round(price, 8),
    point_per_day: daily,
    duration,
    speed: intent.speed ?? "1",
    profit,
    is_default: isDefault,
    payoutToUser: totalPayout,
    ownerProfit: round(e.ownerProfit, 8),
    ownerMarginPct: round(e.ownerMarginPct, 4),
    userRoiPct: round(e.userRoiPct, 4),
    breakEvenDays: round(e.breakEvenDays, 4),
    dailyRatePct: price > 0 ? round((daily / price) * 100, 4) : 0,
    rationale,
    assumptions,
    warnings,
    understood,
  };
}
