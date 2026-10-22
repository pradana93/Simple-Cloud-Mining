import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCachedSettings } from "@/lib/catalog";
import { gameMeta } from "@/lib/games/registry";
import { casinoEcon, isGameDisabled } from "@/lib/games/econ";
import { Badge } from "@/components/ui/badge";
import { GameView } from "@/components/games/game-view";
import { MinesView } from "@/components/games/mines-view";
import { CrashView } from "@/components/games/crash-view";
import { GameRules } from "@/components/games/game-rules";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const meta = gameMeta(game);
  return { title: meta ? meta.name : "Game" };
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const meta = gameMeta(game);
  const s = await getCachedSettings();
  const econ = casinoEcon(s);
  if (!meta || !s.games_enabled || isGameDisabled(econ, game)) notFound();

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

  return (
    <div className="space-y-6 py-8 sm:py-10">
      <div>
        <Link
          href="/games"
          className="inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <ChevronLeft size={16} /> All games
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold text-white">{meta.name}</h1>
          <Badge variant="gold">{meta.category}</Badge>
          <span className="text-xs font-semibold text-slate-400">{meta.edge}</span>
        </div>
        <p className="mt-2 max-w-2xl text-slate-400">{meta.blurb}</p>
      </div>

      <GameRules
        meta={meta}
        econ={econ}
        code={s.currency_code}
        decimals={s.currency_decimals}
      />

      {meta.id === "crash" ? (
        <CrashView
          symbol={s.currency_symbol}
          decimals={s.currency_decimals}
          balance={balance}
          minBet={econ.minBet}
          maxBet={econ.maxBet}
        />
      ) : meta.interactive ? (
        <MinesView
          symbol={s.currency_symbol}
          decimals={s.currency_decimals}
          balance={balance}
          minBet={econ.minBet}
          maxBet={econ.maxBet}
        />
      ) : (
        <GameView
          id={meta.id}
          name={meta.name}
          blurb={meta.blurb}
          symbol={s.currency_symbol}
          decimals={s.currency_decimals}
          balance={balance}
          minBet={econ.minBet}
          maxBet={econ.maxBet}
        />
      )}
    </div>
  );
}
