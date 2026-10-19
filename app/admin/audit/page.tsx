import { ScrollText, ShieldCheck } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { auditLabel } from "@/lib/audit";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  created_at: string | null;
};

function detailChips(detail: Record<string, unknown> | null): string[] {
  if (!detail) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(detail)) {
    if (value === null || value === undefined || value === "") continue;
    const text = Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value);
    out.push(`${key}: ${text}`);
  }
  return out.slice(0, 6);
}

export default async function AdminAudit() {
  let rows: AuditRow[] = [];
  let failed = false;
  try {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("admin_audit")
      .select("id,actor_id,actor_name,action,target,detail,ip,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) failed = true;
    rows = (data ?? []) as AuditRow[];
  } catch {
    failed = true;
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Audit log"
        description="Every admin action, newest first. Append-only: entries are never edited or removed from the console."
      />

      {failed && (
        <div className="panel rounded-2xl border-red-500/30 px-5 py-4 text-sm text-slate-200">
          Could not load the audit trail. Reload to try again.
        </div>
      )}

      <section className="panel overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
          <ShieldCheck size={16} className="text-gold-400" />
          <h2 className="font-display text-sm font-semibold text-white">Recent activity</h2>
          <span className="ml-auto font-mono text-xs tabular-nums text-slate-400">{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ScrollText size={22} className="mx-auto text-slate-400" />
            <p className="mt-3 text-sm text-slate-200">Nothing recorded yet</p>
            <p className="mt-1 text-xs text-slate-400">Actions like settings saves, plan edits, payouts, and balance changes land here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {rows.map((r) => (
              <li key={r.id} className="px-6 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium text-white">{auditLabel(r.action)}</p>
                  <time className="font-mono text-xs tabular-nums text-slate-400">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                  </time>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  by <span className="text-slate-300">{r.actor_name ?? r.actor_id ?? "unknown"}</span>
                  {r.target ? <> · target <span className="font-mono text-slate-300">{r.target}</span></> : null}
                </p>
                {detailChips(r.detail).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {detailChips(r.detail).map((c, i) => (
                      <span key={i} className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] tabular-nums text-slate-300">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
