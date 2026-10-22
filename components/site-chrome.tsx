import Link from "next/link";
import { Wallet } from "lucide-react";
import { getCachedSettings } from "@/lib/catalog";
import { NAV_LINKS } from "./nav-links";
import { SiteHeaderClient } from "./site-header";
import { AnnouncementBanner } from "./announcement";
import { Logo } from "./logo";

export async function SiteHeader() {
  const s = await getCachedSettings();
  return (
    <>
      {s.announce_enabled && s.announce_text ? (
        <AnnouncementBanner text={s.announce_text} link={s.announce_link} />
      ) : null}
      <SiteHeaderClient
        sitename={s.sitename}
        fiatEnabled={s.fiat_enabled}
        cryptoCode={s.currency_code}
      />
    </>
  );
}

export async function SiteFooter() {
  const s = await getCachedSettings();
  const slogan = s.siteslogan.trim().replace(/[.\s]+$/, "");
  return (
    <footer className="mt-20 border-t border-white/10">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <span className="font-display text-lg font-bold text-white">{s.sitename}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            {slogan}. Choose a {s.currency_name} ({s.currency_code}) reward plan, watch it accrue,
            and withdraw on-chain.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Wallet size={13} className="text-gold-400" /> Withdrawals in {s.currency_code}
            </span>
            <span>{s.aff_comission}% affiliate commission on referred upgrades</span>
          </div>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold text-slate-300">Explore</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[...NAV_LINKS, { label: "Dashboard", href: "/dashboard" }].map((l) => (
              <li key={l.href + l.label}>
                <Link href={l.href} className="text-slate-400 hover:text-gold-300">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold text-slate-300">Network</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
            <li>Asset: {s.currency_name} ({s.currency_code})</li>
            <li>Settlement: {s.coin_cur1} / {s.coin_cur2}</li>
            <li>Affiliate: {s.aff_comission}% lifetime</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Â© {new Date().getFullYear()} {s.sitename}. All rights reserved.</span>
          <span>Reward plans involve risk. Past performance does not guarantee future returns.</span>
        </div>
      </div>
    </footer>
  );
}


