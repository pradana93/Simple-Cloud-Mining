"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn, formatCrypto } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Entry = { amount: number; tx: string | null; status?: string };
type Row = Entry & { kind: "in" | "out" };

export function PayoutFeed({
  deposits,
  withdrawals,
  currencyCode,
  decimals,
}: {
  deposits: Entry[];
  withdrawals: Entry[];
  currencyCode: string;
  decimals: number;
}) {
  const [tab, setTab] = useState<"all" | "in" | "out">("all");
  const [q, setQ] = useState("");

  const rows: Row[] = useMemo(() => {
    const all: Row[] = [
      ...deposits.map((d) => ({ ...d, kind: "in" as const })),
      ...withdrawals.map((w) => ({ ...w, kind: "out" as const })),
    ];
    return all
      .filter((r) => (tab === "all" ? true : tab === "in" ? r.kind === "in" : r.kind === "out"))
      .filter((r) => !q || (r.tx ?? "").toLowerCase().includes(q.toLowerCase()));
  }, [deposits, withdrawals, tab, q]);

  const tabs: Array<["all" | "in" | "out", string]> = [
    ["all", "All"],
    ["in", "Deposits"],
    ["out", "Withdrawals"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-slate-700 p-1" role="tablist" aria-label="Filter payouts">
          {tabs.map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                tab === v ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative min-w-[12rem] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by transaction id"
            className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
          />
        </label>
      </div>

      <div key={`${tab}:${q}`} className="panel animate-fade-in divide-y divide-white/5 rounded-3xl" aria-live="polite">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">No matching entries.</p>
        ) : (
          rows.map((r, i) => {
            const success = r.kind === "in" || String(r.status).toLowerCase() === "success";
            return (
              <div key={i} className="flex items-center justify-between gap-3 px-6 py-3.5 text-sm">
                <span className="font-mono tabular-nums text-white">
                  {formatCrypto(Number(r.amount), decimals)} <span className="text-slate-400">{currencyCode}</span>
                </span>
                <span className="hidden truncate font-mono text-xs text-slate-400 sm:inline">
                  {r.tx ? `${r.tx.slice(0, 18)}…` : "no tx"}
                </span>
                <Badge variant={success ? "green" : "gold"}>
                  {r.kind === "in" ? "deposit" : r.status ?? "pending"}
                </Badge>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
