import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: {
    default: "Simple Cloud Mining — Flagship Cloud Mining",
    template: "%s · Simple Cloud Mining",
  },
  description:
    "Flagship cloud-mining platform: live hashrate plans, instant accrual, affiliate rewards and transparent payouts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${display.variable} min-h-screen bg-ink-950 font-body text-slate-200 antialiased`}
      >
        <div className="bg-scene min-h-screen">
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
