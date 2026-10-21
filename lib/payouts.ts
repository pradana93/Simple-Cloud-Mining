const SETTLED = new Set(["SUCCESS", "CANCELED"]);

export function isSettled(status: string | null | undefined): boolean {
  return SETTLED.has((status ?? "").toUpperCase());
}

export function isPending(status: string | null | undefined): boolean {
  return (status ?? "").toUpperCase() === "PENDING";
}

export function isStale(createdAt: string, now: Date, staleMs: number): boolean {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t > staleMs;
}
