"use client";
import { useState } from "react";
import { Loader2, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";

type Override = { edge?: number; maxWin?: number; min?: number; max?: number };
type Tier = { id: string; name: string; minWager: number; edge?: number; maxWin?: number };
type Schedule = { enabled: boolean; startHour: number; endHour: number; edgeDelta: number };
type Stat = { bets: number; wagers: number; payouts: number; hold: number; rtp: number };

type Initial = {
  enabled: boolean;
  minBet: string;
  maxBet: string;
  edge: string;
  maxWin: string;
  disabled: string[];
  config: Record<string, Override>;
  tiers: Tier[];
  schedule: Schedule;
};

type GameRow = {
  id: string;
  enabled: boolean;
  edge: string;
  maxWin: string;
  min: string;
  max: string;
};

type TierRow = { id: string; name: string; minWager: string; edge: string; maxWin: string };

const field =
  "h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25";

function money(n: number, code: string): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${code}`;
}

function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="tap inline-flex h-11 items-center gap-2.5 rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-gold-500/40"
    >
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-emerald-500/80" : "bg-slate-600")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
      {on ? "On" : "Off"}
    </button>
  );
}

function StatBlock({ title, stat, code }: { title: string; stat: Stat; code: string }) {
  return (
    <div className="panel rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-slate-400">Rounds</p>
          <p className="font-display font-semibold text-white">{stat.bets.toLocaleString("en-US")}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Hold</p>
          <p className={cn("font-display font-semibold", stat.hold >= 0 ? "text-emerald-300" : "text-red-300")}>
            {stat.wagers > 0 ? pct(stat.hold) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Wagers</p>
          <p className="text-slate-200">{money(stat.wagers, code)}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Payouts</p>
          <p className="text-slate-200">{money(stat.payouts, code)}</p>
        </div>
      </div>
    </div>
  );
}

export function CasinoControl({
  initial,
  games,
  currencyCode,
  stats,
}: {
  initial: Initial;
  games: { id: string; name: string }[];
  currencyCode: string;
  stats: { day: Stat; week: Stat };
}) {
  const { run, busy } = useAdminAction();

  const [enabled, setEnabled] = useState(initial.enabled);
  const [minBet, setMinBet] = useState(initial.minBet);
  const [maxBet, setMaxBet] = useState(initial.maxBet);
  const [edge, setEdge] = useState(initial.edge);
  const [maxWin, setMaxWin] = useState(initial.maxWin);

  const [rows, setRows] = useState<GameRow[]>(() =>
    games.map((g) => {
      const c = initial.config[g.id] ?? {};
      return {
        id: g.id,
        enabled: !initial.disabled.includes(g.id),
        edge: c.edge === undefined ? "" : String(c.edge),
        maxWin: c.maxWin === undefined ? "" : String(c.maxWin),
        min: c.min === undefined ? "" : String(c.min),
        max: c.max === undefined ? "" : String(c.max),
      };
    })
  );

  const [tiers, setTiers] = useState<TierRow[]>(() =>
    initial.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      minWager: String(t.minWager),
      edge: t.edge === undefined ? "" : String(t.edge),
      maxWin: t.maxWin === undefined ? "" : String(t.maxWin),
    }))
  );

  const [schedOn, setSchedOn] = useState(initial.schedule.enabled);
  const [startHour, setStartHour] = useState(String(initial.schedule.startHour));
  const [endHour, setEndHour] = useState(String(initial.schedule.endHour));
  const [edgeDelta, setEdgeDelta] = useState(String(initial.schedule.edgeDelta));

  function setRow(id: string, patch: Partial<GameRow>) {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function setTier(id: string, patch: Partial<TierRow>) {
    setTiers((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers((list) => [
      ...list,
      { id: `tier-${Date.now()}`, name: "", minWager: "0", edge: "", maxWin: "" },
    ]);
  }

  function save() {
    const config: Record<string, Record<string, string>> = {};
    for (const r of rows) {
      const o: Record<string, string> = {};
      if (r.edge !== "") o.edge = r.edge;
      if (r.maxWin !== "") o.maxWin = r.maxWin;
      if (r.min !== "") o.min = r.min;
      if (r.max !== "") o.max = r.max;
      if (Object.keys(o).length) config[r.id] = o;
    }
    const payload = {
      games_enabled: enabled,
      games_min_bet: minBet,
      games_max_bet: maxBet,
      games_edge_boost: edge,
      games_max_win: maxWin,
      games_disabled: rows.filter((r) => !r.enabled).map((r) => r.id),
      games_config: config,
      games_tiers: tiers
        .filter((t) => t.name.trim())
        .map((t) => ({
          id: t.id,
          name: t.name,
          minWager: t.minWager,
          edge: t.edge,
          maxWin: t.maxWin,
        })),
      games_schedule: {
        enabled: schedOn,
        startHour,
        endHour,
        edgeDelta,
      },
    };
    void run("/api/admin/casino", payload, { success: "Casino controls saved" });
  }

  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <AdminPageHeader
          title="Casino control"
          description="Dial the house economics per game, per player tier, and per hour. Outcomes still come from the committed seed, so every round stays verifiable."
        />
        <Button onClick={save} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Saving
            </>
          ) : (
            <>
              <Save size={15} /> Save controls
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatBlock title="Last 24 hours" stat={stats.day} code={currencyCode} />
        <StatBlock title="Last 7 days" stat={stats.week} code={currencyCode} />
      </div>

      <section className="panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-white">Lobby and limits</h2>
            <p className="mt-1 text-xs text-slate-400">Applies to every game unless a game overrides it.</p>
          </div>
          <Switch on={enabled} onChange={setEnabled} label="Casino open" />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label htmlFor="casino-min">Minimum bet</Label>
            <Input id="casino-min" type="number" min={0} step="any" value={minBet} onChange={(e) => setMinBet(e.target.value)} />
            <p className="mt-1 text-[11px] text-slate-400">0 leaves no floor.</p>
          </div>
          <div>
            <Label htmlFor="casino-max">Maximum bet</Label>
            <Input id="casino-max" type="number" min={0} step="any" value={maxBet} onChange={(e) => setMaxBet(e.target.value)} />
            <p className="mt-1 text-[11px] text-slate-400">0 leaves no cap.</p>
          </div>
          <div>
            <Label htmlFor="casino-edge">Extra house edge</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={Number(edge) || 0}
                onChange={(e) => setEdge(e.target.value)}
                aria-label="Extra house edge"
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-gold-500"
              />
              <Input id="casino-edge" type="number" min={0} max={50} step={1} value={edge} onChange={(e) => setEdge(e.target.value)} className="w-20 px-2 text-center" />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Percent trimmed from payouts, 0 to 50.</p>
          </div>
          <div>
            <Label htmlFor="casino-maxwin">Max win</Label>
            <Input id="casino-maxwin" type="number" min={0} step="any" value={maxWin} onChange={(e) => setMaxWin(e.target.value)} />
            <p className="mt-1 text-[11px] text-slate-400">Ceiling per payout. 0 is uncapped.</p>
          </div>
        </div>
      </section>

      <section className="panel rounded-2xl p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-white">Per-game overrides</h2>
          <p className="text-xs text-slate-400">Blank means inherit the lobby value.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const meta = games.find((g) => g.id === r.id);
            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  r.enabled ? "border-slate-800" : "border-red-500/30 bg-red-500/5"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-white">{meta?.name ?? r.id}</span>
                  <Switch
                    on={r.enabled}
                    onChange={(v) => setRow(r.id, { enabled: v })}
                    label={`${meta?.name ?? r.id} open`}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-slate-400">
                    Edge %
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      placeholder="inherit"
                      value={r.edge}
                      onChange={(e) => setRow(r.id, { edge: e.target.value })}
                      className="mt-1 px-3"
                      aria-label={`${meta?.name ?? r.id} edge`}
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    Max win
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="inherit"
                      value={r.maxWin}
                      onChange={(e) => setRow(r.id, { maxWin: e.target.value })}
                      className="mt-1 px-3"
                      aria-label={`${meta?.name ?? r.id} max win`}
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    Min bet
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="inherit"
                      value={r.min}
                      onChange={(e) => setRow(r.id, { min: e.target.value })}
                      className="mt-1 px-3"
                      aria-label={`${meta?.name ?? r.id} minimum bet`}
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    Max bet
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="inherit"
                      value={r.max}
                      onChange={(e) => setRow(r.id, { max: e.target.value })}
                      className="mt-1 px-3"
                      aria-label={`${meta?.name ?? r.id} maximum bet`}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel rounded-2xl p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-white">Player tiers</h2>
          <p className="text-xs text-slate-400">The highest tier reached by lifetime wager sets that member&apos;s edge and cap.</p>
        </div>
        <div className="mt-4 space-y-3">
          {tiers.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-400">
              No tiers yet. Every member plays at the lobby values.
            </p>
          )}
          {tiers.map((t) => (
            <div key={t.id} className="grid gap-2 rounded-xl border border-slate-800 p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:items-end">
              <label className="text-[11px] text-slate-400">
                Name
                <input
                  value={t.name}
                  onChange={(e) => setTier(t.id, { name: e.target.value })}
                  placeholder="Whale"
                  className={cn(field, "mt-1 px-3")}
                  aria-label="Tier name"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                Lifetime wager from
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={t.minWager}
                  onChange={(e) => setTier(t.id, { minWager: e.target.value })}
                  className={cn(field, "mt-1 px-3")}
                  aria-label="Tier lifetime wager threshold"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                Edge %
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  placeholder="inherit"
                  value={t.edge}
                  onChange={(e) => setTier(t.id, { edge: e.target.value })}
                  className={cn(field, "mt-1 px-3")}
                  aria-label="Tier edge"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                Max win
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="inherit"
                  value={t.maxWin}
                  onChange={(e) => setTier(t.id, { maxWin: e.target.value })}
                  className={cn(field, "mt-1 px-3")}
                  aria-label="Tier max win"
                />
              </label>
              <button
                type="button"
                onClick={() => setTiers((list) => list.filter((x) => x.id !== t.id))}
                aria-label={`Remove ${t.name || "tier"}`}
                className="tap inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-400 transition-colors hover:border-red-500/50 hover:text-red-300"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <Button variant="secondary" onClick={addTier}>
            <Plus size={15} /> Add tier
          </Button>
        </div>
      </section>

      <section className="panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-white">Promo window</h2>
            <p className="mt-1 text-xs text-slate-400">Shift the extra edge during a UTC hour range. Negative is a promo, positive is a boost.</p>
          </div>
          <Switch on={schedOn} onChange={setSchedOn} label="Promo window active" />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="sched-start">Start hour (UTC)</Label>
            <Input id="sched-start" type="number" min={0} max={23} step={1} value={startHour} onChange={(e) => setStartHour(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sched-end">End hour (UTC)</Label>
            <Input id="sched-end" type="number" min={0} max={23} step={1} value={endHour} onChange={(e) => setEndHour(e.target.value)} />
            <p className="mt-1 text-[11px] text-slate-400">Equal hours means all day.</p>
          </div>
          <div>
            <Label htmlFor="sched-delta">Edge change</Label>
            <Input id="sched-delta" type="number" min={-50} max={50} step={1} value={edgeDelta} onChange={(e) => setEdgeDelta(e.target.value)} />
            <p className="mt-1 text-[11px] text-slate-400">Added to the current edge, then clamped to 0 to 50.</p>
          </div>
        </div>
      </section>

      <div className="panel flex items-start gap-3 rounded-2xl p-4 text-xs text-slate-400">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" />
        <p>
          These controls change how much a win pays, never the roll itself. Each round stores the seed, client seed and
          nonce, so a member can re-derive the result and the receipt still matches.
        </p>
      </div>
    </div>
  );
}
