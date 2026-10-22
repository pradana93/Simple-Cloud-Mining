import { planEconomics } from "./plan-math";

// Shared helpers for the tier comparison, next-tier preview, and progress badge.
// Every number comes from the plan row and the live rate, never from marketing text.

export type LadderPlan = {
  id: number;
  plan_name: string;
  price: number;
  point_per_day: number | null;
  duration: number;
};

export type LadderRow = LadderPlan & {
  totalReturn: number;
  roiPct: number;
  breakEvenDays: number;
};

export function paidLadder(plans: LadderPlan[], cryptoToPrice: number): LadderRow[] {
  return plans
    .filter((p) => Number(p.price) > 0)
    .sort((a, b) => Number(a.price) - Number(b.price))
    .map((p) => {
      const e = planEconomics({
        price: Number(p.price),
        point_per_day: Number(p.point_per_day ?? 0),
        duration: Number(p.duration),
        cryptoToPrice,
      });
      return {
        ...p,
        totalReturn: e.payoutInPrice,
        roiPct: e.userRoiPct,
        breakEvenDays: e.breakEvenDays,
      };
    });
}

// Highest paid tier the member has activated, and the next one up by price.
export function nextTier(
  ladder: LadderRow[],
  reachedPlanIds: number[]
): { highest: LadderRow | null; next: LadderRow | null } {
  const reached = ladder.filter((row) => reachedPlanIds.includes(row.id));
  const highest = reached.length ? reached[reached.length - 1] : null;
  const next = ladder.find((row) => !highest || Number(row.price) > Number(highest.price)) ?? null;
  return { highest, next };
}
