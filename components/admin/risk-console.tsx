"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, EyeOff, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { cn } from "@/lib/utils";
import type { RiskBand, RiskRow } from "@/lib/risk";

const FILTERS = ["Open", "All"] as const;
type Filter = (typeof FILTERS)[number];

function bandVariant(b: RiskBand): "red" | "gold" | "green" {
  return b === "high" ? "red" : b === "medium" ? "gold" : "green";
}

export function RiskConsole({ rows }: { rows: RiskRow[] }) {
  const { run, busy } = useAdminAction();
  const [filter, setFilter] = useState<Filter>("Open");

  const open = useMemo(() => rows.filter((r) => r.state === "open"), [rows]);
  const counts = useMemo(() => {
    let high = 0;
    let medium = 0;
    for (const r of open) {
      if (r.band === "high") high++;
      else if (r.band === "medium") medium++;
    }
    return { high, medium };
  }, [open]);

  const shown = filter === "Open" ? open : rows;

  function rescan() {
    void run("/api/admin/risk", { action: "rescan" });
  }
  function setState(userId: string, state: string) {
    void run("/api/admin/risk", { action: "state", userId, state });
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <AdminPageHeader
          title="Anti-fraud"
          description={`${open.length} in queue · ${counts.high} high · ${counts.medium} medium`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Filter risk queue" className="flex rounded-xl border border-slate-700 p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "tap min-h-[44px] rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
                  filter === f ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <Button onClick={rescan} disabled={busy}>
            <RefreshCw size={15} /> Rescan now
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="panel rounded-3xl px-6 py-12 text-center">
          <ShieldAlert size={22} className="mx-auto text-slate-400" />
          <p className="mt-3 text-sm text-slate-200">
            {filter === "Open" ? "Nothing is flagged right now." : "No scored accounts yet."}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Run a scan to score every member against the current signals.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.user_id} className="panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/admin/users"
                      className="font-medium text-white underline-offset-4 hover:text-gold-300 hover:underline"
                    >
                      {r.profile?.username ?? "unknown member"}
                    </Link>
                    <Badge variant={bandVariant(r.band)}>{r.band} risk</Badge>
                    {r.state !== "open" && <Badge variant="slate">{r.state}</Badge>}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                    {String(r.user_id).slice(0, 8)} · scored {new Date(r.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold tabular-nums text-white">{Math.round(r.score)}</p>
                  <p className="text-[11px] text-slate-400">risk score</p>
                </div>
              </div>

              {r.reasons.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {r.reasons.map((reason) => (
                    <li key={reason.code} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                      <span className="inline-flex min-w-[36px] justify-center rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-slate-300">
                        +{reason.weight}
                      </span>
                      <span className="font-medium text-slate-200">{reason.label}</span>
                      <span className="text-slate-400">{reason.detail}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {r.state === "open" ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setState(r.user_id, "dismissed")}
                      disabled={busy}
                      title="Hide this account from the open queue for now"
                    >
                      <EyeOff size={14} /> Dismiss
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setState(r.user_id, "cleared")}
                      disabled={busy}
                      className="text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                      title="Reviewed, no action needed"
                    >
                      <Check size={14} /> Clear
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setState(r.user_id, "open")}
                    disabled={busy}
                    className="text-gold-300 hover:bg-gold-500/10 hover:text-gold-200"
                  >
                    <RotateCcw size={14} /> Reopen
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
