"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Clock,
  Loader2,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/admin/modal";
import { MfaModal } from "@/components/2fa/mfa-modal";
import { CopyButton } from "@/components/copy-button";
import { LiveBalance } from "@/components/motion/live-balance";
import { useToast } from "@/components/ui/toast";
import { cn, formatCrypto } from "@/lib/utils";
import { findAllowed, isAllowed, shortAddress, type AllowlistEntry } from "@/lib/allowlist";

export type MemberWithdrawal = {
  id: number;
  amount: number;
  status: string;
  tx: string | null;
  address: string | null;
  created_at: string;
  date_paid: string | null;
};

const FILTERS = ["All", "Pending", "Paid", "Canceled"] as const;
type Filter = (typeof FILTERS)[number];

const upper = (s: string) => (s ?? "").toUpperCase();
const isPending = (s: string) => ["PENDING", "PROCESSING", "WAITING"].includes(upper(s));
const isPaid = (s: string) => upper(s) === "SUCCESS";
const isCanceled = (s: string) => upper(s) === "CANCELED";

function badgeFor(s: string): "green" | "gold" | "red" | "slate" {
  if (isPaid(s)) return "green";
  if (isPending(s)) return "gold";
  if (isCanceled(s)) return "red";
  return "slate";
}

function matches(w: MemberWithdrawal, f: Filter) {
  if (f === "All") return true;
  if (f === "Pending") return isPending(w.status);
  if (f === "Paid") return isPaid(w.status);
  return isCanceled(w.status);
}

type NodeState = "done" | "current" | "todo" | "canceled";

function trackerNodes(w: MemberWithdrawal): Array<{ label: string; at: string | null; state: NodeState }> {
  if (isPaid(w.status)) {
    return [
      { label: "Requested", at: w.created_at, state: "done" },
      { label: "Approved", at: w.date_paid, state: "done" },
      { label: "Paid", at: w.date_paid, state: "done" },
    ];
  }
  if (isCanceled(w.status)) {
    return [
      { label: "Requested", at: w.created_at, state: "done" },
      { label: "Canceled", at: w.date_paid, state: "canceled" },
      { label: "Refunded", at: w.date_paid, state: "done" },
    ];
  }
  return [
    { label: "Requested", at: w.created_at, state: "done" },
    { label: "In review", at: null, state: "current" },
    { label: "Payout", at: null, state: "todo" },
  ];
}

const RING: Record<NodeState, string> = {
  done: "ring-emerald-400/40 text-emerald-300",
  current: "ring-gold-500/50 text-gold-300",
  todo: "ring-white/10 text-slate-500",
  canceled: "ring-red-500/40 text-red-300",
};

function NodeIcon({ state }: { state: NodeState }) {
  if (state === "done") return <Check size={14} />;
  if (state === "canceled") return <X size={14} />;
  if (state === "current") return <Clock size={14} />;
  return <span className="block h-1.5 w-1.5 rounded-full bg-slate-500" />;
}

function Tracker({ w }: { w: MemberWithdrawal }) {
  const nodes = trackerNodes(w);
  return (
    <div className="relative">
      <div className="absolute inset-x-6 top-3.5 h-px bg-white/10" aria-hidden />
      <ol className="relative grid grid-cols-3">
        {nodes.map((n) => (
          <li key={n.label} className="flex flex-col items-center text-center">
            <span className={cn("grid h-7 w-7 place-items-center rounded-full bg-ink-900 ring-1", RING[n.state])}>
              <NodeIcon state={n.state} />
            </span>
            <span className="mt-1.5 text-[11px] font-semibold leading-tight text-slate-200">{n.label}</span>
            {n.at && <span className="text-[10px] text-slate-400">{new Date(n.at).toLocaleDateString()}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CheckLine({ ok, touched, children }: { ok: boolean; touched: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {ok ? (
        <Check size={13} className="shrink-0 text-emerald-400" />
      ) : touched ? (
        <AlertCircle size={13} className="shrink-0 text-red-400" />
      ) : (
        <Circle size={13} className="shrink-0 text-slate-500" />
      )}
      <span className={cn(ok ? "text-slate-300" : touched ? "text-red-300" : "text-slate-400")}>{children}</span>
    </li>
  );
}

export function WithdrawConsole({
  balance,
  rate,
  decimals,
  symbol,
  code,
  network,
  min,
  max,
  defaultAddress,
  withdrawals,
  allowlist,
}: {
  balance: number;
  rate: number;
  decimals: number;
  symbol: string;
  code: string;
  network: string;
  min: number;
  max: number;
  defaultAddress: string;
  withdrawals: MemberWithdrawal[];
  allowlist: AllowlistEntry[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [amount, setAmount] = useState("");
  const locked = allowlist.length > 0;
  const [address, setAddress] = useState(() => {
    const saved = findAllowed(allowlist, defaultAddress);
    return saved ? saved.address : allowlist[0]?.address ?? defaultAddress;
  });
  const [addressTouched, setAddressTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [spent, setSpent] = useState(0);
  const [filter, setFilter] = useState<Filter>("All");
  const [openId, setOpenId] = useState<number | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);

  // Re-anchor the optimistic debit once the server hands back a fresh balance.
  useEffect(() => setSpent(0), [balance]);

  const money = (v: number) => `${symbol}${formatCrypto(v, decimals)}`;
  const step = (1 / Math.pow(10, decimals)).toFixed(decimals);
  const available = Math.max(balance - spent, 0);

  const parsed = amount.trim() === "" ? NaN : Number(amount);
  const hasAmount = Number.isFinite(parsed) && parsed > 0;
  const withinLimits = hasAmount && parsed >= min && parsed <= max;
  const withinBalance = hasAmount && parsed <= available + 1e-9;
  const hasAddress = address.trim().length >= 8 && !/\s/.test(address.trim()) && isAllowed(allowlist, address);
  const canSubmit = withinLimits && withinBalance && hasAddress;

  const rows = useMemo(() => withdrawals.filter((w) => matches(w, filter)), [withdrawals, filter]);
  const pendingCount = useMemo(() => withdrawals.filter((w) => isPending(w.status)).length, [withdrawals]);
  const lifetimePaid = useMemo(
    () => withdrawals.filter((w) => isPaid(w.status)).reduce((s, w) => s + Number(w.amount), 0),
    [withdrawals]
  );

  function fill(fraction: number) {
    const target = Math.min(available, max) * fraction;
    setAmount(target > 0 ? target.toFixed(decimals) : "");
  }

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, address: address.trim() }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; id?: number; mfaRequired?: boolean };
      if (j.ok) {
        push("Withdrawal requested", "success");
        setSpent((s) => s + parsed);
        setConfirming(false);
        setAmount("");
        router.refresh();
      } else if (j.mfaRequired) {
        setConfirming(false);
        setMfaOpen(true);
      } else {
        push(j.error ?? "Withdrawal failed", "error");
      }
    } catch (e) {
      push(e instanceof Error ? e.message : "Request failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 py-8">
      <div className="panel rounded-3xl border-t-2 border-t-gold-500/70 p-6 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-400">Available to withdraw</p>
            <p className="font-mono mt-2 text-4xl font-medium tabular-nums text-white">
              <LiveBalance value={available} perMinute={rate} decimals={decimals} />
            </p>
            {rate > 0 ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-300">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                +{formatCrypto(rate, 8)} {code}/min while your rigs hash
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">No active rigs are adding to this balance.</p>
            )}
          </div>
          <div className="grid gap-3 text-center sm:grid-cols-3">
            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <p className="text-[11px] text-slate-400">Minimum</p>
              <p className="font-mono text-sm tabular-nums text-slate-100">{money(min)}</p>
            </div>
            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <p className="text-[11px] text-slate-400">Maximum</p>
              <p className="font-mono text-sm tabular-nums text-slate-100">{money(max)}</p>
            </div>
            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <p className="text-[11px] text-slate-400">In review</p>
              <p className="font-mono text-sm tabular-nums text-slate-100">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="panel rounded-3xl p-6 lg:col-span-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
              <Wallet size={20} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-white">Request a payout</h2>
              <p className="text-xs text-slate-400">Sent in {network} ({code}) after a manual review.</p>
            </div>
          </div>

          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) setConfirming(true);
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount</Label>
                <span className="text-xs text-slate-400">
                  Balance <span className="font-mono tabular-nums text-slate-300">{money(available)}</span>
                </span>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-400">
                  {symbol}
                </span>
                <Input
                  id="amount"
                  inputMode="decimal"
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={(0).toFixed(decimals)}
                  className="pl-9 font-mono tabular-nums"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: "25%", f: 0.25 },
                  { label: "50%", f: 0.5 },
                  { label: "75%", f: 0.75 },
                  { label: "Max", f: 1 },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => fill(q.f)}
                    className="tap h-11 rounded-xl border border-slate-700 px-4 text-xs font-semibold text-slate-200 transition-colors hover:border-gold-500/50 hover:text-white"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="address">Payout wallet address</Label>
                <Link href="#payout-addresses" className="text-xs font-semibold text-gold-300 hover:text-gold-400">
                  Manage addresses
                </Link>
              </div>
              {locked ? (
                <>
                  <select
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-3 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25"
                  >
                    {allowlist.map((a) => (
                      <option key={a.id} value={a.address}>
                        {a.label ? `${a.label} (${shortAddress(a.address)})` : shortAddress(a.address)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-400">Payouts are limited to the addresses on your list.</p>
                </>
              ) : (
                <>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setAddressTouched(true);
                    }}
                    onBlur={() => setAddressTouched(true)}
                    placeholder={`Your ${code} wallet address`}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    {defaultAddress && address.trim() === defaultAddress
                      ? "Prefilled with the address from your last request. "
                      : ""}
                    <Link href="#payout-addresses" className="font-semibold text-gold-300 hover:text-gold-400">
                      Save this address
                    </Link>{" "}
                    to lock payouts to it.
                  </p>
                </>
              )}
            </div>

            <ul className="space-y-1.5 rounded-2xl bg-white/5 p-4">
              <CheckLine ok={withinLimits} touched={hasAmount}>
                Between <span className="font-mono tabular-nums">{money(min)}</span> and{" "}
                <span className="font-mono tabular-nums">{money(max)}</span>
              </CheckLine>
              <CheckLine ok={withinBalance} touched={hasAmount}>
                Not more than your available balance
              </CheckLine>
              <CheckLine ok={hasAddress} touched={addressTouched || locked}>
                {locked ? "Address is on your allowlist" : "Wallet address filled in"}
              </CheckLine>
            </ul>

            <Button type="submit" className="w-full" disabled={!canSubmit || loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending
                </>
              ) : (
                <>
                  Review request <ArrowRight size={15} />
                </>
              )}
            </Button>
          </form>
        </section>

        <aside className="space-y-4 lg:col-span-2">
          <div className="panel rounded-3xl p-6">
            <h3 className="font-display text-sm font-bold text-white">How payouts work</h3>
            <ol className="mt-4 space-y-4">
              {[
                { n: 1, t: "You request", d: "The amount leaves your balance right away and a request is opened." },
                { n: 2, t: "We review", d: "The operator checks the request and sends it to your address." },
                { n: 3, t: "Paid", d: "A transaction reference is attached and the request is closed out." },
              ].map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-500/15 font-display text-xs font-bold text-gold-300">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{s.t}</p>
                    <p className="text-xs text-slate-400">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 flex items-start gap-2 border-t border-white/5 pt-4 text-xs leading-relaxed text-slate-400">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
              Requests are reviewed manually, usually within a day. Double-check the wallet address: payouts
              cannot be reversed once sent.
            </p>
          </div>
        </aside>
      </div>

      <section className="panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white">Your withdrawals</h2>
            <p className="text-xs text-slate-400">
              {withdrawals.length} request{withdrawals.length === 1 ? "" : "s"} ·{" "}
              <span className="font-mono tabular-nums">{money(lifetimePaid)}</span> paid out
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

        <div className="mt-4 space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
              {withdrawals.length === 0 ? "No withdrawals yet. Your first request will show up here." : "Nothing matches this filter."}
            </p>
          ) : (
            rows.map((w) => {
              const open = openId === w.id;
              return (
                <div key={w.id} className="rounded-2xl border border-white/5 bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : w.id)}
                    aria-expanded={open}
                    className="tap flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="font-mono text-sm font-medium tabular-nums text-white">{money(Number(w.amount))}</span>
                    <span className="hidden text-xs text-slate-400 sm:inline">
                      {new Date(w.created_at).toLocaleDateString()}
                    </span>
                    <Badge variant={badgeFor(w.status)} className="ml-auto">
                      {w.status}
                    </Badge>
                    <ChevronDown size={16} className={cn("shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div className="space-y-4 border-t border-white/5 px-4 py-4">
                      <Tracker w={w} />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-slate-400">Payout address</span>
                        {w.address ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-200">
                              {w.address.length > 18 ? `${w.address.slice(0, 10)}…${w.address.slice(-6)}` : w.address}
                            </span>
                            <CopyButton text={w.address} />
                          </div>
                        ) : (
                          <span className="text-slate-500">not recorded</span>
                        )}
                      </div>
                      {w.tx && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs">
                          <span className="text-slate-400">Transaction</span>
                          <span className="min-w-0 break-all font-mono text-slate-200">{w.tx}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <Modal
        open={confirming}
        onClose={() => (loading ? undefined : setConfirming(false))}
        title="Confirm withdrawal"
        description="Check the amount and address before sending the request."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={loading}>
              Back
            </Button>
            <Button onClick={submit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending
                </>
              ) : (
                <>
                  <Wallet size={15} /> Confirm {money(parsed)}
                </>
              )}
            </Button>
          </>
        }
      >
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 text-sm">
            <dt className="text-slate-400">Amount</dt>
            <dd className="font-mono tabular-nums text-white">{money(parsed)}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3 text-sm">
            <dt className="text-slate-400">To</dt>
            <dd className="max-w-[60%] break-all text-right font-mono text-slate-100">{address.trim()}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 text-sm">
            <dt className="text-slate-400">Network</dt>
            <dd className="text-slate-100">{network}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-slate-400">Balance after</dt>
            <dd className="font-mono tabular-nums text-slate-100">{money(Math.max(available - parsed, 0))}</dd>
          </div>
        </dl>
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
          The amount leaves your balance now. If the request is rejected, it is refunded in full.
        </p>
      </Modal>

      <MfaModal
        open={mfaOpen}
        onClose={() => setMfaOpen(false)}
        onDone={() => {
          setMfaOpen(false);
          submit();
        }}
      />
    </div>
  );
}
