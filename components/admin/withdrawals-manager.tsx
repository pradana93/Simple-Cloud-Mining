"use client";
import { useMemo, useState } from "react";
import { Check, RotateCcw, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";
import { Modal } from "@/components/admin/modal";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { cn, formatCrypto } from "@/lib/utils";

export type AdminWithdrawal = {
  id: number;
  user_id: string;
  username: string | null;
  amount: number;
  status: string;
  tx: string | null;
  address: string | null;
  created_at: string | null;
  date_paid: string | null;
};

function variant(s: string): "green" | "gold" | "red" | "slate" {
  const v = s.toLowerCase();
  if (["paid", "success"].includes(v)) return "green";
  if (["pending", "waiting", "processing"].includes(v)) return "gold";
  if (["canceled", "cancelled", "failed"].includes(v)) return "red";
  return "slate";
}

const FILTERS = ["Pending", "All", "Paid", "Canceled"] as const;
type Filter = (typeof FILTERS)[number];

function matches(r: AdminWithdrawal, f: Filter) {
  const s = (r.status ?? "").toUpperCase();
  if (f === "All") return true;
  if (f === "Pending") return s === "PENDING" || s === "PROCESSING";
  if (f === "Paid") return s === "SUCCESS";
  return s === "CANCELED";
}

export function WithdrawalsManager({
  rows,
  symbol,
  code,
  decimals,
}: {
  rows: AdminWithdrawal[];
  symbol: string;
  code: string;
  decimals: number;
}) {
  const { run, busy } = useAdminAction();
  const [filter, setFilter] = useState<Filter>("Pending");
  const [approving, setApproving] = useState<AdminWithdrawal | null>(null);
  const [rejecting, setRejecting] = useState<AdminWithdrawal | null>(null);
  const [tx, setTx] = useState("");

  const shown = useMemo(() => rows.filter((r) => matches(r, filter)), [rows, filter]);
  const pendingTotal = useMemo(
    () => rows.filter((r) => matches(r, "Pending")).reduce((s, r) => s + Number(r.amount), 0),
    [rows]
  );
  const money = (v: number) => `${symbol}${formatCrypto(v, decimals)}`;

  async function approve() {
    if (!approving) return;
    const res = await run("/api/admin/withdrawals", { action: "approve", id: approving.id, tx }, { success: "Marked paid" });
    if (res.ok) {
      setApproving(null);
      setTx("");
    }
  }
  async function reject() {
    if (!rejecting) return;
    const res = await run("/api/admin/withdrawals", { action: "reject", id: rejecting.id }, { success: "Rejected and refunded" });
    if (res.ok) setRejecting(null);
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Withdrawals</h1>
          <p className="text-xs text-slate-400">
            {rows.filter((r) => matches(r, "Pending")).length} awaiting review · {money(pendingTotal)} {code} held
          </p>
        </div>
        <div role="tablist" aria-label="Filter withdrawals" className="flex rounded-xl border border-slate-700 p-1">
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
      </div>

      <div className="panel overflow-hidden rounded-3xl">
        {shown.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">Nothing in this queue.</p>
        ) : (
          <div className="overflow-x-auto px-6 py-2 text-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-3 pr-4 font-medium">Member</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 pr-4 font-medium">Payout to</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Requested</th>
                  <th className="py-3 pr-4 font-medium">Paid</th>
                  <th className="py-3 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const settled = ["SUCCESS", "CANCELED"].includes((r.status ?? "").toUpperCase());
                  return (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-white">{r.username ?? "unknown"}</span>
                        <span className="block font-mono text-[11px] text-slate-500">{String(r.user_id).slice(0, 8)}</span>
                      </td>
                      <td className="font-mono py-3 pr-4 tabular-nums text-white">{money(Number(r.amount))}</td>
                      <td className="py-3 pr-4">
                        {r.address ? (
                          <span className="font-mono text-xs text-slate-200" title={r.address}>
                            {r.address.length > 16 ? `${r.address.slice(0, 8)}…${r.address.slice(-6)}` : r.address}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">not recorded</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={variant(r.status)}>{r.status}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-300">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                      </td>
                      <td className="py-3 pr-4 text-slate-300">
                        {r.date_paid ? new Date(r.date_paid).toLocaleDateString() : "Not yet"}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex justify-end gap-2">
                          {settled ? (
                            r.tx ? (
                              <span className="font-mono text-xs text-slate-400">{r.tx}</span>
                            ) : (
                              <span className="text-xs text-slate-500">settled</span>
                            )
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setApproving(r);
                                  setTx("");
                                }}
                                disabled={busy}
                              >
                                <Check size={14} /> Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRejecting(r)}
                                disabled={busy}
                                className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                              >
                                <X size={14} /> Reject
                              </Button>
                            </>
                          )}
                        </div>
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
        open={Boolean(approving)}
        onClose={() => setApproving(null)}
        title="Mark withdrawal paid"
        description={approving ? `Send ${money(Number(approving.amount))} ${code} to ${approving.username ?? "this member"} off-platform, then record the transaction reference here.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={approve} disabled={busy}>
              <Wallet size={15} /> Mark paid
            </Button>
          </>
        }
      >
        {approving?.address && (
          <div className="mb-4 rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">Send to</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="break-all font-mono text-sm text-slate-100">{approving.address}</span>
              <CopyButton text={approving.address} />
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="w-tx">Transaction reference (optional)</Label>
          <Input id="w-tx" value={tx} onChange={(e) => setTx(e.target.value)} placeholder="Blockchain hash or payout id" />
        </div>
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject withdrawal"
        description={rejecting ? `${money(Number(rejecting.amount))} ${code} will be returned to ${rejecting.username ?? "the member"}'s balance.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={reject} disabled={busy}>
              <RotateCcw size={15} /> Reject &amp; refund
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          The request is marked canceled and the held amount is credited straight back. This cannot be undone from here.
        </p>
      </Modal>
    </div>
  );
}
