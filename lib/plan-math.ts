// Shared plan economics used by the admin calculator and the plans API.
// `earning_rate` is credited per minute, so daily / 1440 keeps the two in sync.

export function earningRateFromDaily(pointPerDay: number | string | null | undefined): number {
  const daily = Number(pointPerDay ?? 0);
  if (!Number.isFinite(daily) || daily <= 0) return 0;
  return Number((daily / 1440).toFixed(8));
}

export type PlanEconomics = {
  price: number;
  daily: number;
  durationDays: number;
  payoutToUser: number;
  payoutInPrice: number;
  ownerProfit: number;
  ownerMarginPct: number;
  userRoiPct: number;
  breakEvenDays: number;
};

export type PlanNetEconomics = PlanEconomics & {
  processorFee: number;
  affiliateCost: number;
  netProfit: number;
  netMarginPct: number;
};

// Plan prices are set in a stable fiat while yields are credited in the site
// crypto. Pass `cryptoToPrice` (price-currency units per 1 crypto) so profit,
// margin, ROI and break-even all compare in one unit. Omit it only when price
// and yield genuinely share a unit.
export function planEconomics(input: {
  price: number | string | null | undefined;
  point_per_day: number | string | null | undefined;
  duration: number | string | null | undefined;
  cryptoToPrice?: number | string | null | undefined;
}): PlanEconomics {
  const price = Number(input.price ?? 0);
  const daily = Number(input.point_per_day ?? 0);
  const durationDays = Number(input.duration ?? 0);
  const c2p = Number(input.cryptoToPrice ?? 1) || 0;
  const payoutToUser = daily * durationDays;
  const payoutInPrice = payoutToUser * c2p;
  const dailyInPrice = daily * c2p;
  const ownerProfit = price - payoutInPrice;
  return {
    price,
    daily,
    durationDays,
    payoutToUser,
    payoutInPrice,
    ownerProfit,
    ownerMarginPct: price > 0 ? (ownerProfit / price) * 100 : 0,
    userRoiPct: price > 0 ? ((payoutInPrice - price) / price) * 100 : 0,
    breakEvenDays: dailyInPrice > 0 ? price / dailyInPrice : 0,
  };
}

export function planNetEconomics(
  input: {
    price: number | string | null | undefined;
    point_per_day: number | string | null | undefined;
    duration: number | string | null | undefined;
    cryptoToPrice?: number | string | null | undefined;
    processorPct?: number;
    affiliatePct?: number;
  }
): PlanNetEconomics {
  const base = planEconomics(input);
  const processorFee = base.price * (Math.max(0, input.processorPct ?? 0.25) / 100);
  const affiliateCost = base.price * (Math.max(0, input.affiliatePct ?? 0) / 100);
  const netProfit = base.ownerProfit - processorFee - affiliateCost;
  return {
    ...base,
    processorFee,
    affiliateCost,
    netProfit,
    netMarginPct: base.price > 0 ? (netProfit / base.price) * 100 : 0,
  };
}
