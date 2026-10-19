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

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { game: string } }) {
  const meta = gameMeta(params.game);
  return { title: meta ? meta.name : "Game" };
}

export default async function GamePage({ params }: { params: { game: string } }) {
  const meta = gameMeta(params.game);
  const s = await getCachedSettings();
  if (!meta || !s.games_enabled || isGameDisabled(casinoEcon(s), params.game)) notFound();

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
        <Link href="/games" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ChevronLeft size={16} /> All games
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold text-white">{meta.name}</h1>
          <Badge variant="gold">{meta.category}</Badge>
          <span className="text-xs font-semibold text-emerald-300">{meta.edge}</span>
        </div>
        <p className="mt-2 max-w-2xl text-slate-400">{meta.blurb}</p>
      </div>

      {meta.interactive ? (
        <MinesView symbol={s.currency_symbol} decimals={s.currency_decimals} balance={balance} />
      ) : (
        <GameView
          id={meta.id}
          name={meta.name}
          blurb={meta.blurb}
          symbol={s.currency_symbol}
          decimals={s.currency_decimals}
          balance={balance}
        />
      )}
    </div>
  );
}
