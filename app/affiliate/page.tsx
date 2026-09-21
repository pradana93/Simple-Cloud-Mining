import Link from "next/link";
import { Gift, Link2, Percent, Users } from "lucide-react";
import { getCachedContents, getCachedSettings } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";

export const revalidate = 300;

export default async function AffiliatePage() {
  const [s, c] = await Promise.all([getCachedSettings(), getCachedContents()]);
  return (
    <div className="space-y-10 py-8 sm:py-12">
      <div className="relative overflow-hidden rounded-3xl border border-gold-500/25 bg-gradient-to-br from-gold-500/[0.12] via-ink-900 to-ink-900 px-6 py-12 text-center sm:px-12">
        <div className="absolute left-1/2 top-0 h-40 w-[36rem] -translate-x-1/2 rounded-full bg-gold-500/20 blur-[100px]" aria-hidden="true" />
        <Badge variant="gold" className="relative"><Gift size={12} /> Affiliate program</Badge>
        <h1 className="font-display relative mt-4 text-4xl font-bold text-white sm:text-5xl">
          Earn <span className="gold-text">{s.aff_comission}%</span> forever
        </h1>
        <p className="relative mx-auto mt-4 max-w-lg text-slate-400">
          Every time someone you invited upgrades a miner, you take {s.aff_comission}% —
          credited straight to your balance.
        </p>
        <Link
          href="/register"
          className="relative mt-7 inline-flex h-12 items-center rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-8 font-display text-base font-bold text-ink-950 transition-all hover:brightness-110"
        >
          Get my referral link
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {[
          { icon: <Link2 size={20} />, t: "Share your link", d: "After signup you get a personal /referral/ID link." },
          { icon: <Users size={20} />, t: "Friends deploy miners", d: "They mine — free plan included, upgrades optional." },
          { icon: <Percent size={20} />, t: `Take ${s.aff_comission}%`, d: "Commission on every upgrade, for life." },
        ].map((f, i) => (
          <div key={f.t} className="glass card-hover rounded-3xl p-6">
            <span className="font-display text-2xl font-bold text-gold-500/60">0{i + 1}</span>
            <span className="mt-3 grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">{f.icon}</span>
            <h3 className="font-display mt-3 font-bold text-white">{f.t}</h3>
            <p className="mt-1 text-sm text-slate-400">{f.d}</p>
          </div>
        ))}
      </div>

      {c.affiliate && (
        <div className="glass rounded-3xl p-7">
          <div className="prose-dark text-sm" dangerouslySetInnerHTML={{ __html: c.affiliate }} />
        </div>
      )}
    </div>
  );
}
