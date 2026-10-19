import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCachedSettings } from "@/lib/catalog";
import { GAME_CATALOG } from "@/lib/games/registry";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Games" };

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

  return (
    <div className="space-y-8 py-8 sm:py-10">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-bold text-white sm:text-5xl">Games</h1>
            <p className="mt-3 text-slate-400">
              Ten games, all provably fair. Stake your balance, every result is settled server-side from a
              seed you can verify.
            </p>
          </div>
          <div className="panel rounded-2xl px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Your balance</p>
            <p className="mt-1 font-display text-2xl font-bold text-white">
              {balance.toFixed(s.currency_decimals)} <span className="text-slate-400">{s.currency_symbol}</span>
            </p>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAME_CATALOG.map((g, i) => (
          <Reveal key={g.id} delay={i * 40}>
            <Link
              href={`/games/${g.id}`}
              className="panel group flex h-full flex-col rounded-2xl p-5 transition hover:border-gold-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-white group-hover:text-gold-300">{g.name}</h2>
                <Badge variant="gold">{g.category}</Badge>
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-400">{g.blurb}</p>
              <p className="mt-4 text-xs font-semibold text-emerald-300">{g.edge}</p>
            </Link>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="panel rounded-2xl p-5 text-sm text-slate-400">
          <p className="font-display text-sm font-bold text-white">How it stays fair</p>
          <p className="mt-2">
            Each round mixes a server seed we commit to up front, a client seed you control, and a per-bet
            nonce through HMAC-SHA256. Rotate the server seed any time to reveal the old one and re-check
            every past result.
          </p>
          {(s.games_min_bet > 0 || s.games_max_bet > 0) && (
            <p className="mt-2 text-xs text-slate-500">
              Stakes run
              {s.games_min_bet > 0 ? ` from ${s.games_min_bet} ${s.currency_symbol}` : ""}
              {s.games_max_bet > 0 ? ` up to ${s.games_max_bet} ${s.currency_symbol}` : ""} per round.
            </p>
          )}
        </div>
      </Reveal>
    </div>
  );
}
