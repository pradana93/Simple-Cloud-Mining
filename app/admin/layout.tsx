"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Contact,
  CreditCard,
  HelpCircle,
  Home,
  Link2,
  Menu,
  Package,
  ScrollText,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  ["Overview", "/admin", Home],
  ["Plans", "/admin/plans", Package],
  ["Users", "/admin/users", Users],
  ["Transactions", "/admin/transactions", CreditCard],
  ["Withdrawals", "/admin/withdrawals", Wallet],
  ["Contact inbox", "/admin/contact", Contact],
  ["FAQs", "/admin/faqs", HelpCircle],
  ["URL chains", "/admin/urlchains", Link2],
  ["IPN logs", "/admin/ipnlogs", ScrollText],
  ["Settings", "/admin/settings", Settings],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex flex-col gap-1 text-sm">
      {links.map(([label, href, Icon]) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 font-medium transition-colors",
              active
                ? "bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/40"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon size={16} /> {label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="glass hidden h-fit rounded-2xl p-4 lg:block">
        <h2 className="font-display px-2 pb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Control tower
        </h2>
        {nav}
      </aside>
      <div className="lg:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="glass inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          {open ? <X size={16} /> : <Menu size={16} />} Admin menu
        </button>
        {open && <div className="glass mt-2 rounded-2xl p-3">{nav}</div>}
      </div>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
