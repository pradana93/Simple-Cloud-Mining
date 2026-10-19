export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export function daysBetween(fromDay: string, toDay: string): number {
  const a = Date.parse(`${fromDay}T00:00:00Z`);
  const b = Date.parse(`${toDay}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

// Yesterday continues the run; any longer gap resets to day one. Claiming twice
// on the same day keeps the streak as it is.
export function computeStreak(previous: { day: string; streak: number } | null, today: string): number {
  if (!previous) return 1;
  if (previous.day === today) return previous.streak;
  return daysBetween(previous.day, today) === 1 ? previous.streak + 1 : 1;
}

export function streakMultiplier(streak: number): number {
  return Number((1 + Math.min(Math.max(streak - 1, 0), 6) * 0.05).toFixed(4));
}

export function checkinBonus(base: number, streak: number): number {
  if (!(base > 0)) return 0;
  return Number((base * streakMultiplier(streak)).toFixed(8));
}
