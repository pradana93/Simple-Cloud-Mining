import Link from "next/link";
import { getSettings } from "@/lib/settings";

export async function SiteHeader() {
  const s = await getSettings();
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
        <Link href="/" className="text-xl font-bold">⛏️ {s.sitename}</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/affiliate">Affiliate</Link>
          <Link href="/payouts">Payouts</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/dashboard" className="font-semibold">Dashboard</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const s = await getSettings();
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-4 text-sm text-zinc-500">
        <span>© {new Date().getFullYear()} {s.sitename} — {s.siteslogan}</span>
        <span>{s.currency_name} ({s.currency_code}) cloud mining</span>
      </div>
    </footer>
  );
}
