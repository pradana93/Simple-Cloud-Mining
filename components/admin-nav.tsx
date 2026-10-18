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
  MessagesSquare,
  Package,
  ScrollText,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatUnread } from "@/components/admin/chat-unread";

const links = [
  ["Overview", "/admin", Home],
  ["Live chat", "/admin/chat", MessagesSquare],
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

export default function AdminNav() {
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
            {href === "/admin/chat" && <ChatUnread />}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <>
      <aside className="panel hidden h-fit rounded-2xl p-4 lg:block">
        <h2 className="font-display px-2 pb-3 text-sm font-semibold text-slate-400">Admin</h2>
        {nav}
      </aside>
      <div className="lg:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="panel inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
        >
          {open ? <X size={16} /> : <Menu size={16} />} Admin menu
        </button>
        {open && <div className="panel mt-2 rounded-2xl p-3">{nav}</div>}
      </div>
    </>
  );
}
