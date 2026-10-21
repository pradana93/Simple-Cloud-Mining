import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCachedSettings } from "@/lib/catalog";
import { BetVerifier } from "@/components/games/bet-verifier";

export const dynamic = "force-dynamic";

export const metadata = { title: "Verify a bet" };

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: { bet?: string | string[]; game?: string | string[] };
}) {
  const s = await getCachedSettings();
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gamesOpen = s.games_enabled;

  return (
    <div className="space-y-6 py-8 sm:py-10">
      <div>
        <Link
          href={gamesOpen ? "/games" : "/account"}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <ChevronLeft size={16} /> {gamesOpen ? "All games" : "Account"}
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-white">Verify a bet</h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Pick a settled round and paste its revealed server seed. The verifier recomputes the result from
          the committed hash, your client seed and the round nonce, without sending the seed back to the
          site.
        </p>
      </div>

      <BetVerifier
        symbol={s.currency_symbol}
        decimals={s.currency_decimals}
        gamesOpen={gamesOpen}
        initialBetKey={one(searchParams.bet)}
        initialGame={one(searchParams.game)}
      />
    </div>
  );
}
