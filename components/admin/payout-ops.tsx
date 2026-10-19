"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type PayoutEvent = {
  id: number;
  withdrawal_id: number | null;
  event: string;
  detail: Record<string, unknown> | null;
  created_at: string | null;
};

const TONE: Record<string, string> = {
  auto_sent: "text-emerald-300",
  auto_error: "text-red-300",
  stale_reset: "text-gold-300",
  aged_pending: "text-gold-300",
};

function detailText(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export function PayoutOps({
  autoEnabled,
  ceiling,
  code,
  events,
}: {
  autoEnabled: boolean;
  ceiling: number;
  code: string;
  events: PayoutEvent[];
}) {
  const { push } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/payouts", { method: "POST" });
      const j = await res.json();
      push(j.ok ? j.message : j.error ?? "Payout pass failed", j.ok ? "success" : "error");
      router.refresh();
    } catch {
      push("Payout pass failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
            <Zap size={20} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Auto-payout</h2>
            <p className="text-xs text-slate-400">
              {autoEnabled
                ? `On, sending ${code} requests up to ${ceiling > 0 ? ceiling : "no ceiling"}.`
                : "Off. Requests wait for a manual decision below."}
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={run} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Running
            </>
          ) : (
            <>
              <PlayCircle size={15} /> Run payout pass
            </>
          )}
        </Button>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        One pass resets stalled requests back to pending, flags ones left a week, then sends eligible requests
        {autoEnabled ? "" : " (auto-payout is off, so it only reconciles)"}.
      </p>

      {events.length > 0 && (
        <ul className="mt-4 divide-y divide-white/5 border-t border-white/10">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <span className={cn("font-medium", TONE[e.event] ?? "text-slate-200")}>{e.event.replace(/_/g, " ")}</span>
                {e.withdrawal_id != null && <span className="font-mono text-xs text-slate-400">#{e.withdrawal_id}</span>}
              </span>
              <span className="font-mono text-xs tabular-nums text-slate-400">
                {e.created_at ? new Date(e.created_at).toLocaleString() : ""}
              </span>
              {detailText(e.detail) && <span className="w-full font-mono text-[11px] text-slate-400">{detailText(e.detail)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
