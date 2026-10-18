import Link from "next/link";
import { Link2, Percent, Users } from "lucide-react";
import { getCachedContents, getCachedSettings } from "@/lib/catalog";

export const revalidate = 300;

export default async function AffiliatePage() {
  const [s, c] = await Promise.all([getCachedSettings(), getCachedContents()]);
  return (
    <div className="space-y-10 py-8 sm:py-12">
      <div className="panel rounded-3xl border-gold-500/20 px-6 py-12 sm:px-12">
        <h1 className="font-display max-w-xl text-4xl font-bold leading-tight text-white sm:text-5xl">
          Earn <span className="gold-text">{s.aff_comission}%</span> for life on every referral
          upgrade.
        </h1>
        <p className="mt-4 max-w-lg text-slate-400">
          When someone you invited buys a paid miner, you take {s.aff_comission}% of the purchase.
          It lands straight in your balance.
        </p>
        <Link
          href="/register"
          className="mt-7 inline-flex h-12 items-center rounded-xl bg-gold-500 px-8 font-display text-base font-bold text-ink-950 transition-colors hover:bg-gold-400"
        >
          Get my referral link
        </Link>
      </div>

      <div className="panel divide-y divide-white/10 rounded-3xl">
        {[
          { icon: <Link2 size={18} />, t: "Share your link", d: "After signup you get a personal /referral/ID link." },
          { icon: <Users size={18} />, t: "Friends deploy miners", d: "They start on the free plan; upgrades are optional." },
          { icon: <Percent size={18} />, t: `Take ${s.aff_comission}%`, d: "Commission on every upgrade, for life." },
        ].map((f) => (
          <div key={f.t} className="flex items-start gap-4 p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">
              {f.icon}
            </span>
            <div>
              <h3 className="font-display font-bold text-white">{f.t}</h3>
              <p className="mt-1 text-sm text-slate-400">{f.d}</p>
            </div>
          </div>
        ))}
      </div>

      {c.affiliate && (
        <div className="panel rounded-3xl p-7">
          <div className="prose-dark text-sm" dangerouslySetInnerHTML={{ __html: c.affiliate }} />
        </div>
      )}
    </div>
  );
}
