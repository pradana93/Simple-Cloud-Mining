import Link from "next/link";
import { cookies, headers } from "next/headers";
import { History, Plus, WalletMinimal } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCachedSettings } from "@/lib/catalog";
import { totalMiningRate } from "@/lib/mining";
import { planEconomics } from "@/lib/plan-math";
import { cn, formatCrypto, formatDuration } from "@/lib/utils";
import { accrueOwnPlans, type AccrualRow } from "@/lib/accrue-user";
import { ensureProfile } from "@/lib/ensure-profile";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { LiveBalance } from "@/components/motion/live-balance";
import { ProjectionChart } from "@/components/dashboard/projection-chart";
import { RigReadout, type RigView } from "@/components/dashboard/rig-readout";
import { ActivityFeed, type ActivityItem } from "@/components/dashboard/activity-feed";
import { AffiliatePanel } from "@/components/dashboard/affiliate-panel";

export const dynamic = "force-dynamic";

type PlanMeta = {
  plan_name: string;
  version: string | null;
  earning_rate: number | null;
  price: number;
  duration: number;
};
type HistoryRow = {
  id: number;
  status: string;
  created_at: string;
  expire_date: string | null;
  last_sum: string | null;
  plan: PlanMeta | PlanMeta[] | null;
};
type PaidPlan = { id: number; plan_name: string; price: number; point_per_day: number | null; duration: number };

function planOf(row: { plan: PlanMeta | PlanMeta[] | null }): PlanMeta | null {
  return Array.isArray(row.plan) ? row.plan[0] : row.plan;
}

function txVariant(status: string): "green" | "gold" | "red" | "slate" {
  const v = status.toLowerCase();
  if (v === "paid") return "green";
  if (v === "pending" || v === "waiting") return "gold";
  if (v === "canceled") return "red";
  return "slate";
}

function breakEvenLabel(days: number) {
  if (days <= 0) return "not applicable";
  if (days < 1) return "under a day";
  const d = Math.ceil(days);
  return `${d} day${d === 1 ? "" : "s"}`;
}

function Readout({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 border-t-2 border-gold-500/60 pt-3">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="font-mono mt-1.5 break-words text-xl font-medium tabular-nums text-white sm:text-2xl">{children}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  let userId: string | null = null;
  let userEmail: string | null = null;
  let usernameMeta: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    userEmail = user?.email ?? null;
    usernameMeta = ((user as { user_metadata?: { username?: string } } | null)?.user_metadata?.username ?? null);
  } catch {
    userId = null;
  }
  if (!userId) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center sm:py-16">
        <h1 className="font-display mt-6 text-3xl font-bold text-white">Your console awaits</h1>
        <p className="mt-3 text-slate-400">Sign in to monitor rigs, earnings and payouts.</p>
        <div className="mt-7 flex justify-center gap-3">
          <Link href="/login" className="tap inline-flex h-11 items-center rounded-xl bg-gold-500 px-6 font-display text-sm font-bold text-ink-950 hover:bg-gold-400">
            Sign in
          </Link>
          <Link href="/register" className="tap panel inline-flex h-11 items-center rounded-xl px-6 font-display text-sm font-semibold text-white hover:border-gold-500/40">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const refCookie = cookies().get("ref")?.value ?? null;
  const s = await getCachedSettings();
  const now = Date.now();
  const historySelect = "id,status,created_at,expire_date,last_sum,plan:plans(plan_name,version,earning_rate,price,duration)";

  type ProfileLite = { balance: number; username: string; reference_user_id: string | null; unique_id: number; affiliate_earns: number; affiliate_paid: number };
  let profile: ProfileLite | null = null;
  let rows: HistoryRow[] = [];
  let referrals: Array<{ username: string | null; created_at: string }> = [];
  let deposits: Array<{ amount: number; status: string; created_at: string }> = [];
  let withdrawals: Array<{ amount: number; status: string; created_at: string }> = [];
  let affiliates: Array<{ amount: number; status: string; date: string }> = [];
  let txns: Array<{ hash: string | null; amount: number; paid_amount: number | null; status: string; date: string; plan_id: number }> = [];
  let paidPlans: PaidPlan[] = [];
  let planNames = new Map<number, string>();

  try {
    const [p, ph, r, dep, wd, aff, tx, pp] = await Promise.all([
      supabase.from("profiles").select("balance,username,reference_user_id,unique_id,affiliate_earns,affiliate_paid").eq("id", userId).maybeSingle(),
      supabase.from("user_plan_history").select(historySelect).eq("user_id", userId),
      supabase.from("profiles").select("username,created_at").eq("reference_user_id", userId).order("created_at", { ascending: false }),
      supabase.from("user_deposits").select("amount,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
      supabase.from("user_withdrawal").select("amount,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
      supabase.from("affiliate_history").select("amount,status,date").eq("user_id", userId).order("date", { ascending: false }).limit(12),
      supabase.from("transactions_history").select("hash,amount,paid_amount,status,date,plan_id").eq("user_id", userId).order("date", { ascending: false }).limit(20),
      supabase.from("plans").select("id,plan_name,price,point_per_day,duration").order("price"),
    ]);
    profile = ((p as { data: ProfileLite | null }).data ?? null);
    rows = (((ph as { data: unknown }).data ?? []) as HistoryRow[]);
    referrals = (((r as { data: unknown }).data ?? []) as Array<{ username: string | null; created_at: string }>);
    deposits = (((dep as { data: unknown }).data ?? []) as typeof deposits);
    withdrawals = (((wd as { data: unknown }).data ?? []) as typeof withdrawals);
    affiliates = (((aff as { data: unknown }).data ?? []) as typeof affiliates);
    txns = (((tx as { data: unknown }).data ?? []) as typeof txns);
    paidPlans = ((((pp as { data: unknown }).data ?? []) as PaidPlan[])).filter((x) => Number(x.price) > 0);
    planNames = new Map(
      (((pp as { data: unknown }).data ?? []) as Array<{ id: number; plan_name: string }>).map(
        (x) => [x.id, x.plan_name] as [number, string]
      )
    );

    // The profiles policy hides other members, so the downline is counted with
    // the service role, scoped to this user's id.
    try {
      const admin = createAdminSupabase();
      const { data: refRows } = await admin
        .from("profiles")
        .select("username,created_at")
        .eq("reference_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12);
      if (refRows) referrals = refRows as typeof referrals;
    } catch {
      // Keep whatever the user-scoped query returned.
    }

    // Bootstrap the profile + free rig only when there is real work to do.
    if (!profile || rows.filter((x) => x.status === "active").length === 0 || (!profile.reference_user_id && refCookie)) {
      await ensureProfile({ userId, email: userEmail, usernameMeta, refUniqueId: refCookie });
      const [p2, ph2] = await Promise.all([
        supabase.from("profiles").select("balance,username,reference_user_id,unique_id,affiliate_earns,affiliate_paid").eq("id", userId).maybeSingle(),
        supabase.from("user_plan_history").select(historySelect).eq("user_id", userId),
      ]);
      profile = ((p2 as { data: ProfileLite | null }).data ?? profile);
      rows = (((ph2 as { data: unknown }).data ?? rows) as HistoryRow[]);
    }
  } catch {
    // render the empty console
  }

  const stored = Number(profile?.balance ?? 0);
  const activeRows = rows.filter(
    (r) => r.status === "active" && (!r.expire_date || new Date(r.expire_date).getTime() > now)
  );
  const { pending } = await accrueOwnPlans(userId, {
    rows: activeRows as unknown as AccrualRow[],
  });
  const rate = totalMiningRate(activeRows.map((r) => ({ earning_rate: planOf(r)?.earning_rate ?? null })));
  const balance = stored + pending;
  const perDay = rate * 1440;

  const earnedFor = (r: HistoryRow) => {
    const ratePerMin = Number(planOf(r)?.earning_rate ?? 0);
    if (ratePerMin <= 0) return 0;
    const start = new Date(r.created_at).getTime();
    const end = r.expire_date ? Math.min(now, new Date(r.expire_date).getTime()) : now;
    return Math.max(0, (end - start) / 60000) * ratePerMin;
  };
  const lifetimeEarned = rows.reduce((sum, r) => sum + earnedFor(r), 0);

  const rigs: RigView[] = activeRows.map((r) => {
    const meta = planOf(r);
    const rigRate = Number(meta?.earning_rate ?? 0);
    const price = Number(meta?.price ?? 0);
    const earned = earnedFor(r);
    const created = new Date(r.created_at).getTime();
    const expires = r.expire_date ? new Date(r.expire_date).getTime() : null;
    const roiPct = price > 0 ? Math.min(999, (earned / price) * 100) : null;
    const expiryPct = expires ? Math.max(0, Math.min(100, ((now - created) / (expires - created)) * 100)) : null;
    const breakEvenMinutes = price > 0 && rigRate > 0 ? Math.max(0, (price - earned) / rigRate) : null;
    return {
      id: r.id,
      name: meta?.plan_name ?? "Miner",
      version: meta?.version ?? null,
      rate: rigRate,
      price,
      earned,
      roiPct,
      expiryPct,
      daysLeft: expires ? (expires - now) / 86_400_000 : null,
      breakEvenMinutes,
      startedAt: r.created_at,
      decimals: s.currency_decimals,
      code: s.currency_code,
    };
  });

  const activity: ActivityItem[] = [
    ...deposits.map((d, i) => ({ id: `d${i}`, kind: "deposit" as const, label: "Deposit received", amount: Number(d.amount), at: d.created_at, status: d.status })),
    ...withdrawals.map((w, i) => ({ id: `w${i}`, kind: "withdrawal" as const, label: "Withdrawal", amount: Number(w.amount), at: w.created_at, status: w.status })),
    ...affiliates.map((a, i) => ({ id: `a${i}`, kind: "affiliate" as const, label: "Affiliate commission", amount: Number(a.amount), at: a.date, status: a.status })),
    ...referrals.map((r, i) => ({ id: `r${i}`, kind: "referral" as const, label: `Referral joined${r.username ? `: ${r.username}` : ""}`, amount: null, at: r.created_at, status: null })),
    ...txns
      .filter((t) => t.status === "paid")
      .map((t, i) => ({ id: `t${i}`, kind: "plan" as const, label: `Deployed ${planNames.get(t.plan_id) ?? "a plan"}`, amount: Number(t.paid_amount ?? t.amount), at: t.date, status: null })),
  ]
    .filter((it) => it.at)
    .sort((a, b) => new Date(b.at as string).getTime() - new Date(a.at as string).getTime())
    .slice(0, 7);

  const openInvoices = txns.filter((t) => t.status !== "paid").slice(0, 5);

  const minWithdraw = Number(s.min_withdraw);
  const nextPayout =
    minWithdraw <= 0 || balance >= minWithdraw
      ? "You can place a withdrawal request now."
      : rate > 0
        ? `About ${formatDuration((minWithdraw - balance) / rate)} until you reach the minimum.`
        : "Deploy hashrate to reach the withdrawal minimum.";

  const paidEcon = paidPlans.map((p) => ({
    p,
    e: planEconomics({ price: p.price, point_per_day: p.point_per_day, duration: p.duration }),
  }));
  let bestId: number | null = null;
  let bestVal = -1;
  for (const x of paidEcon) {
    const v = x.e.price > 0 ? x.e.payoutToUser / x.e.price : 0;
    if (v > bestVal) {
      bestVal = v;
      bestId = x.p.id;
    }
  }

  const referralLink = (() => {
    const h = headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host && host.includes("localhost") ? "http" : "https");
    const base = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || "";
    return `${base}/referral/${profile?.unique_id ?? ""}`;
  })();

  return (
    <div className="space-y-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {profile?.username ? `Hey, ${profile.username}` : "Dashboard"}
        </h1>
        <div className="flex gap-2">
          <Link href="/account" className="tap panel inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-slate-200 hover:border-gold-500/40">
            <History size={15} /> History
          </Link>
          <Link href="/withdrawal" className="tap inline-flex h-11 items-center gap-1.5 rounded-xl bg-gold-500 px-4 font-display text-sm font-bold text-ink-950 hover:bg-gold-400">
            <WalletMinimal size={15} /> Withdraw
          </Link>
        </div>
      </div>

      <Reveal>
        <div className="panel rounded-3xl border-t-2 border-t-gold-500/70 p-6 sm:p-7">
          <div className="grid gap-7 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <p className="text-xs font-medium text-slate-400">Balance</p>
              <p className="font-mono mt-2 text-4xl font-medium tabular-nums text-white sm:text-5xl">
                <LiveBalance value={balance} perMinute={rate} decimals={s.currency_decimals} />
              </p>
              {rate > 0 ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                  +{formatCrypto(rate, 8)} {s.currency_code}/min, credited live
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">{s.currency_code}, withdrawable</p>
              )}
              <p className="mt-3 text-xs text-slate-400">{nextPayout}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-6">
              <Readout label="Live hashrate" hint={`${s.currency_code} per minute`}>
                <CountUp value={rate} decimals={8} />
              </Readout>
              <Readout label="Active rigs" hint="contracts hashing now">
                {activeRows.length}
              </Readout>
              <Readout label="Gross earned" hint="since each rig started">
                <CountUp value={lifetimeEarned} decimals={s.currency_decimals} />
              </Readout>
              <Readout label="Per day" hint={`${s.currency_code} at current rate`}>
                {formatCrypto(perDay, s.currency_decimals)}
              </Readout>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <section className="panel rounded-3xl p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Projected balance</h2>
                <p className="mt-1 text-xs text-slate-400">
                  A straight line at your current rate over 30 days. A projection, not a record of past earnings.
                </p>
              </div>
              <span className="rounded-md bg-gold-500/15 px-2 py-0.5 font-display text-xs font-semibold text-gold-300 ring-1 ring-gold-500/40">
                projection
              </span>
            </div>
            <div className="mt-5">
              <ProjectionChart
                start={balance}
                perDay={perDay}
                decimals={s.currency_decimals}
                target={minWithdraw > balance ? minWithdraw : null}
              />
            </div>
          </section>

          <AffiliatePanel
            count={referrals.length}
            earns={Number(profile?.affiliate_earns ?? 0)}
            paid={Number(profile?.affiliate_paid ?? 0)}
            commissionPct={Number(s.aff_comission)}
            decimals={s.currency_decimals}
            code={s.currency_code}
            referralLink={referralLink}
            invites={referrals}
          />
        </div>
      </Reveal>

      <Reveal>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">Active rigs</h2>
            <Link href="/#plans" className="text-sm font-semibold text-gold-300 hover:text-gold-400">
              Compare all plans
            </Link>
          </div>
          {rigs.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-slate-300">No rigs hashing yet.</p>
              <p className="mt-1 text-sm text-slate-400">Claim the free plan or deploy a paid miner below.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rigs.map((rig) => (
                <RigReadout key={rig.id} rig={rig} symbol={s.currency_symbol} />
              ))}
            </div>
          )}
        </section>
      </Reveal>

      <Reveal>
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <section className="panel rounded-3xl p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">Recent activity</h2>
              <Link href="/account" className="text-xs font-semibold text-gold-300 hover:text-gold-400">
                Full history
              </Link>
            </div>
            <div className="mt-2">
              <ActivityFeed items={activity} decimals={s.currency_decimals} code={s.currency_code} />
            </div>
          </section>

          <section className="panel rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold text-white">Open invoices</h2>
            <p className="mt-1 text-xs text-slate-400">Top-ups waiting to clear.</p>
            {openInvoices.length === 0 ? (
              <p className="py-4 text-sm text-slate-400">No open invoices.</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/5">
                {openInvoices.map((t, i) => (
                  <li key={t.hash ?? i} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <Link href={`/invoice/${t.hash}`} className="font-mono text-gold-300 hover:text-gold-400">
                      {t.hash ? `${t.hash.slice(0, 12)}…` : "invoice"}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-slate-200">
                        {formatCrypto(Number(t.amount), s.currency_decimals)}
                      </span>
                      <Badge variant={txVariant(t.status)}>{t.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Reveal>

      {paidEcon.length > 0 && (
        <Reveal>
          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-white">Deploy more power</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
                  {rate > 0
                    ? `Your rigs are mining ${formatCrypto(perDay, s.currency_decimals)} ${s.currency_code}/day. A plan below stacks on top and pays a fixed rate for its whole term.`
                    : "Your rigs are idle. Deploy a plan to start earning a fixed daily rate for its full term."}
                </p>
              </div>
              <Link href="/#plans" className="text-xs font-semibold text-gold-300 hover:text-gold-400">
                Compare all plans
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {paidEcon.map(({ p, e }) => {
                const isBest = paidEcon.length > 1 && p.id === bestId;
                return (
                  <div
                    key={p.id}
                    className={cn("panel card-hover flex flex-col rounded-2xl p-5", isBest && "ring-1 ring-gold-500/40")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display font-bold text-white">{p.plan_name}</p>
                      {isBest && (
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-display text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
                          Best payback
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-mono text-2xl font-medium tabular-nums text-gold-300">
                      {formatCrypto(Number(p.price), s.currency_decimals)}{" "}
                      <span className="text-xs text-slate-400">{s.currency_code}</span>
                    </p>
                    <p className="mt-1 text-sm text-white">
                      <span className="font-mono text-emerald-300">
                        +{formatCrypto(Number(p.point_per_day ?? 0), s.currency_decimals)} {s.currency_code}
                      </span>{" "}
                      per day
                    </p>
                    <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-400">Pays out over {e.durationDays} days</dt>
                        <dd className="font-mono tabular-nums text-slate-200">
                          {formatCrypto(e.payoutToUser, s.currency_decimals)} {s.currency_code}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-400">Break-even</dt>
                        <dd className="font-mono tabular-nums text-slate-200">{breakEvenLabel(e.breakEvenDays)}</dd>
                      </div>
                    </dl>
                    <Link
                      href={`/purchase/${p.id}`}
                      className="tap mt-5 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gold-500 font-display text-sm font-bold text-ink-950 transition-colors hover:bg-gold-400"
                    >
                      <Plus size={15} /> Deploy
                    </Link>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              Each plan credits a fixed daily rate for its full term, so the total above is set when you deploy.
              Figures use the plan&apos;s published rate.
            </p>
          </section>
        </Reveal>
      )}
    </div>
  );
}
