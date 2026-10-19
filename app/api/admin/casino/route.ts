import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";
import { getAdminSettings } from "@/lib/settings";
import { recordAudit } from "@/lib/audit";
import { GAME_CATALOG } from "@/lib/games/registry";
import { MAX_EDGE } from "@/lib/games/econ";
import { casinoStats } from "@/lib/games/stats";

export const dynamic = "force-dynamic";

const GAME_IDS = GAME_CATALOG.map((g) => g.id);

function bound(v: unknown, lo: number, hi: number, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function money(v: unknown): number {
  return bound(v, 0, 1e12, 0);
}

function cleanGameId(v: unknown): string | null {
  const id = String(v ?? "").trim().toLowerCase();
  return GAME_IDS.includes(id) ? id : null;
}

function present(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

export async function GET() {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  const settings = await getAdminSettings();
  const now = Date.now();
  const [day, week] = await Promise.all([
    casinoStats(new Date(now - 864e5)),
    casinoStats(new Date(now - 7 * 864e5)),
  ]);
  return NextResponse.json({ ok: true, settings, stats: { day, week } });
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const minBet = money(body.games_min_bet);
  const maxBet = money(body.games_max_bet);
  if (maxBet > 0 && minBet > maxBet) {
    return NextResponse.json(
      { ok: false, error: "Maximum bet must be at least the minimum." },
      { status: 400 }
    );
  }

  const config: Record<string, Record<string, number>> = {};
  if (body.games_config && typeof body.games_config === "object" && !Array.isArray(body.games_config)) {
    const rec = body.games_config as Record<string, unknown>;
    const keys = Object.keys(rec);
    for (let i = 0; i < keys.length; i++) {
      const id = cleanGameId(keys[i]);
      if (!id) continue;
      const raw = rec[keys[i]];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const r = raw as Record<string, unknown>;
      const o: Record<string, number> = {};
      if (present(r.edge)) o.edge = bound(r.edge, 0, MAX_EDGE, 0);
      if (present(r.maxWin)) o.maxWin = money(r.maxWin);
      if (present(r.min)) o.min = money(r.min);
      if (present(r.max)) o.max = money(r.max);
      if (Object.keys(o).length) config[id] = o;
    }
  }

  const tiers: Array<Record<string, unknown>> = [];
  if (Array.isArray(body.games_tiers)) {
    for (let i = 0; i < body.games_tiers.length && tiers.length < 24; i++) {
      const raw = body.games_tiers[i];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const r = raw as Record<string, unknown>;
      const name = String(r.name ?? "").trim().slice(0, 40);
      if (!name) continue;
      const id =
        String(r.id ?? `tier-${tiers.length}`).replace(/[^a-z0-9_-]/gi, "").slice(0, 40) ||
        `tier-${tiers.length}`;
      const t: Record<string, unknown> = { id, name, minWager: money(r.minWager) };
      if (present(r.edge)) t.edge = bound(r.edge, 0, MAX_EDGE, 0);
      if (present(r.maxWin)) t.maxWin = money(r.maxWin);
      tiers.push(t);
    }
    tiers.sort((a, b) => Number(a.minWager) - Number(b.minWager));
  }

  const schedRaw =
    body.games_schedule && typeof body.games_schedule === "object" && !Array.isArray(body.games_schedule)
      ? (body.games_schedule as Record<string, unknown>)
      : {};
  const schedule = {
    enabled: schedRaw.enabled === true || schedRaw.enabled === "true" || schedRaw.enabled === "yes",
    startHour: Math.round(bound(schedRaw.startHour, 0, 23, 0)),
    endHour: Math.round(bound(schedRaw.endHour, 0, 23, 0)),
    edgeDelta: bound(schedRaw.edgeDelta, -MAX_EDGE, MAX_EDGE, 0),
  };

  const disabled: string[] = [];
  const rawDisabled = body.games_disabled;
  const wanted = Array.isArray(rawDisabled) ? rawDisabled : String(rawDisabled ?? "").split(",");
  for (let i = 0; i < wanted.length; i++) {
    const id = cleanGameId(wanted[i]);
    if (id && !disabled.includes(id)) disabled.push(id);
  }

  const update = {
    games_enabled:
      body.games_enabled === true || body.games_enabled === "true" || body.games_enabled === "yes",
    games_min_bet: minBet,
    games_max_bet: maxBet,
    games_edge_boost: bound(body.games_edge_boost, 0, MAX_EDGE, 0),
    games_max_win: money(body.games_max_win),
    games_disabled: disabled.join(","),
    games_config: config,
    games_tiers: tiers,
    games_schedule: schedule,
  };

  const { error } = await createAdminSupabase().from("settings").update(update).eq("id", 1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  revalidateTag("site-settings");
  await recordAudit({
    actor: { id: gate.userId, name: gate.name },
    action: "casino.update",
    detail: {
      games_enabled: update.games_enabled,
      games_edge_boost: update.games_edge_boost,
      games_max_win: update.games_max_win,
      games_disabled: update.games_disabled,
      overrides: Object.keys(config),
      tiers: tiers.length,
      schedule,
    },
    req,
  });

  const settings = await getAdminSettings();
  return NextResponse.json({ ok: true, message: "Casino controls saved", settings });
}
