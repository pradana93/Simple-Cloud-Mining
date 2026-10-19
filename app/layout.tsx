import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { ToastProvider } from "@/components/ui/toast";
import { ChatDock } from "@/components/chat/chat-dock";
import { PwaRegister } from "@/components/pwa-register";

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});
const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Simple Cloud Mining: live hashrate console",
    template: "%s · Simple Cloud Mining",
  },
  description:
    "Cloud mining console with live hashrate plans, per-block accrual, affiliate rewards, and on-chain payouts.",
  applicationName: "Simple Cloud Mining",
  appleWebApp: { capable: true, title: "Cloud Mining", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#070a10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${body.variable} ${display.variable} ${mono.variable} min-h-screen bg-ink-950 font-body text-slate-200 antialiased`}
      >
        <ToastProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</main>
          <SiteFooter />
          <ChatDock />
          <PwaRegister />
        </ToastProvider>
      </body>
    </html>
  );
}
