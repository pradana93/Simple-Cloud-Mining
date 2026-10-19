export type AllowlistEntry = {
  id: number;
  label: string | null;
  currency: string;
  address: string;
  created_at: string;
};

export const ADDRESS_MIN = 8;
export const ADDRESS_MAX = 200;
export const MAX_ALLOWLIST = 10;
export const LABEL_MAX = 40;

export function validAddress(address: string): boolean {
  const a = (address ?? "").trim();
  return a.length >= ADDRESS_MIN && a.length <= ADDRESS_MAX && !/\s/.test(a);
}

export function findAllowed(
  rows: AllowlistEntry[],
  address: string
): AllowlistEntry | null {
  const a = (address ?? "").trim();
  if (!a) return null;
  return rows.find((r) => (r.address ?? "").trim() === a) ?? null;
}

// An empty list is not locked yet, so nothing is enforced. Once a member saves
// at least one address, only those destinations are permitted.
export function isAllowed(rows: AllowlistEntry[], address: string): boolean {
  return rows.length === 0 || findAllowed(rows, address) !== null;
}

export function shortAddress(address: string, head = 10, tail = 6): string {
  const a = (address ?? "").trim();
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}...${a.slice(-tail)}`;
}
