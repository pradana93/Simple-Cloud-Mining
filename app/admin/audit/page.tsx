import Link from "next/link";
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

export default async function AdminAudit({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; days?: string }>;
}) {
  const params = await searchParams;
  const action = (params.action ?? "").trim();
  const actor = (params.actor ?? "").trim();
  const days = Math.min(90, Math.max(1, Number(params.days ?? 14) || 14));

  let rows: AuditRow[] = [];
  let failed = false;
  try {
    const admin = createAdminSupabase();
    let query = admin
      .from("admin_audit")
      .select("id,actor_id,actor_name,action,target,detail,ip,created_at")
      .gte("created_at", new Date(Date.now() - days * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);
    if (action) query = query.eq("action", action);
    if (actor) query = query.ilike("actor_name", `%${actor}%`);
    const { data, error } = await query;
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

      <form className="panel grid gap-3 rounded-2xl p-4 sm:grid-cols-[1.4fr_1fr_auto_auto]">
        <label className="text-xs font-medium text-slate-400">
          Action
          <input
            name="action"
            defaultValue={action}
            placeholder="e.g. plan.update"
            className="mt-1 h-10 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-3 font-mono text-sm text-slate-100"
          />
        </label>
        <label className="text-xs font-medium text-slate-400">
          Actor name
          <input
            name="actor"
            defaultValue={actor}
            placeholder="admin username"
            className="mt-1 h-10 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-3 text-sm text-slate-100"
          />
        </label>
        <label className="text-xs font-medium text-slate-400">
          Days
          <input
            name="days"
            type="number"
            min="1"
            max="90"
            defaultValue={days}
            className="mt-1 h-10 w-24 rounded-xl border border-slate-700/80 bg-ink-900/80 px-3 font-mono text-sm text-slate-100"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="tap h-10 rounded-xl bg-gold-500 px-4 text-sm font-bold text-ink-950"
          >
            Filter
          </button>
          <Link href="/admin/audit" className="tap grid h-10 place-items-center rounded-xl border border-slate-700 px-3 text-sm text-slate-300">
            Reset
          </Link>
        </div>
      </form>

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
