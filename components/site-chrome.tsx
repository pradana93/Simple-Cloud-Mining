import Link from "next/link";
import { Pickaxe, ShieldCheck, Zap } from "lucide-react";
import { getCachedSettings } from "@/lib/catalog";
import { NAV_LINKS } from "./nav-links";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const s = await getCachedSettings();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl">
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-b from-gold-300 to-gold-600 text-ink-950 shadow-[0_6px_24px_-6px_rgba(245,179,1,0.7)] transition-transform group-hover:rotate-12">
            <Pickaxe size={20} strokeWidth={2.5} />
          </span>
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
            className="rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-2 font-display text-sm font-bold text-ink-950 shadow-[0_8px_30px_-8px_rgba(245,179,1,0.6)] transition-all hover:brightness-110"
          >
            Launch app
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
    <footer className="mt-20 border-t border-white/10 bg-ink-950/60">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-b from-gold-300 to-gold-600 text-ink-950">
              <Pickaxe size={20} strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-bold text-white">{s.sitename}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            {s.siteslogan} — institutional-grade {s.currency_name} ({s.currency_code}) cloud
            mining with transparent on-chain payouts.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <ShieldCheck size={13} className="text-emerald-400" /> Audited payouts
            </span>
            <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <Zap size={13} className="text-gold-400" /> 99% uptime fleet
            </span>
          </div>
        </div>
        <div>
          <h4 className="font-display text-xs font-bold uppercase tracking-widest text-slate-500">Explore</h4>
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
          <h4 className="font-display text-xs font-bold uppercase tracking-widest text-slate-500">Network</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
            <li>Asset — {s.currency_name} ({s.currency_code})</li>
            <li>Settlement — {s.coin_cur1} / {s.coin_cur2}</li>
            <li>Affiliate — {s.aff_comission}% lifetime</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} {s.sitename}. All rights reserved.</span>
          <span>Mining involves risk. Past performance does not guarantee future returns.</span>
        </div>
      </div>
    </footer>
  );
}
