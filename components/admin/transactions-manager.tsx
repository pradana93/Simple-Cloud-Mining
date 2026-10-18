"use client";
import { useMemo, useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Modal } from "@/components/admin/modal";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { cn, formatCrypto } from "@/lib/utils";

export type AdminInvoice = {
  id: number;
  user_id: string | null;
  username: string | null;
  plan_id: number | null;
  amount: number | null;
  status: string | null;
  hash: string | null;
  date: string | null;
};

function variant(s: string | null): "green" | "gold" | "red" | "slate" {
  const v = String(s ?? "").toLowerCase();
  if (["paid", "success"].includes(v)) return "green";
  if (["pending", "waiting", "processing"].includes(v)) return "gold";
  if (["canceled", "cancelled", "failed"].includes(v)) return "red";
  return "slate";
}

export function TransactionsManager({
  rows,
  symbol,
  code,
  decimals,
}: {
  rows: AdminInvoice[];
  symbol: string;
  code: string;
  decimals: number;
}) {
  const { run, busy } = useAdminAction();
  const [canceling, setCanceling] = useState<AdminInvoice | null>(null);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) => (r.username ?? "").toLowerCase().includes(needle) || (r.hash ?? "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const open = useMemo(
    () => rows.reduce((s, r) => s + (["pending", "waiting"].includes((r.status ?? "").toLowerCase()) ? Number(r.amount ?? 0) : 0), 0),
    [rows]
  );

  async function cancel() {
    if (!canceling) return;
    const res = await run("/api/admin/transactions", { id: canceling.id }, { success: "Invoice canceled" });
    if (res.ok) setCanceling(null);
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <AdminPageHeader
          title="Transactions"
          description={
            <>
              {rows.length} invoices · {symbol}
              {formatCrypto(open, decimals)} {code} open
            </>
          }
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by member or hash"
          aria-label="Filter transactions"
          className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25 sm:w-64"
        />
      </div>

      <div className="panel overflow-hidden rounded-3xl">
        {shown.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">
            {rows.length === 0 ? "No invoices yet. They appear here once a buyer starts checkout." : `No invoices match "${q}".`}
          </p>
        ) : (
          <div className="overflow-x-auto px-6 py-2 text-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 pr-4 font-medium">Member</th>
                  <th className="py-3 pr-4 font-medium">Plan</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Reference</th>
                  <th className="py-3 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const v = String(r.status ?? "").toLowerCase();
                  const cancellable = ["pending", "waiting"].includes(v);
                  return (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="py-3 pr-4 text-slate-300">{r.date ? new Date(r.date).toLocaleDateString() : ""}</td>
                      <td className="py-3 pr-4 text-slate-200">{r.username ?? <span className="font-mono text-xs text-slate-500">{String(r.user_id ?? "").slice(0, 8)}</span>}</td>
                      <td className="py-3 pr-4 text-slate-300">{r.plan_id != null ? `#${r.plan_id}` : ""}</td>
                      <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">
                        {r.amount != null ? `${symbol}${formatCrypto(Number(r.amount), decimals)}` : ""}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={variant(r.status)}>{r.status ?? "unknown"}</Badge>
                      </td>
                      <td className="font-mono py-3 pr-4 text-xs text-slate-400">{String(r.hash ?? "").slice(0, 16)}</td>
                      <td className="py-3 pr-4 text-right">
                        {cancellable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCanceling(r)}
                            disabled={busy}
                            className={cn("text-red-300 hover:bg-red-500/10 hover:text-red-200")}
                          >
                            <Ban size={14} /> Cancel
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(canceling)}
        onClose={() => setCanceling(null)}
        title="Cancel invoice"
        description={canceling ? `Invoice #${canceling.id} for ${canceling.username ?? "this member"} will be voided.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCanceling(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={busy}>
              <Ban size={15} /> Cancel invoice
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">The member can start a fresh checkout afterwards.</p>
      </Modal>
    </div>
  );
}
