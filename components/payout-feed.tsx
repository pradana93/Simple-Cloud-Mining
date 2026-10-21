"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn, formatCrypto } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatMoney, type MoneyCfg } from "@/lib/money";

type Entry = { amount: number; tx: string | null; status?: string; created_at?: string };
type Row = Entry & { kind: "in" | "out" };

function statusLabel(row: Row): string {
  const status = String(row.status ?? "").toUpperCase();
  if (row.kind === "in") {
    if (status === "SUCCESS") return "deposit confirmed";
    if (status === "PROCESSING") return "deposit processing";
    if (status === "CANCELED") return "deposit canceled";
    return "deposit pending";
  }
  if (status === "SUCCESS") return "paid";
  if (status === "CANCELED") return "canceled";
  if (status === "PROCESSING") return "processing";
  return "pending review";
}

function statusVariant(row: Row): "green" | "gold" | "red" | "slate" {
  const status = String(row.status ?? "").toUpperCase();
  if (row.kind === "in") return status === "SUCCESS" ? "green" : "gold";
  if (status === "SUCCESS") return "green";
  if (status === "CANCELED") return "red";
  if (status === "PROCESSING") return "gold";
  return "slate";
}

export function PayoutFeed({
  deposits,
  withdrawals,
  currencyCode,
  decimals,
  cfg,
}: {
  deposits: Entry[];
  withdrawals: Entry[];
  currencyCode: string;
  decimals: number;
  cfg?: MoneyCfg;
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
                "min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
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
          <div className="p-6 text-center text-sm text-slate-400">
            <p className="font-medium text-slate-200">
              {q
                ? "No entries match that transaction id."
                : tab === "out"
                  ? "No withdrawals yet."
                  : tab === "in"
                    ? "No deposits yet."
                    : "No payout entries yet."}
            </p>
            <p className="mt-1">
              {q
                ? "Clear the filter to see the full feed."
                : "This feed fills after the first confirmed deposit or completed withdrawal."}
            </p>
          </div>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-6 py-3.5 text-sm">
              <span className="min-w-0">
                <span className="block font-mono tabular-nums text-white">
                  {cfg ? (
                    formatMoney(Number(r.amount), cfg, decimals)
                  ) : (
                    <>
                      {formatCrypto(Number(r.amount), decimals)}{" "}
                      <span className="text-slate-400">{currencyCode}</span>
                    </>
                  )}
                </span>
                {r.created_at ? (
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                ) : null}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-right font-mono text-xs text-slate-400 sm:block">
                {r.tx ? r.tx.slice(0, 18) + "..." : "no tx reference"}
              </span>
              <Badge variant={statusVariant(r)}>{statusLabel(r)}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
