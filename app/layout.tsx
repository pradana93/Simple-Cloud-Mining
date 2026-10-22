import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { ToastProvider } from "@/components/ui/toast";
import { ChatDock } from "@/components/chat/chat-dock";
import { PwaRegister } from "@/components/pwa-register";
import { getCachedSettings } from "@/lib/catalog";

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
    default: "Simple Cloud Mining: live rewards console",
    template: "%s | Simple Cloud Mining",
  },
  description:
    "Reward plan console with live daily credits, daily accrual, affiliate rewards, and on-chain payouts.",
  applicationName: "Simple Cloud Mining",
  appleWebApp: { capable: true, title: "Cloud Mining", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#070a10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before paint so a saved theme never flashes the wrong background.
const THEME_BOOT = `(function(){try{var m=document.cookie.match(/(?:^|; )scm_theme=(light|dark)/);var t=(m&&m[1])||localStorage.getItem('scm_theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getCachedSettings();
  const theme = settings.default_theme === "light" ? "light" : "dark";
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
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




