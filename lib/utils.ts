import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCrypto(value: number | string, decimals = 8): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return (0).toFixed(decimals);
  return n.toFixed(decimals);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
