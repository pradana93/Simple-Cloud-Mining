import Link from "next/link";
import { Wallet } from "lucide-react";
import { getCachedSettings } from "@/lib/catalog";
import { NAV_LINKS } from "./nav-links";
import { MobileNav } from "./mobile-nav";
import { Logo } from "./logo";

export async function SiteHeader() {
  const s = await getCachedSettings();
  return (
    <header className="glass-nav sticky top-0 z-40 border-b border-white/10">
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
            {s.sitename}
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl bg-gold-500 px-4 py-2 font-display text-sm font-bold text-ink-950 transition-colors hover:bg-gold-400"
          >
            Open console
          </Link>
        </div>
        <MobileNav />
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const s = await getCachedSettings();
  return (
    <footer className="mt-20 border-t border-white/10">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <span className="font-display text-lg font-bold text-white">{s.sitename}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            {s.siteslogan}. Buy {s.currency_name} ({s.currency_code}) hashrate, watch it accrue, and
            withdraw on-chain.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Wallet size={13} className="text-gold-400" /> Withdrawals in {s.currency_code}
            </span>
            <span>{s.aff_comission}% affiliate commission, for life</span>
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
          <span>© {new Date().getFullYear()} {s.sitename}. All rights reserved.</span>
          <span>Mining involves risk. Past performance does not guarantee future returns.</span>
        </div>
      </div>
    </footer>
  );
}
