import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Simple Cloud Mining",
  description: "Premium TypeScript cloud mining platform (Next.js + Supabase)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-6xl p-4">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
