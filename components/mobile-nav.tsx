"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
        aria-expanded={open}
        className="panel inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <div className="panel absolute inset-x-4 top-16 z-50 rounded-2xl p-3 shadow-lg">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-center text-sm font-semibold"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-gold-500 px-4 py-2.5 text-center text-sm font-bold text-ink-950"
            >
              Open console
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
