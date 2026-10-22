import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCachedSettings } from "@/lib/catalog";
import { GAME_CATALOG, type GameMeta } from "@/lib/games/registry";
import { casinoEcon, isGameDisabled } from "@/lib/games/econ";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Games" };

const GROUPS: { pace: "fast" | "pick" | "step"; title: string; note: string }[] = [
  {
    pace: "fast",
    title: "One press",
    note: "Name your stake, press once, get the result. Best for quick sessions.",
  },
  {
    pace: "pick",
    title: "Choose and spin",
    note: "Set the odds first, then send it. A wider range of payouts per round.",
  },
  {
    pace: "step",
    title: "Round by round",
    note: "Open tiles, raise the multiplier, and decide when to stop.",
  },
];

const cardFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950";

function GameCard({ game, index }: { game: GameMeta; index: number }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className={`panel group flex h-full flex-col rounded-2xl p-5 transition-colors hover:border-gold-500/40 ${cardFocus}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[11px] tabular-nums text-slate-400">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Badge variant="gold">{game.category}</Badge>
      </div>
      <h3 className="mt-2 font-display text-lg font-bold text-white group-hover:text-gold-300">{game.name}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-400">{game.blurb}</p>
      <p className="mt-4 border-t border-white/5 pt-3 text-xs text-slate-400">{game.edge}</p>
    </Link>
  );
}

export default async function GamesPage() {
  const s = await getCachedSettings();
  if (!s.games_enabled) notFound();

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("balance")
    .eq("id", user.id)
    .maybeSingle();
  const balance = Number((profile as { balance?: number } | null)?.balance ?? 0);
  const econ = casinoEcon(s);
  const games = GAME_CATALOG.filter((g) => !isGameDisabled(econ, g.id));
  const order = new Map(GAME_CATALOG.map((g, i) => [g.id, i]));

  const min = s.games_min_bet;
  const max = s.games_max_bet;
  const limits =
    min > 0 && max > 0
      ? `Stakes ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")} ${s.currency_symbol}`
      : min > 0
        ? `Stakes from ${min.toLocaleString("en-US")} ${s.currency_symbol}`
        : max > 0
          ? `Stakes up to ${max.toLocaleString("en-US")} ${s.currency_symbol}`
          : "";

  return (
    <div className="space-y-10 py-8 sm:py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold text-white sm:text-5xl">Games</h1>
          <p className="mt-3 text-slate-400">
            {games.length} {games.length === 1 ? "game" : "games"}, all provably fair. Stake your balance and
            every result settles server-side from a seed you can verify.
          </p>
          <Link
            href="/games/verify"
            className="tap mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-300 underline underline-offset-2 hover:text-gold-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            Verify a settled round <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="panel min-w-[13rem] rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your balance</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
            {balance.toFixed(s.currency_decimals)}{" "}
            <span className="text-slate-400">{s.currency_symbol}</span>
          </p>
          {balance > 0 ? (
            limits && <p className="mt-1 text-xs text-slate-400">{limits}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              Empty. Rounds stake your balance, so start with a{" "}
              <Link href="/#plans" className="font-semibold text-gold-300 underline underline-offset-2 hover:text-gold-200">
                reward plan
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      {games.length === 0 ? (
        <div className="panel rounded-2xl p-8 text-center">
          <p className="font-display text-lg font-bold text-white">No games are open right now</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            The operator has paused every table. Your balance is untouched and rewards keep accruing.
          </p>
          <Link
            href="/dashboard"
            className={`mt-5 inline-flex h-11 items-center rounded-xl border border-slate-700 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-gold-500/50 hover:text-white ${cardFocus}`}
          >
            Back to dashboard
          </Link>
        </div>
      ) : (
        GROUPS.map((group) => {
          const list = games.filter((g) => g.pace === group.pace);
          if (list.length === 0) return null;
          return (
            <section key={group.pace} aria-labelledby={`group-${group.pace}`}>
              <div className="mb-4">
                <h2 id={`group-${group.pace}`} className="font-display text-lg font-bold text-white">
                  {group.title}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{group.note}</p>
              </div>
              {group.pace === "step" ? (
                list.map((g) => (
                  <Link
                    key={g.id}
                    href={`/games/${g.id}`}
                    className={`panel group flex flex-col gap-4 rounded-2xl p-5 transition-colors hover:border-gold-500/40 sm:flex-row sm:items-center ${cardFocus}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] tabular-nums text-slate-400">
                          {String((order.get(g.id) ?? 0) + 1).padStart(2, "0")}
                        </span>
                        <Badge variant="gold">{g.category}</Badge>
                      </div>
                      <h3 className="mt-2 font-display text-lg font-bold text-white group-hover:text-gold-300">
                        {g.name}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-400">{g.blurb}</p>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                      <span className="text-xs text-slate-400">{g.edge}</span>
                      <span className="inline-flex h-11 items-center rounded-xl bg-gold-500 px-5 text-sm font-semibold text-ink-950 transition-colors group-hover:bg-gold-400">
                        Play
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div
                  className={
                    group.pace === "fast"
                      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                      : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  }
                >
                  {list.map((g) => (
                    <GameCard key={g.id} game={g} index={order.get(g.id) ?? 0} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      <div className="panel rounded-2xl p-5 text-sm text-slate-400">
        <p className="font-display text-sm font-bold text-white">How it stays fair</p>
        <p className="mt-2">
          Each round mixes a server seed we commit to up front, a client seed you control, and a per-bet nonce
          through HMAC-SHA256. Rotate it to reveal the seed that signed this session, then re-check those
          rounds with the verifier.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          The edge on each card is that game&apos;s base figure. Site payout settings can adjust the final
          return, and every settled round shows exactly what paid.
        </p>
        <Link
          href="/games/verify"
          className="tap mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold-300 underline underline-offset-2 hover:text-gold-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          Open the verifier <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}


