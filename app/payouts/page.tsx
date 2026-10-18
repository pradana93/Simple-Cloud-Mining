import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { getCachedPayouts, getCachedSettings, getCachedStats } from "@/lib/catalog";
import { formatCrypto } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const revalidate = 30;

export default async function PayoutsPage() {
  const [s, { deposits, withdrawals }, stats] = await Promise.all([
    getCachedSettings(),
    getCachedPayouts(),
    getCachedStats(),
  ]);
  return (
    <div className="space-y-8 py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-white sm:text-5xl">Live payouts</h1>
        <p className="mt-3 text-slate-400">
          Every deposit and withdrawal, published as it lands.{" "}
          <span className="font-semibold text-gold-300">
            {formatCrypto(stats.totalPaid, s.currency_decimals)} {s.currency_code}
          </span>{" "}
          paid out so far.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="panel rounded-3xl p-6">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-white">
            <ArrowDownToLine size={18} className="text-gold-400" /> Latest deposits
          </h2>
          <div className="mt-4">
            {deposits.length === 0 && <Empty text="No deposits recorded yet." />}
            {deposits.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-white/5 py-3 text-sm last:border-0">
                <span className="font-mono tabular-nums text-white">
                  {formatCrypto(Number(d.amount), s.currency_decimals)} <span className="text-slate-400">{s.currency_code}</span>
                </span>
                <span className="truncate font-mono text-xs text-slate-400">{d.tx ? `${d.tx.slice(0, 18)}…` : "no tx"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel rounded-3xl p-6">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-white">
            <ArrowUpFromLine size={18} className="text-emerald-400" /> Latest withdrawals
          </h2>
          <div className="mt-4">
            {withdrawals.length === 0 && <Empty text="No withdrawals recorded yet." />}
            {withdrawals.map((w, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-white/5 py-3 text-sm last:border-0">
                <span className="font-mono tabular-nums text-white">
                  {formatCrypto(Number(w.amount), s.currency_decimals)} <span className="text-slate-400">{s.currency_code}</span>
                </span>
                <Badge variant={String(w.status).toLowerCase() === "success" ? "green" : "gold"}>{w.status ?? "unknown"}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-white/[0.03] p-6 text-center text-sm text-slate-400 ring-1 ring-white/10">{text}</p>;
}
