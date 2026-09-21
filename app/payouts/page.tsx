import { Activity, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { getCachedPayouts, getCachedSettings, getCachedStats, type PayoutEntry } from "@/lib/catalog";
import type { SiteSettings } from "@/lib/types";
import { formatCrypto } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const revalidate = 30;

export default async function PayoutsPage() {
  const [s, { deposits, withdrawals }, stats]: [
    SiteSettings,
    { deposits: PayoutEntry[]; withdrawals: PayoutEntry[] },
    { miners: number; totalDeposits: number; totalPaid: number },
  ] = await Promise.all([
    getCachedSettings(),
    getCachedPayouts(),
    getCachedStats(),
  ]);
  return (
    <div className="space-y-8 py-8 sm:py-10">
      <div className="text-center">
        <Badge variant="green"><Activity size={12} /> On-chain ledger</Badge>
        <h1 className="font-display mt-3 text-3xl font-bold text-white sm:text-5xl">Live payouts</h1>
        <p className="mx-auto mt-3 max-w-lg text-slate-400">
          Every deposit and withdrawal, published in real time.{" "}
          <span className="font-semibold text-gold-300">
            {formatCrypto(stats.totalPaid, s.currency_decimals)} {s.currency_code}
          </span>{" "}
          paid out so far.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-white">
            <ArrowDownToLine size={18} className="text-sky-400" /> Latest deposits
          </h2>
          <div className="mt-4">
            {deposits.length === 0 && <Empty text="No deposits yet — be the first." />}
            {deposits.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-white/5 py-3 text-sm last:border-0">
                <span className="font-semibold text-white">
                  {formatCrypto(Number(d.amount), s.currency_decimals)} <span className="text-slate-500">{s.currency_code}</span>
                </span>
                <span className="truncate font-mono text-xs text-slate-500">{d.tx ? `${d.tx.slice(0, 18)}…` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-3xl p-6">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-white">
            <ArrowUpFromLine size={18} className="text-emerald-400" /> Latest withdrawals
          </h2>
          <div className="mt-4">
            {withdrawals.length === 0 && <Empty text="No withdrawals yet." />}
            {withdrawals.map((w, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-white/5 py-3 text-sm last:border-0">
                <span className="font-semibold text-white">
                  {formatCrypto(Number(w.amount), s.currency_decimals)} <span className="text-slate-500">{s.currency_code}</span>
                </span>
                <Badge variant={String(w.status).toLowerCase() === "success" ? "green" : "gold"}>{w.status ?? "—"}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-white/[0.03] p-6 text-center text-sm text-slate-500 ring-1 ring-white/10">{text}</p>;
}
