import Link from "next/link";
import {
  ArrowUpRight,
  Gauge,
  History,
  Pickaxe,
  Plus,
  Wallet,
  WalletMinimal,
} from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCachedSettings } from "@/lib/catalog";
import { totalMiningRate } from "@/lib/mining";
import { formatCrypto } from "@/lib/utils";
import { accrueOwnPlans } from "@/lib/accrue-user";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type ActiveRow = {
  id: number;
  expire_date: string | null;
  created_at: string;
  plan: { plan_name: string; version: string | null; earning_rate: number | null } | Array<{ plan_name: string; version: string | null; earning_rate: number | null }>;
};

function planOf(r: ActiveRow) {
  return Array.isArray(r.plan) ? r.plan[0] : r.plan;
}

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gold-500/15 text-gold-300">
          <Wallet size={28} />
        </span>
        <h1 className="font-display mt-6 text-3xl font-bold text-white">Your console awaits</h1>
        <p className="mt-3 text-slate-400">Sign in to monitor rigs, earnings and payouts.</p>
        <div className="mt-7 flex justify-center gap-3">
          <Link href="/login" className="inline-flex h-11 items-center rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-6 font-display text-sm font-bold text-ink-950">
            Sign in
          </Link>
          <Link href="/register" className="glass inline-flex h-11 items-center rounded-xl px-6 font-display text-sm font-semibold text-white">
            Create account
          </Link>
        </div>
      </div>
    );
  }
  await accrueOwnPlans(supabase, userId);
  const s = await getCachedSettings();
  type ProfileLite = { balance: number; username: string };
  let profile: ProfileLite | null = null;
  let activePlans: ActiveRow[] = [];
  let paidPlans: Array<{ id: number; plan_name: string; price: number; version: string | null; point_per_day: number | null; duration: number }> = [];
  try {
    const [p, a, pp] = await Promise.all([
      supabase.from("profiles").select("balance,username").eq("id", userId).maybeSingle(),
      supabase.from("user_plan_history").select("id,expire_date,created_at,plan:plans(plan_name,version,earning_rate)").eq("user_id", userId).eq("status", "active"),
      supabase.from("plans").select("id,plan_name,price,version,point_per_day,duration").order("price"),
    ]);
    profile = ((p as { data: ProfileLite | null }).data ?? null);
    activePlans = (((a as { data: unknown }).data ?? []) as ActiveRow[]);
    paidPlans = ((((pp as { data: unknown }).data ?? []) as typeof paidPlans)).filter((x) => Number(x.price) > 0);
  } catch {
    // render with empty state
  }
  const rate = totalMiningRate(activePlans.map((r) => ({ earning_rate: planOf(r)?.earning_rate ?? null })));
  const balance = Number(profile?.balance ?? 0);

  return (
    <div className="space-y-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold-400">Mining console</p>
          <h1 className="font-display mt-1 text-3xl font-bold text-white sm:text-4xl">
            {profile?.username ? `Hey, ${profile.username} ⚡` : "Dashboard"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/account" className="glass inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-slate-200 hover:border-gold-500/40">
            <History size={15} /> History
          </Link>
          <Link href="/withdrawal" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-4 font-display text-sm font-bold text-ink-950">
            <WalletMinimal size={15} /> Withdraw
          </Link>
        </div>
      </div>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="gold-ring relative overflow-hidden rounded-3xl bg-gradient-to-b from-gold-500/[0.14] to-ink-900 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-300">Balance</p>
          <p className="font-display mt-2 text-3xl font-bold text-white">
            {formatCrypto(balance, s.currency_decimals)}
          </p>
          <p className="mt-1 text-sm text-slate-400">{s.currency_code} · withdrawable</p>
        </div>
        <div className="glass rounded-3xl p-6">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Gauge size={13} className="text-sky-400" /> Live hashrate
          </p>
          <p className="font-display mt-2 text-3xl font-bold text-white">{formatCrypto(rate, 8)}</p>
          <p className="mt-1 text-sm text-slate-400">per minute across {activePlans.length} rig{activePlans.length === 1 ? "" : "s"}</p>
        </div>
        <div className="glass rounded-3xl p-6">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Pickaxe size={13} className="text-emerald-400" /> Active rigs
          </p>
          <p className="font-display mt-2 text-3xl font-bold text-white">{activePlans.length}</p>
          <p className="mt-1 text-sm text-slate-400">contracts hashing now</p>
        </div>
      </div>

      {/* RIGS */}
      <section>
        <h2 className="font-display mb-4 text-xl font-bold text-white">Active rigs</h2>
        {activePlans.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-slate-300">No rigs hashing yet.</p>
            <p className="mt-1 text-sm text-slate-500">Claim the free plan or deploy a paid miner below.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activePlans.map((r) => {
              const p = planOf(r);
              return (
                <div key={r.id} className="glass card-hover rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                        <Pickaxe size={20} />
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulseGlow rounded-full bg-emerald-400" />
                      </span>
                      <div>
                        <p className="font-display font-bold text-white">{p?.plan_name ?? "Miner"} {p?.version ?? ""}</p>
                        <p className="text-xs text-slate-500">Expires {r.expire_date ? new Date(r.expire_date).toLocaleDateString() : "never"}</p>
                      </div>
                    </div>
                    <Badge variant="green">Hashing</Badge>
                  </div>
                  {/* earning bar */}
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full w-full origin-left animate-pulse rounded-full bg-gradient-to-r from-emerald-400 to-gold-400" />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">≈ {formatCrypto(Number(p?.earning_rate ?? 0), 8)}/min → balance</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* UPGRADE */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white">Deploy more power</h2>
          <Link href="/#plans" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-300 hover:text-gold-400">
            Compare all <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {paidPlans.map((p) => (
            <div key={p.id} className="glass card-hover flex flex-col rounded-2xl p-5">
              <p className="font-display font-bold text-white">{p.plan_name}</p>
              <p className="mt-1 font-display text-2xl font-bold text-gold-300">
                {formatCrypto(Number(p.price), s.currency_decimals)} <span className="text-xs text-slate-500">{s.currency_code}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">+{formatCrypto(Number(p.point_per_day ?? 0), s.currency_decimals)}/day · {p.duration}d</p>
              <Link
                href={`/purchase/${p.id}`}
                className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-700 font-display text-sm font-bold text-white transition-colors hover:border-gold-500/60"
              >
                <Plus size={15} /> Deploy
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
