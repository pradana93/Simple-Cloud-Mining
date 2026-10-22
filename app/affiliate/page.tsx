import Link from "next/link";
import { headers } from "next/headers";
import { Link2, Percent, Users } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCachedContents, getCachedSettings } from "@/lib/catalog";
import { getMoneyCfg } from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

function Readout({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "gold" | "emerald" }) {
  return (
    <div className="panel min-w-0 rounded-3xl p-5">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p
        className={
          tone === "emerald"
            ? "font-mono mt-1.5 break-words text-2xl font-medium tabular-nums text-emerald-300"
            : tone === "gold"
              ? "font-mono mt-1.5 break-words text-2xl font-medium tabular-nums text-gold-300"
              : "font-mono mt-1.5 break-words text-2xl font-medium tabular-nums text-white"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}

export default async function AffiliatePage() {
  const [s, c] = await Promise.all([getCachedSettings(), getCachedContents()]);
  const cfg = await getMoneyCfg();

  const supabase = createServerSupabase();
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user.id ?? null;
  } catch {
    userId = null;
  }

  let uniqueId: number | null = null;
  let earns = 0;
  let paid = 0;
  let invited = 0;
  if (userId) {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("unique_id,affiliate_earns,affiliate_paid")
        .eq("id", userId)
        .maybeSingle();
      if (prof) {
        uniqueId = (prof as { unique_id: number }).unique_id;
        earns = Number((prof as { affiliate_earns: number }).affiliate_earns);
        paid = Number((prof as { affiliate_paid: number }).affiliate_paid);
      }
    } catch {
      // Profile not resolved yet; the page still explains the program.
    }
    try {
      // Service role: the profiles policy hides other members from the anon key,
      // so counting the downline has to happen server-side, scoped to this user.
      const admin = createAdminSupabase();
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("reference_user_id", userId);
      invited = count ?? 0;
    } catch {
      invited = 0;
    }
  }

  const h = await headers();
  const referralLink = (() => {
    if (!uniqueId) return "";
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host && host.includes("localhost") ? "http" : "https");
    const base = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || "";
    return `${base}/referral/${uniqueId}`;
  })();

  const steps = [
    { icon: <Link2 size={18} />, t: "Share your link", d: "Every account gets a personal /referral/ID link." },
    { icon: <Users size={18} />, t: "Friends choose plans", d: "They start on the free plan; upgrades are optional." },
            { icon: <Percent size={18} />, t: `Take ${s.aff_comission}%`, d: "Commission on every referred upgrade." },
  ];

  return (
    <div className="space-y-6 py-8 sm:py-12">
      <section className="panel rounded-3xl border-gold-500/20 p-6 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-300">Affiliate program</p>
        <h1 className="font-display mt-2 max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl">
          Earn <span className="gold-text">{s.aff_comission}%</span> on every referral upgrade.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
          When someone you invited buys a reward plan, you take {s.aff_comission}% of the purchase.
          It lands straight in your balance, and keeps paying on every upgrade they make.
        </p>

        {userId ? (
          <div className="mt-7">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Link2 size={13} /> Your referral link
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-xl bg-ink-950/70 px-3.5 py-3 font-mono text-xs text-slate-200 ring-1 ring-white/10">
                {referralLink}
              </code>
              <CopyButton text={referralLink} label="Copy link" />
            </div>
          </div>
        ) : (
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="tap inline-flex h-12 items-center rounded-xl bg-gold-500 px-7 font-display text-base font-bold text-ink-950 transition-colors hover:bg-gold-400"
            >
              Create a free account
            </Link>
            <Link
              href="/login"
              className="tap panel inline-flex h-12 items-center rounded-xl px-7 font-display text-base font-semibold text-white transition-colors hover:border-gold-500/40"
            >
              Sign in
            </Link>
          </div>
        )}
      </section>

      {userId ? (
        <section aria-label="Your affiliate numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Readout label="Invited" hint="members you referred" value={String(invited)} />
          <Readout label="Earned" hint="lifetime, before fees" value={formatMoney(earns, cfg)} tone="emerald" />
          <Readout label="Paid out" hint="already settled to you" value={formatMoney(paid, cfg)} />
          <Readout label="Commission" hint="per referred upgrade" value={`${s.aff_comission}%`} tone="gold" />
        </section>
      ) : (
        <section className="panel divide-y divide-white/10 rounded-3xl">
          {steps.map((f) => (
            <div key={f.t} className="flex items-start gap-4 p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-500/15 text-gold-300">{f.icon}</span>
              <div>
                <h3 className="font-display font-bold text-white">{f.t}</h3>
                <p className="mt-1 text-sm text-slate-400">{f.d}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {c.affiliate && (
        <section className="panel rounded-3xl p-6 sm:p-7">
          <div className="prose-dark text-sm" dangerouslySetInnerHTML={{ __html: c.affiliate }} />
        </section>
      )}
    </div>
  );
}

