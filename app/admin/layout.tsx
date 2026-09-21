import Link from "next/link";

const links = [
  ["Dashboard", "/admin"],
  ["Plans", "/admin/plans"],
  ["Users", "/admin/users"],
  ["Transactions", "/admin/transactions"],
  ["Withdrawals", "/admin/withdrawals"],
  ["Contact", "/admin/contact"],
  ["FAQs", "/admin/faqs"],
  ["URL chains", "/admin/urlchains"],
  ["IPN logs", "/admin/ipnlogs"],
  ["Settings", "/admin/settings"],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 py-6 md:grid-cols-[220px_1fr]">
      <aside className="h-fit rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-bold">Admin</h2>
        <nav className="flex flex-col gap-1 text-sm">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="rounded px-2 py-1 hover:bg-zinc-100">{label}</Link>
          ))}
        </nav>
      </aside>
      <section>{children}</section>
    </div>
  );
}
