import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, RefreshCw } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getSettings } from "@/lib/settings";
import { asNumber, firstRow } from "@/lib/ledger";
import { cn, formatCrypto } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Summary = {
  profiles: number;
  entries: number;
  total_balance: number;
  ledger_balance: number;
  drift: number;
  drift_users: number;
};

type LedgerRow = {
  id: number;
  user_id: string;
  delta: number | string;
  balance_after: number | string;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
  profile: { username: string | null } | Array<{ username: string | null }> | null;
};

type DriftRow = {
  user_id: string;
  username: string | null;
  balance: number | string;
  ledger_balance: number | string;
  drift: number | string;
  entries: number;
  last_entry: string | null;
};

function usernameOf(row: LedgerRow): string {
  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  return profile?.username ?? row.user_id.slice(0, 8);
}

function readable(value: string): string {
  return value.replaceAll("_", " ");
}

export default async function AdminLedger() {
  const settings = await getSettings();
  const decimals = Number(settings.currency_decimals ?? 8);
  const symbol = settings.currency_symbol ?? settings.currency_code ?? "DOGE";

  let summary: Summary | null = null;
  let entries: LedgerRow[] = [];
  let driftRows: DriftRow[] = [];
  let failed = false;

  try {
    const admin = createAdminSupabase();
    const [summaryRes, entriesRes, driftRes] = await Promise.all([
      admin.rpc("ledger_summary"),
      admin
        .from("balance_ledger")
        .select("id,user_id,delta,balance_after,reason,ref_type,ref_id,created_at,profile:profiles(username)")
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("balance_reconciliation")
        .select("user_id,username,balance,ledger_balance,drift,entries,last_entry")
        .limit(500),
    ]);
    if (summaryRes.error || entriesRes.error || driftRes.error) failed = true;
    const row = firstRow<Record<string, unknown>>(summaryRes.data);
    if (row) {
      summary = {
        profiles: asNumber(row.profiles),
        entries: asNumber(row.entries),
        total_balance: asNumber(row.total_balance),
        ledger_balance: asNumber(row.ledger_balance),
        drift: asNumber(row.drift),
        drift_users: asNumber(row.drift_users),
      };
    }
    entries = (entriesRes.data ?? []) as LedgerRow[];
    driftRows = ((driftRes.data ?? []) as DriftRow[])
      .filter((r) => Math.abs(asNumber(r.drift)) > 0.00000001)
      .sort((a, b) => Math.abs(asNumber(b.drift)) - Math.abs(asNumber(a.drift)))
      .slice(0, 12);
  } catch {
    failed = true;
  }

  const clean = Boolean(summary && summary.drift_users === 0 && Math.abs(summary.drift) <= 0.00000001);
  const money = (v: number) => `${symbol}${formatCrypto(v, decimals)}`;

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-start justify-between gap-4 rounded-2xl px-6 py-5">
        <AdminPageHeader
          title="Money ledger"
          description="Append-only balance movements. Every stored balance should match the sum of its ledger rows."
        />
        <Link
          href="/admin/ledger"
          className="tap inline-flex h-11 items-center gap-2 rounded-xl border border-slate-700 px-4 text-xs font-semibold text-slate-200 transition-colors hover:border-gold-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <RefreshCw size={14} /> Refresh
        </Link>
      </div>

      {failed && (
        <div className="panel rounded-2xl border-red-500/30 px-5 py-4 text-sm text-slate-200">
          The ledger is not available yet. Apply migration 020 and run `bootstrap_balance_ledger()`.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Readout label="Stored balances" value={money(summary?.total_balance ?? 0)} />
        <Readout label="Ledger total" value={money(summary?.ledger_balance ?? 0)} />
        <Readout label="Accounts" value={String(summary?.profiles ?? 0)} />
        <Readout label="Ledger rows" value={String(summary?.entries ?? 0)} />
      </div>

      <section className="panel flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4">
        {clean ? (
          <CheckCircle2 size={18} className="text-emerald-300" />
        ) : (
          <AlertTriangle size={18} className="text-red-300" />
        )}
        <div>
          <p className="text-sm font-semibold text-white">
            {clean ? "Balances reconcile" : `${summary?.drift_users ?? 0} account${summary?.drift_users === 1 ? "" : "s"} out of balance`}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Difference {money(summary?.drift ?? 0)}. Drift should stay at zero; a non-zero value means a write bypassed the ledger.
          </p>
        </div>
      </section>

      {driftRows.length > 0 && (
        <section className="panel overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="font-display text-sm font-semibold text-white">Accounts needing review</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 text-right font-semibold">Stored</th>
                  <th className="px-5 py-3 text-right font-semibold">Ledger</th>
                  <th className="px-5 py-3 text-right font-semibold">Drift</th>
                  <th className="px-5 py-3 text-right font-semibold">Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {driftRows.map((r) => (
                  <tr key={r.user_id}>
                    <td className="px-5 py-3 font-medium text-slate-200">{r.username ?? r.user_id.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300">{money(asNumber(r.balance))}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300">{money(asNumber(r.ledger_balance))}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-red-300">{money(asNumber(r.drift))}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-400">{r.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-sm font-semibold text-white">Recent movements</h2>
          <span className="font-mono text-xs tabular-nums text-slate-400">{entries.length}</span>
        </div>
        {entries.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No ledger rows yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {entries.map((row) => {
              const delta = asNumber(row.delta);
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-full", delta < 0 ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300")}>
                    {delta < 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {usernameOf(row)} <span className="font-normal text-slate-400">· {readable(row.reason)}</span>
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {row.ref_type ?? "no ref"}{row.ref_id ? `:${row.ref_id}` : ""} · {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-mono text-sm font-semibold tabular-nums", delta < 0 ? "text-red-300" : "text-emerald-300")}>
                      {delta < 0 ? "-" : "+"}{money(Math.abs(delta))}
                    </p>
                    <p className="font-mono text-[11px] tabular-nums text-slate-500">{money(asNumber(row.balance_after))}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel rounded-2xl px-5 py-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="font-display mt-1.5 text-xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}
