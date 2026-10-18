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
  ownerProfit: number;
  ownerMarginPct: number;
  userRoiPct: number;
  breakEvenDays: number;
};

export function planEconomics(input: {
  price: number | string | null | undefined;
  point_per_day: number | string | null | undefined;
  duration: number | string | null | undefined;
}): PlanEconomics {
  const price = Number(input.price ?? 0);
  const daily = Number(input.point_per_day ?? 0);
  const durationDays = Number(input.duration ?? 0);
  const payoutToUser = daily * durationDays;
  const ownerProfit = price - payoutToUser;
  return {
    price,
    daily,
    durationDays,
    payoutToUser,
    ownerProfit,
    ownerMarginPct: price > 0 ? (ownerProfit / price) * 100 : 0,
    userRoiPct: price > 0 ? ((payoutToUser - price) / price) * 100 : 0,
    breakEvenDays: daily > 0 ? price / daily : 0,
  };
}
