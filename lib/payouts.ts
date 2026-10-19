export type WithdrawalLike = {
  id: number;
  amount: number;
  created_at: string;
  status?: string | null;
};

const SETTLED = new Set(["SUCCESS", "CANCELED"]);

export function isSettled(status: string | null | undefined): boolean {
  return SETTLED.has((status ?? "").toUpperCase());
}

export function isPending(status: string | null | undefined): boolean {
  return (status ?? "").toUpperCase() === "PENDING";
}

// A ceiling of zero means "no ceiling".
export function withinCeiling(amount: number, ceiling: number): boolean {
  return Number.isFinite(amount) && amount > 0 && (ceiling <= 0 || amount <= ceiling);
}

// Oldest pending requests first, so a queue drains in the order it was created.
export function selectAutoPayoutBatch<T extends WithdrawalLike>(rows: T[], ceiling: number, max: number): T[] {
  return rows
    .filter((row) => isPending(row.status) && withinCeiling(Number(row.amount), ceiling))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, Math.max(0, max));
}

export function isStale(createdAt: string, now: Date, staleMs: number): boolean {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t > staleMs;
}
