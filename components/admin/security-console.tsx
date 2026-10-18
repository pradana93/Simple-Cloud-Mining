"use client";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { cn } from "@/lib/utils";
import type { SecurityCheck } from "@/lib/security-probe";

export function SecurityConsole({ rows }: { rows: SecurityCheck[] }) {
  const { run, busy } = useAdminAction();
  const failing = rows.filter((r) => !r.passed).length;
  const lastRun = rows.reduce<string | null>((acc, r) => (acc && acc > r.checked_at ? acc : r.checked_at), null);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <AdminPageHeader
          title="Security"
          description={
            rows.length === 0
              ? "No probes recorded yet."
              : `${rows.length - failing} of ${rows.length} checks passing${lastRun ? ` · last run ${new Date(lastRun).toLocaleString()}` : ""}`
          }
        />
        <Button onClick={() => void run("/api/admin/security", { action: "run" })} disabled={busy}>
          <ShieldCheck size={15} /> Run checks
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        Each check drives the public anon key against the database and asserts the operation is still
        refused. A failing row means a grant or policy regressed.
      </p>

      {rows.length === 0 ? (
        <div className="panel rounded-2xl px-6 py-12 text-center">
          <ShieldCheck size={22} className="mx-auto text-slate-400" />
          <p className="mt-3 text-sm text-slate-200">No checks have run yet</p>
          <p className="mt-1 text-xs text-slate-400">Run the checks to record the current posture, or wait for the daily cron.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.check_key} className="panel flex items-start gap-3 rounded-2xl px-5 py-4">
              {r.passed ? (
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
              ) : (
                <ShieldAlert size={18} className="mt-0.5 shrink-0 text-red-300" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("text-sm font-medium", r.passed ? "text-white" : "text-white")}>{r.label}</span>
                  <Badge variant={r.passed ? "green" : "red"}>{r.passed ? "Pass" : "Fail"}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">{r.detail ?? ""}</p>
              </div>
              <span className="hidden shrink-0 text-xs text-slate-400 sm:block">
                {new Date(r.checked_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
