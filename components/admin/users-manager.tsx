"use client";
import { useMemo, useState } from "react";
import { Coins, KeyRound, Pickaxe, Search, ShieldCheck, ShieldMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/admin/modal";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { cn, formatCrypto } from "@/lib/utils";

export type AdminMember = {
  id: string;
  username: string | null;
  email: string | null;
  balance: number | null;
  is_admin: boolean | null;
  created_at: string | null;
  rigs: number;
};

export type PlanOption = { id: number; plan_name: string; version: string | null; duration: number };

export function UsersManager({
  members,
  plans,
  symbol,
  code,
  decimals,
  currentUserId,
}: {
  members: AdminMember[];
  plans: PlanOption[];
  symbol: string;
  code: string;
  decimals: number;
  currentUserId: string;
}) {
  const { run, busy } = useAdminAction();
  const [q, setQ] = useState("");
  const [grantFor, setGrantFor] = useState<AdminMember | null>(null);
  const [balanceFor, setBalanceFor] = useState<AdminMember | null>(null);
  const [grantPlan, setGrantPlan] = useState<string>(plans[0] ? String(plans[0].id) : "");
  const [grantDays, setGrantDays] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"add" | "set">("add");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(
      (m) => (m.username ?? "").toLowerCase().includes(needle) || (m.email ?? "").toLowerCase().includes(needle)
    );
  }, [members, q]);

  function openGrant(m: AdminMember) {
    const first = plans[0];
    setGrantFor(m);
    setGrantPlan(first ? String(first.id) : "");
    setGrantDays(first ? String(first.duration) : "");
  }
  function openBalance(m: AdminMember) {
    setBalanceFor(m);
    setAmount("");
    setMode("add");
  }
  function onPlanChange(id: string) {
    setGrantPlan(id);
    const p = plans.find((x) => String(x.id) === id);
    if (p) setGrantDays(String(p.duration));
  }

  async function grant() {
    if (!grantFor) return;
    const res = await run(
      "/api/admin/users",
      { action: "grant", userId: grantFor.id, planId: Number(grantPlan), durationDays: grantDays === "" ? undefined : Number(grantDays) },
      { success: "Plan granted" }
    );
    if (res.ok) setGrantFor(null);
  }
  async function adjustBalance() {
    if (!balanceFor) return;
    const res = await run(
      "/api/admin/users",
      { action: "balance", userId: balanceFor.id, amount: Number(amount), mode },
      { success: "Balance updated" }
    );
    if (res.ok) setBalanceFor(null);
  }
  const toggleRole = (m: AdminMember) =>
    run("/api/admin/users", { action: "role", userId: m.id, isAdmin: !m.is_admin }, { success: "Role updated" });

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Members</h1>
          <p className="text-xs text-slate-400">{members.length} accounts · grant plans, adjust balances, manage access</p>
        </div>
        <label className="relative block w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search members" />
        </label>
      </div>

      <div className="panel overflow-hidden rounded-3xl">
        {shown.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">
            {members.length === 0 ? "No members yet. Accounts appear here after signup." : `No members match "${q}".`}
          </p>
        ) : (
          <div className="overflow-x-auto px-6 py-2 text-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-3 pr-4 font-medium">Member</th>
                  <th className="py-3 pr-4 font-medium">Balance</th>
                  <th className="py-3 pr-4 font-medium">Rigs</th>
                  <th className="py-3 pr-4 font-medium">Role</th>
                  <th className="py-3 pr-4 font-medium">Joined</th>
                  <th className="py-3 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className="border-t border-white/5">
                    <td className="py-3 pr-4">
                      <span className="font-medium text-white">{m.username ?? "unknown"}</span>
                      <span className="block text-xs text-slate-400">{m.email ?? ""}</span>
                    </td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-emerald-300">
                      {symbol}
                      {formatCrypto(Number(m.balance ?? 0), decimals)}
                    </td>
                    <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">{m.rigs}</td>
                    <td className="py-3 pr-4">
                      {m.is_admin ? <Badge variant="gold">admin</Badge> : <Badge variant="slate">member</Badge>}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openGrant(m)} disabled={plans.length === 0}>
                          <Pickaxe size={14} /> Grant plan
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openBalance(m)}>
                          <Coins size={14} /> Balance
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRole(m)}
                          disabled={busy || (m.id === currentUserId && Boolean(m.is_admin))}
                          title={m.id === currentUserId ? "You cannot remove your own admin access" : undefined}
                          aria-label={m.is_admin ? `Remove admin from ${m.username}` : `Make ${m.username} admin`}
                          className={cn("gap-1.5", m.is_admin ? "text-red-300 hover:bg-red-500/10" : "text-slate-300")}
                        >
                          {m.is_admin ? <ShieldMinus size={14} /> : <ShieldCheck size={14} />}
                          {m.is_admin ? "Demote" : "Promote"}
                        </Button>
                        <ResetPasswordButton userId={m.id} username={m.username ?? "member"} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(grantFor)}
        onClose={() => setGrantFor(null)}
        title="Grant a plan"
        description={grantFor ? `Issues a running rig to ${grantFor.username ?? "this member"}. No payment is taken.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGrantFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={grant} disabled={busy || !grantPlan}>
              <Pickaxe size={15} /> Grant plan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="g-plan">Plan</Label>
            <select
              id="g-plan"
              value={grantPlan}
              onChange={(e) => onPlanChange(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plan_name}
                  {p.version ? ` · ${p.version}` : ""} ({p.duration}d)
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="g-days">Runs for (days)</Label>
            <Input id="g-days" type="number" min={1} step={1} value={grantDays} onChange={(e) => setGrantDays(e.target.value)} />
            <p className="mt-1.5 text-xs text-slate-400">Defaults to the plan duration. The rig credits yield to their balance until it expires.</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(balanceFor)}
        onClose={() => setBalanceFor(null)}
        title="Adjust balance"
        description={balanceFor ? `${balanceFor.username ?? "Member"} currently holds ${symbol}${formatCrypto(Number(balanceFor.balance ?? 0), decimals)} ${code}.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBalanceFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={adjustBalance} disabled={busy || amount === ""}>
              <Coins size={15} /> Apply
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Adjustment mode" className="inline-flex rounded-xl border border-slate-700 p-1">
            {(["add", "set"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={mode === v}
                onClick={() => setMode(v)}
                className={cn(
                  "tap min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  mode === v ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
                )}
              >
                {v === "add" ? "Add / subtract" : "Set to"}
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="b-amount">Amount ({code})</Label>
            <Input
              id="b-amount"
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={mode === "add" ? "e.g. 500 or -50" : "e.g. 0"}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Use a negative value to subtract. Balances never go below zero.
            </p>
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <KeyRound size={13} className="text-gold-400" /> Forgot a password? Use the reset button on the member row.
          </p>
        </div>
      </Modal>
    </div>
  );
}
