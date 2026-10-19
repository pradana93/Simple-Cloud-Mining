"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NAV_LINKS } from "./nav-links";
import { Logo } from "./logo";
import { CurrencyToggle } from "./fx/currency-toggle";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeaderClient({
  sitename,
  fiatEnabled,
  cryptoCode,
}: {
  sitename: string;
  fiatEnabled: boolean;
  cryptoCode: string;
}) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // null until the session is read from the cookie on the client, so a signed-in
  // member never sees a stale "Sign in" action.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setAuthed(Boolean(data.session));
      })
      .catch(() => {
        if (alive) setAuthed(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the call fails, bounce home so the server re-evaluates.
    }
    window.location.href = "/";
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "glass-nav sticky top-0 z-40 border-b transition-colors duration-200",
        scrolled ? "border-white/10" : "border-transparent"
      )}
    >
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 transition-[height] duration-200 sm:px-6",
          scrolled ? "h-14" : "h-16"
        )}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
            {sitename}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  active ? "text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {l.label}
                <span
                  className={cn(
                    "absolute inset-x-3 -bottom-0.5 h-px origin-left bg-gold-500 transition-transform duration-200",
                    active ? "scale-x-100" : "scale-x-0"
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <CurrencyToggle enabled={fiatEnabled} cryptoCode={cryptoCode} className="mr-1" />
          <ThemeToggle />
          {authed === null ? (
            <span className="inline-block h-9 w-24" aria-hidden />
          ) : authed ? (
            <button
              onClick={signOut}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/dashboard"
            className="tap rounded-xl bg-gold-500 px-4 py-2 font-display text-sm font-bold text-ink-950 hover:bg-gold-400"
          >
            Open console
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="tap panel inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div
        className={cn(
          "border-white/5 transition-[max-height,opacity] duration-300 md:hidden",
          open ? "max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t opacity-100" : "max-h-0 overflow-hidden opacity-0"
        )}
      >
        <div className="panel m-3 rounded-2xl p-3">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 md:hidden">
            <span className="text-xs font-medium text-slate-400">Appearance</span>
            <ThemeToggle />
          </div>
          <div className="mt-2 border-t border-white/10 pt-3">
            <CurrencyToggle enabled={fiatEnabled} cryptoCode={cryptoCode} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
            {authed === null ? (
              <span className="rounded-xl border border-white/10 px-4 py-2.5" aria-hidden />
            ) : authed ? (
              <button
                onClick={signOut}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-center text-sm font-semibold text-slate-200"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-center text-sm font-semibold"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-gold-500 px-4 py-2.5 text-center text-sm font-bold text-ink-950"
            >
              Open console
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
