"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Modal } from "@/components/admin/modal";
import { PlanAssistant } from "@/components/admin/plan-assistant";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { cn, formatCrypto } from "@/lib/utils";
import { formatFiat } from "@/lib/money";
import { earningRateFromDaily, planEconomics, planNetEconomics } from "@/lib/plan-math";
import type { PlanProposal } from "@/lib/plan-goal";

export type AdminPlan = {
  id: number;
  plan_name: string;
  version: string | null;
  image: string;
  price: number;
  point_per_day: number | null;
  duration: number;
  profit: string | null;
  speed: string;
  is_default: boolean;
};

type Draft = {
  plan_name: string;
  version: string;
  image: string;
  speed: string;
  profit: string;
  price: string;
  point_per_day: string;
  duration: string;
  is_default: boolean;
};

function toDraft(p?: AdminPlan | null): Draft {
  return {
    plan_name: p?.plan_name ?? "",
    version: p?.version ?? "",
    image: p?.image ?? "1.png",
    speed: p?.speed ?? "1",
    profit: p?.profit ?? "",
    price: p ? String(p.price ?? 0) : "0",
    point_per_day: p ? String(p.point_per_day ?? 0) : "0",
    duration: p ? String(p.duration ?? 30) : "30",
    is_default: p?.is_default ?? false,
  };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "mute" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-950/50 px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p
        className={cn(
          "font-mono mt-0.5 text-sm tabular-nums",
          tone === "good" && "text-emerald-300",
          tone === "bad" && "text-red-300",
          tone === "mute" && "text-slate-200",
          !tone && "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Calculator({
  draft,
  symbol,
  code,
  decimals,
  priceCurrency,
  cryptoToPrice,
  affiliatePct,
  rateAvailable,
}: {
  draft: Draft;
  symbol: string;
  code: string;
  decimals: number;
  priceCurrency: string;
  cryptoToPrice: number;
  affiliatePct: number;
  rateAvailable: boolean;
}) {
  const e = useMemo(
    () =>
      planNetEconomics({
        price: Number(draft.price || 0),
        point_per_day: Number(draft.point_per_day || 0),
        duration: Number(draft.duration || 0),
        cryptoToPrice,
        processorPct: 0.25,
        affiliatePct,
      }),
    [draft.price, draft.point_per_day, draft.duration, cryptoToPrice, affiliatePct]
  );
  const money = (v: number) => `${symbol}${formatCrypto(v, decimals)}`;
  const negative = e.netProfit < 0;
  const doubled = planNetEconomics({
    price: Number(draft.price || 0),
    point_per_day: Number(draft.point_per_day || 0),
    duration: Number(draft.duration || 0),
    cryptoToPrice: cryptoToPrice * 2,
    processorPct: 0.25,
    affiliatePct,
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-950/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
        <TrendingUp size={14} className="text-gold-400" /> Owner economics
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label={`Price (${priceCurrency})`} value={formatFiat(e.price, priceCurrency)} tone="mute" />
        <Stat label={`Payout to member (${code})`} value={money(e.payoutToUser)} tone="mute" />
        <Stat label={`Net profit (${priceCurrency})`} value={formatFiat(e.netProfit, priceCurrency)} tone={negative ? "bad" : "good"} />
        <Stat label="Net margin" value={`${e.netMarginPct.toFixed(1)}%`} tone={negative ? "bad" : "good"} />
        <Stat label="Processor + affiliate" value={formatFiat(e.processorFee + e.affiliateCost, priceCurrency)} tone="mute" />
        <Stat label="Member break-even" value={e.breakEvenDays > 0 ? `${e.breakEvenDays.toFixed(1)} days` : "instant"} tone="mute" />
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Credited at <span className="font-mono text-slate-300">{earningRateFromDaily(e.daily)}</span> {code}/min
        {" · "}
        <span className="font-mono text-slate-300">{formatCrypto(e.daily, 8)}</span> {code}/day
      </p>
      {!rateAvailable && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
          <AlertTriangle size={12} /> Live DOGE rate unavailable. Paid plans cannot be saved until the rate loads.
        </p>
      )}
      {rateAvailable && (
        <p className="mt-2 text-[11px] text-slate-400">
          If DOGE doubles: net profit{" "}
          <span className={doubled.netProfit < 0 ? "text-red-300" : "text-emerald-300"}>
            {formatFiat(doubled.netProfit, priceCurrency)}
          </span>{" "}
          ({doubled.netMarginPct.toFixed(1)}%).
        </p>
      )}
      {negative && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-red-300">
          <AlertTriangle size={12} /> This plan loses money after processor and affiliate costs. Saving is blocked.
        </p>
      )}
    </div>
  );
}

export function PlansManager({
  plans,
  usage,
  symbol,
  code,
  decimals,
  priceCurrency,
  cryptoToPrice,
  affiliatePct,
  rateAvailable,
  minWithdraw,
  maxWithdraw,
}: {
  plans: AdminPlan[];
  usage: Record<number, number>;
  symbol: string;
  code: string;
  decimals: number;
  priceCurrency: string;
  cryptoToPrice: number;
  affiliatePct: number;
  rateAvailable: boolean;
  minWithdraw: number;
  maxWithdraw: number;
}) {
  const { run, busy } = useAdminAction();
  const [editing, setEditing] = useState<AdminPlan | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft>(toDraft(null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<AdminPlan | null>(null);
  const open = editing !== undefined;

  const totalOwnerProfit = useMemo(
    () =>
      plans.reduce((sum, p) => {
        const e = planNetEconomics({
          ...p,
          cryptoToPrice,
          processorPct: 0.25,
          affiliatePct,
        });
        return sum + (p.is_default ? 0 : e.netProfit);
      }, 0),
    [plans, cryptoToPrice, affiliatePct]
  );
  const freePlan = plans.find((p) => p.is_default);
  const freeCost = freePlan
    ? planEconomics({
        price: 0,
        point_per_day: freePlan.point_per_day,
        duration: freePlan.duration,
        cryptoToPrice,
      }).payoutInPrice
    : 0;

  function startCreate() {
    setDraft(toDraft(null));
    setErrors({});
    setEditing(null);
  }
  function startEdit(p: AdminPlan) {
    setDraft(toDraft(p));
    setErrors({});
    setEditing(p);
  }
  function close() {
    setEditing(undefined);
    setErrors({});
  }

  async function save() {
    const price = draft.price === "" ? 0 : Number(draft.price);
    if (draft.is_default && price > 0) {
      setErrors({ price: "Only a free plan can be the default starter plan." });
      return;
    }
    if (price > 0) {
      if (!rateAvailable) {
        setErrors({ price: "Live DOGE rate is unavailable. Try again before saving a paid plan." });
        return;
      }
      const net = planNetEconomics({
        price,
        point_per_day: Number(draft.point_per_day || 0),
        duration: Number(draft.duration || 0),
        cryptoToPrice,
        processorPct: 0.25,
        affiliatePct,
      });
      if (net.netProfit <= 0) {
        setErrors({
          price: `This plan loses money after fees (${net.netMarginPct.toFixed(1)}% margin). Lower the daily credit or raise the price.`,
        });
        return;
      }
    }
    const body = {
      plan_name: draft.plan_name,
      version: draft.version,
      image: draft.image,
      speed: draft.speed,
      profit: draft.profit,
      price: draft.price === "" ? 0 : Number(draft.price),
      point_per_day: draft.point_per_day === "" ? 0 : Number(draft.point_per_day),
      duration: draft.duration === "" ? 0 : Number(draft.duration),
      is_default: draft.is_default,
    };
    const url = "/api/admin/plans";
    const res = editing
      ? await run(url, { id: editing.id, ...body }, { method: "PATCH", success: "Plan updated" })
      : await run(url, body, { success: "Plan created" });
    if (res.ok) close();
    else if (res.errors) setErrors(res.errors as Record<string, string>);
  }

  async function remove() {
    if (!confirming) return;
    const res = await run("/api/admin/plans", { id: confirming.id }, { method: "DELETE", success: "Plan removed" });
    if (res.ok) setConfirming(null);
  }

  const invalid = (k: string) => (errors[k] ? "border-red-500/60 focus:border-red-500/70 focus:ring-red-500/25" : "");
  const set = (k: keyof Draft, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  function applyProposal(p: PlanProposal) {
    setErrors({});
    setDraft((d) => ({
      ...d,
      plan_name: p.plan_name || d.plan_name,
      version: p.version || d.version,
      price: String(p.price),
      point_per_day: String(p.point_per_day),
      duration: String(p.duration),
      speed: p.speed || d.speed,
      profit: p.profit || d.profit,
      is_default: p.is_default,
    }));
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <AdminPageHeader
          title="Plans"
          description={
            <>
              {plans.length} plan{plans.length === 1 ? "" : "s"}. Net profit if one of each paid plan sells:{" "}
              <span className={cn("font-mono", totalOwnerProfit < 0 ? "text-red-300" : "text-emerald-300")}>
                {formatFiat(totalOwnerProfit, priceCurrency)}
              </span>
              . Free plan costs {formatFiat(freeCost, priceCurrency)} per user.
            </>
          }
        />
        <Button onClick={startCreate}>
          <Plus size={15} /> New plan
        </Button>
      </div>

      <div className="panel overflow-hidden rounded-3xl">
        {plans.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">
            No plans yet. Add one to start selling plans.
          </p>
        ) : (
          <div className="overflow-x-auto px-6 py-2 text-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-3 pr-4 font-medium">Plan</th>
                  <th className="py-3 pr-4 font-medium">Price</th>
                  <th className="py-3 pr-4 font-medium">Daily</th>
                  <th className="py-3 pr-4 font-medium">Duration</th>
                  <th className="py-3 pr-4 font-medium">Net profit</th>
                  <th className="py-3 pr-4 font-medium">Net margin</th>
                  <th className="py-3 pr-4 font-medium">Rigs</th>
                  <th className="py-3 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const e = planNetEconomics({
                    ...p,
                    cryptoToPrice,
                    processorPct: 0.25,
                    affiliatePct,
                  });
                  return (
                    <tr key={p.id} className="border-t border-white/5">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-white">{p.plan_name}</span>
                        {p.is_default && <Badge variant="gold" className="ml-2">default</Badge>}
                        <span className="block text-xs text-slate-400">
                          {p.version ? `${p.version} · ` : ""}
                          {String(p.speed ?? "")}
                        </span>
                      </td>
                      <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">
                        {formatFiat(p.price, priceCurrency)}
                      </td>
                      <td className="font-mono py-3 pr-4 tabular-nums text-emerald-300">
                        +{formatCrypto(e.daily, decimals)}
                      </td>
                      <td className="py-3 pr-4 text-slate-300">{p.duration} days</td>
                      <td
                        className={cn(
                          "font-mono py-3 pr-4 tabular-nums",
                          p.is_default ? "text-slate-400" : e.netProfit < 0 ? "text-red-300" : "text-emerald-300"
                        )}
                      >
                        {p.is_default ? "free" : formatFiat(e.netProfit, priceCurrency)}
                      </td>
                      <td className={cn("font-mono py-3 pr-4 tabular-nums", p.is_default ? "text-slate-300" : e.netMarginPct < 0 ? "text-red-300" : "text-emerald-300")}>
                        {p.is_default ? "-" : `${e.netMarginPct.toFixed(1)}%`}
                      </td>
                      <td className="font-mono py-3 pr-4 tabular-nums text-slate-200">{usage[p.id] ?? 0}</td>
                      <td className="py-3 pr-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => startEdit(p)} aria-label={`Edit ${p.plan_name}`}>
                            <Pencil size={14} /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirming(p)}
                            aria-label={`Remove ${p.plan_name}`}
                            className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                          >
                            <Trash2 size={14} />
                          </Button>
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
        open={open}
        onClose={close}
        wide
        title={editing ? `Edit ${editing.plan_name}` : "New plan"}
        description="Price is what the member pays. Daily yield credits to their balance every 24h while the rig runs."
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {editing ? "Save plan" : "Create plan"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <PlanAssistant
              key={editing ? `edit-${editing.id}` : "new"}
              context={{
                price: Number(draft.price || 0),
                durationDays: Number(draft.duration || 0),
                pointPerDay: Number(draft.point_per_day || 0),
                currencyCode: priceCurrency,
                cryptoCode: code,
                cryptoToPrice,
                affiliatePct,
                processorPct: 0.25,
                minWithdraw,
                maxWithdraw,
                isEdit: Boolean(editing),
              }}
              code={code}
              decimals={decimals}
              priceCurrency={priceCurrency}
              onApply={applyProposal}
            />
            <div>
              <Label htmlFor="p-name">Plan name</Label>
              <Input id="p-name" value={draft.plan_name} onChange={(e) => set("plan_name", e.target.value)} className={invalid("plan_name")} placeholder="Plan V1.3" />
              {errors.plan_name && <p className="mt-1.5 text-xs text-red-300">{errors.plan_name}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="p-version">Version label</Label>
                <Input id="p-version" value={draft.version} onChange={(e) => set("version", e.target.value)} placeholder="V1.3" />
              </div>
              <div>
                <Label htmlFor="p-speed">Tier label</Label>
                <Input id="p-speed" value={draft.speed} onChange={(e) => set("speed", e.target.value)} placeholder="50 KH/s" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-price">Price ({priceCurrency})</Label>
                <Input id="p-price" type="number" min={0} step="any" value={draft.price} onChange={(e) => set("price", e.target.value)} className={invalid("price")} />
                {errors.price && <p className="mt-1.5 text-xs text-red-300">{errors.price}</p>}
              </div>
              <div>
                <Label htmlFor="p-daily">Daily yield</Label>
                <Input id="p-daily" type="number" min={0} step="any" value={draft.point_per_day} onChange={(e) => set("point_per_day", e.target.value)} className={invalid("point_per_day")} />
                {errors.point_per_day && <p className="mt-1.5 text-xs text-red-300">{errors.point_per_day}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="p-duration">Duration (days)</Label>
                <Input id="p-duration" type="number" min={1} step={1} value={draft.duration} onChange={(e) => set("duration", e.target.value)} className={invalid("duration")} />
                {errors.duration && <p className="mt-1.5 text-xs text-red-300">{errors.duration}</p>}
              </div>
              <div>
                <Label htmlFor="p-image">Card art</Label>
                <Input id="p-image" value={draft.image} onChange={(e) => set("image", e.target.value)} placeholder="1.png" />
              </div>
            </div>
            <div>
              <Label htmlFor="p-profit">Profit blurb (shown to members)</Label>
              <Input id="p-profit" value={draft.profit} onChange={(e) => set("profit", e.target.value)} placeholder="Up to 200%" />
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={draft.is_default}
                onChange={(e) => set("is_default", e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-ink-900 accent-gold-500"
              />
              Default plan (the free starter rig)
            </label>
          </div>
          <Calculator
            draft={draft}
            symbol={symbol}
            code={code}
            decimals={decimals}
            priceCurrency={priceCurrency}
            cryptoToPrice={cryptoToPrice}
            affiliatePct={affiliatePct}
            rateAvailable={rateAvailable}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Remove plan"
        description={confirming ? `"${confirming.plan_name}" will be deleted.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              <Trash2 size={15} /> Remove plan
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Plans that members are still running cannot be removed. Stop those rigs first, or this will be refused.
        </p>
      </Modal>
    </div>
  );
}

