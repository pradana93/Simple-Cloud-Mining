import type { UserPlan } from "./types";
import { addDays } from "./utils";

/**
 * Port of Users_model::updateUserBalance() from CodeIgniter.
 * Legacy semantics: earning_rate is credited per minute.
 * earnings = secondsElapsed * (earning_rate / 60)
 */
export function accrueForPlan(
  plan: Pick<UserPlan, "expire_date" | "last_sum" | "created_at"> & {
    earning_rate: number | null;
  },
  now = new Date()
): { earnings: number; expired: boolean } {
  if (
    plan.expire_date &&
    new Date(plan.expire_date).getTime() <= now.getTime()
  ) {
    return { earnings: 0, expired: true };
  }
  const rate = Number(plan.earning_rate ?? 0);
  if (!rate) return { earnings: 0, expired: false };
  const last = plan.last_sum
    ? new Date(plan.last_sum).getTime()
    : new Date(plan.created_at).getTime();
  const seconds = Math.max(0, Math.floor(now.getTime() / 1000 - last / 1000));
  return { earnings: seconds * (rate / 60), expired: false };
}

export function expirationForPlan(durationDays: number, from = new Date()): Date {
  return addDays(from, durationDays);
}

export function affiliateCommission(
  amount: number,
  affRatePercent: number
): number {
  return Number(((amount * affRatePercent) / 100).toFixed(8));
}

export function totalMiningRate(
  plans: Array<{ earning_rate: number | null }>
): number {
  return plans.reduce((s, p) => s + Number(p.earning_rate ?? 0), 0);
}
