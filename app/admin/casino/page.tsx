import { getAdminSettings } from "@/lib/settings";
import { GAME_CATALOG } from "@/lib/games/registry";
import { casinoStats, casinoStatsByGame } from "@/lib/games/stats";
import { parseConfig, parseSchedule, parseTiers } from "@/lib/games/econ";
import { CasinoControl } from "@/components/admin/casino-control";

export const dynamic = "force-dynamic";
export const metadata = { title: "Casino control" };

export default async function AdminCasino() {
  const settings = await getAdminSettings();
  const now = Date.now();
  const daySince = new Date(now - 864e5);
  const weekSince = new Date(now - 7 * 864e5);
  const [day, week, dayByGame, weekByGame] = await Promise.all([
    casinoStats(daySince),
    casinoStats(weekSince),
    casinoStatsByGame(daySince),
    casinoStatsByGame(weekSince),
  ]);

  return (
    <CasinoControl
      initial={{
        enabled: settings.games_enabled,
        minBet: String(settings.games_min_bet ?? 0),
        maxBet: String(settings.games_max_bet ?? 0),
        edge: String(settings.games_edge_boost ?? 0),
        maxWin: String(settings.games_max_win ?? 0),
        disabled: String(settings.games_disabled ?? "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        config: parseConfig(settings.games_config),
        tiers: parseTiers(settings.games_tiers),
        schedule: parseSchedule(settings.games_schedule),
      }}
      games={GAME_CATALOG.map((g) => ({ id: g.id, name: g.name }))}
      currencyCode={settings.currency_code}
      stats={{ day, week }}
      byGame={{ day: dayByGame, week: weekByGame }}
    />
  );
}
