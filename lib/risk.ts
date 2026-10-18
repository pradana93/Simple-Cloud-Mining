import { createAdminSupabase } from "./supabase/admin";

// Deterministic anti-fraud engine. Pure functions over a loaded snapshot of the
// tables, so scoring is explainable and testable. It never enforces anything by
// itself: it produces a score plus the reasons behind it for an admin to review.
//
// Signals weight multi-account farming hardest, then forged/abused ledger
// activity, then scripted clients. Weights are heuristics, not truths; the
// reasons are what matter to a human reading the queue.

export type RiskBand = "low" | "medium" | "high";
export type RiskReason = { code: string; label: string; weight: number; detail: string };
export type RiskResult = { score: number; band: RiskBand; reasons: RiskReason[] };

export type RiskRow = {
  user_id: string;
  score: number;
  band: RiskBand;
  reasons: RiskReason[];
  state: "open" | "dismissed" | "cleared";
  updated_at: string;
  profile: { id: string; username: string; email: string | null; created_at: string; balance: number } | null;
};

type Profile = { id: string; username: string; email: string | null; reference_user_id: string | null; balance: number; created_at: string };
type Withdrawal = { user_id: string; amount: number; address: string | null; created_at: string; status: string };
type Deposit = { user_id: string; amount: number; tx: string | null; created_at: string; status: string };
type Txn = { user_id: string; status: string; txid: string | null; amount: number };
type Rig = { user_id: string; plan_id: number; status: string };
type Event = { user_id: string; kind: string; ip_hash: string | null; subnet_hash: string | null; detail: Record<string, unknown> | null; created_at: string };

const EVENT_WINDOW_DAYS = 30;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function band(score: number): RiskBand {
  return score >= 60 ? "high" : score >= 30 ? "medium" : "low";
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type Ctx = {
  now: number;
  profiles: Map<string, Profile>;
  withdrawals: Map<string, Withdrawal[]>;
  deposits: Map<string, Deposit[]>;
  txns: Map<string, Txn[]>;
  rigs: Map<string, Rig[]>;
  events: Map<string, Event[]>;
  defaultPlanId: number | null;
  ipToUsers: Map<string, Set<string>>;
  subnetToUsers: Map<string, Set<string>>;
  addressToUsers: Map<string, Set<string>>;
  txToUsers: Map<string, Set<string>>;
};

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

function toSetMap(map: Map<string, Set<string>>, key: string | null, userId: string) {
  if (!key) return;
  const set = map.get(key);
  if (set) set.add(userId);
  else map.set(key, new Set([userId]));
}

async function buildContext(profileLimit = 5000): Promise<Ctx> {
  const admin = createAdminSupabase();
  const since = new Date(Date.now() - EVENT_WINDOW_DAYS * DAY_MS).toISOString();
  const [profRes, wdRes, depRes, txRes, rigRes, planRes, evRes] = await Promise.all([
    admin.from("profiles").select("id,username,email,reference_user_id,balance,created_at").limit(profileLimit),
    admin.from("user_withdrawal").select("user_id,amount,address,created_at,status").limit(100000),
    admin.from("user_deposits").select("user_id,amount,tx,created_at,status").limit(100000),
    admin.from("transactions_history").select("user_id,status,txid,amount").limit(100000),
    admin.from("user_plan_history").select("user_id,plan_id,status").limit(100000),
    admin.from("plans").select("id,is_default,price"),
    admin.from("risk_events").select("user_id,kind,ip_hash,subnet_hash,detail,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50000),
  ]);

  const ctx: Ctx = {
    now: Date.now(),
    profiles: new Map(),
    withdrawals: new Map(),
    deposits: new Map(),
    txns: new Map(),
    rigs: new Map(),
    events: new Map(),
    defaultPlanId: null,
    ipToUsers: new Map(),
    subnetToUsers: new Map(),
    addressToUsers: new Map(),
    txToUsers: new Map(),
  };

  for (const p of (profRes.data ?? []) as Profile[]) ctx.profiles.set(p.id, p);
  for (const w of (wdRes.data ?? []) as Withdrawal[]) {
    push(ctx.withdrawals, w.user_id, w);
    toSetMap(ctx.addressToUsers, w.address, w.user_id);
  }
  for (const d of (depRes.data ?? []) as Deposit[]) push(ctx.deposits, d.user_id, d);
  for (const t of (txRes.data ?? []) as Txn[]) push(ctx.txns, t.user_id, t);
  for (const r of (rigRes.data ?? []) as Rig[]) push(ctx.rigs, r.user_id, r);
  for (const e of (evRes.data ?? []) as Event[]) {
    push(ctx.events, e.user_id, e);
    toSetMap(ctx.ipToUsers, e.ip_hash, e.user_id);
    toSetMap(ctx.subnetToUsers, e.subnet_hash, e.user_id);
  }
  // Deposit txid reverse index (cross-account replay detection).
  for (const d of (depRes.data ?? []) as Deposit[]) toSetMap(ctx.txToUsers, d.tx, d.user_id);

  const plans = (planRes.data ?? []) as Array<{ id: number; is_default: boolean; price: number }>;
  const def = plans.find((p) => p.is_default);
  ctx.defaultPlanId = def ? def.id : null;
  return ctx;
}

function scoreProfile(ctx: Ctx, userId: string): RiskResult {
  const profile = ctx.profiles.get(userId);
  const reasons: RiskReason[] = [];
  if (!profile) return { score: 0, band: "low", reasons };

  const now = ctx.now;
  const withdrawals = ctx.withdrawals.get(userId) ?? [];
  const deposits = ctx.deposits.get(userId) ?? [];
  const txns = ctx.txns.get(userId) ?? [];
  const rigs = ctx.rigs.get(userId) ?? [];
  const events = ctx.events.get(userId) ?? [];
  const myAddresses = withdrawals.map((w) => w.address).filter(Boolean) as string[];
  const myIps = Array.from(new Set(events.map((e) => e.ip_hash).filter(Boolean) as string[]));
  const mySubnets = Array.from(new Set(events.map((e) => e.subnet_hash).filter(Boolean) as string[]));
  const myTxs = Array.from(new Set(deposits.map((d) => d.tx).filter(Boolean) as string[]));

  const othersWith = (map: Map<string, Set<string>>, keys: string[]) => {
    const set = new Set<string>();
    for (const k of keys) {
      const users = map.get(k);
      if (!users) continue;
      users.forEach((u) => {
        if (u !== userId) set.add(u);
      });
    }
    return set;
  };

  // --- Multi-account / referral ---
  const addrMates = othersWith(ctx.addressToUsers, myAddresses);
  if (addrMates.size > 0) {
    reasons.push({ code: "shared_address", label: "Shared payout address", weight: 40, detail: `Same wallet as ${addrMates.size} other account(s).` });
  }

  const ipMates = othersWith(ctx.ipToUsers, myIps);
  if (ipMates.size > 0) {
    reasons.push({ code: "ip_cluster", label: "Shared login IP", weight: 20, detail: `${ipMates.size} other account(s) from the same IP.` });
  }

  const subnetMates = othersWith(ctx.subnetToUsers, mySubnets);
  if (subnetMates.size >= 2) {
    reasons.push({ code: "subnet_cluster", label: "Shared network", weight: 25, detail: `${subnetMates.size} other account(s) on the same subnet.` });
  }

  if (profile.reference_user_id === userId) {
    reasons.push({ code: "self_referral", label: "Self-referral", weight: 50, detail: "Account refers to itself." });
  } else {
    const seen = new Set([userId]);
    let cursor = profile.reference_user_id;
    let cycle = false;
    for (let hop = 0; cursor && hop < 20; hop++) {
      if (seen.has(cursor)) { cycle = true; break; }
      seen.add(cursor);
      cursor = ctx.profiles.get(cursor)?.reference_user_id ?? null;
    }
    if (cycle) reasons.push({ code: "referral_cycle", label: "Referral loop", weight: 50, detail: "Sits inside a circular referral chain." });
  }

  const downline = Array.from(ctx.profiles.values()).filter((p) => p.reference_user_id === userId);
  if (downline.length >= 6) {
    reasons.push({ code: "referral_fanout", label: "Referral fan-out", weight: downline.length >= 10 ? 25 : 20, detail: `Refers ${downline.length} accounts directly.` });
  }
  if (downline.length >= 3) {
    const myNorm = normName(profile.username);
    const norms = new Map<string, number>();
    let similar = 0;
    for (const d of downline) {
      const n = normName(d.username);
      if (n === myNorm || n.startsWith(myNorm) || myNorm.startsWith(n)) similar++;
      norms.set(n, (norms.get(n) ?? 0) + 1);
    }
    norms.forEach((c) => {
      if (c >= 2) similar += c - 1;
    });
    if (similar >= 2) reasons.push({ code: "downline_naming", label: "Similar downline names", weight: 15, detail: `${similar} downline name(s) mirror this account.` });
  }

  const hasPaidRig = rigs.some((r) => ctx.defaultPlanId != null && r.plan_id !== ctx.defaultPlanId);
  const hasDeposited = deposits.some((d) => d.status === "SUCCESS");
  if (!hasDeposited && !hasPaidRig && withdrawals.length > 0) {
    reasons.push({ code: "leech", label: "Free-plan cash-out", weight: 15, detail: "Never deposited, only mines the free plan, still withdraws." });
  }

  // --- Scripted clients ---
  const accruesLastHour = events.filter((e) => e.kind === "accrue" && now - Date.parse(e.created_at) < HOUR_MS).length;
  if (accruesLastHour > 240) {
    reasons.push({ code: "accrual_rate", label: "Accrual hammering", weight: 25, detail: `${accruesLastHour} accrual calls in the last hour.` });
  }
  const loginsLastHour = events.filter((e) => e.kind === "login" && now - Date.parse(e.created_at) < HOUR_MS).length;
  if (loginsLastHour > 30) {
    reasons.push({ code: "login_velocity", label: "Login velocity", weight: 15, detail: `${loginsLastHour} logins in the last hour.` });
  }
  const headless = events.some((e) => e.detail && (e.detail as { headless?: boolean }).headless === true);
  if (headless) {
    reasons.push({ code: "headless_ua", label: "Scripted client", weight: 20, detail: "Requests carried a headless or script user-agent." });
  }

  // --- Deposit integrity ---
  const sharedTx = myTxs.filter((t) => (ctx.txToUsers.get(t)?.size ?? 0) > 1);
  if (sharedTx.length > 0) {
    reasons.push({ code: "txid_reuse", label: "Reused payment txid", weight: 40, detail: `Txid ${sharedTx[0].slice(0, 16)}… appears on more than one account.` });
  } else {
    const counts = new Map<string, number>();
    for (const d of deposits) if (d.tx) counts.set(d.tx, (counts.get(d.tx) ?? 0) + 1);
    if (Array.from(counts.values()).some((c) => c > 1)) {
      reasons.push({ code: "txid_reuse", label: "Duplicate deposit txid", weight: 30, detail: "One txid recorded on more than one deposit." });
    }
  }
  const paidTxids = new Set(txns.filter((t) => t.status === "paid" && t.txid).map((t) => t.txid as string));
  const orphan = deposits.filter((d) => d.status === "SUCCESS" && d.tx && !paidTxids.has(d.tx));
  if (orphan.length > 0) {
    reasons.push({ code: "deposit_without_invoice", label: "Deposit without invoice", weight: 25, detail: `${orphan.length} paid deposit(s) match no paid invoice.` });
  }

  // --- Withdrawal abuse ---
  const wdLastDay = withdrawals.filter((w) => now - Date.parse(w.created_at) < DAY_MS).length;
  if (wdLastDay >= 5) {
    reasons.push({ code: "withdrawal_velocity", label: "Withdrawal burst", weight: wdLastDay >= 10 ? 30 : 20, detail: `${wdLastDay} withdrawals in the last 24h.` });
  }
  const distinctAddr = new Set(myAddresses).size;
  if (distinctAddr >= 3) {
    reasons.push({ code: "address_churn", label: "Address churn", weight: 15, detail: `${distinctAddr} different payout addresses used.` });
  }

  reasons.sort((a, b) => b.weight - a.weight);
  const score = Math.min(100, reasons.reduce((s, r) => s + r.weight, 0));
  return { score, band: band(score), reasons };
}

async function persist(results: Array<{ userId: string; result: RiskResult }>): Promise<void> {
  const admin = createAdminSupabase();
  const rows = results.map(({ userId, result }) => ({
    user_id: userId,
    score: result.score,
    band: result.band,
    reasons: result.reasons,
    updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await admin.from("account_risk").upsert(rows.slice(i, i + 500), { onConflict: "user_id" });
  }
}

// Rescan every member from one in-memory snapshot. Admin-triggered and daily cron.
export async function rescanAll(): Promise<number> {
  const ctx = await buildContext();
  const results = Array.from(ctx.profiles.keys()).map((id) => ({ userId: id, result: scoreProfile(ctx, id) }));
  await persist(results);
  return results.length;
}

// Recompute a single member without touching the rest of the queue.
export async function rescanUser(userId: string): Promise<RiskResult> {
  const ctx = await buildContext();
  const result = scoreProfile(ctx, userId);
  await persist([{ userId, result }]);
  return result;
}

export async function getRiskQueue(onlyOpen = false): Promise<RiskRow[]> {
  try {
    const admin = createAdminSupabase();
    let query = admin
      .from("account_risk")
      .select("user_id,score,band,reasons,state,updated_at")
      .gt("score", 0)
      .order("score", { ascending: false })
      .limit(200);
    if (onlyOpen) query = query.eq("state", "open");
    const { data } = await query;
    const rows = (data ?? []) as Array<Omit<RiskRow, "profile">>;
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.user_id);
    const { data: profs } = await admin.from("profiles").select("id,username,email,created_at,balance").in("id", ids);
    const byId = new Map(((profs ?? []) as RiskRow["profile"][]) .filter(Boolean).map((p) => [p!.id, p]));
    return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
  } catch {
    return [];
  }
}

// Keep the append-only log bounded.
export async function pruneOldEvents(days = 30): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - days * DAY_MS).toISOString();
    await createAdminSupabase().from("risk_events").delete().lt("created_at", cutoff);
  } catch {
    // best effort
  }
}
