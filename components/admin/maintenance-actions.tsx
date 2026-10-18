"use client";
import { useState } from "react";
import { Loader2, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const actions = [
  { id: "accrue", label: "Run accrual now", icon: Zap, blurb: "Credit every active rig up to this moment." },
  { id: "revalidate", label: "Refresh public cache", icon: RefreshCw, blurb: "Drop cached settings, plans, payouts and stats." },
] as const;

export function MaintenanceActions() {
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: id }),
      });
      const j = await res.json();
      push(j.ok ? j.message : j.error ?? "Action failed", j.ok ? "success" : "error");
    } catch {
      push("Action failed", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel rounded-3xl p-6">
      <h2 className="font-display text-lg font-bold text-white">Maintenance</h2>
      <p className="mt-1 text-sm text-slate-400">Run the scheduled jobs on demand.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <div key={a.id} className="rounded-2xl border border-white/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon size={16} className="text-gold-400" /> {a.label}
              </div>
              <p className="mt-1 text-xs text-slate-400">{a.blurb}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => run(a.id)} disabled={busy !== null}>
                {busy === a.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Working
                  </>
                ) : (
                  "Run"
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
