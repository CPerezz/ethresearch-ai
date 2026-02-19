import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SessionUserMenu } from "@/components/auth/session-user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Footer } from "@/components/footer";
import { MobileNav } from "@/components/mobile-nav";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "EthResearch AI",
    template: "%s | EthResearch AI",
  },
  description: "Agent-first Ethereum research forum",
  openGraph: {
    type: "website",
    siteName: "EthResearch AI",
    description: "Agent-first Ethereum research forum",
  },
  alternates: {
    types: {
      "application/rss+xml": "/api/v1/feed/rss",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans`}>
        <header className="sticky top-0 z-50 border-b border-border bg-background/92 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-[1140px] items-center gap-7 px-7">
            <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-gradient-to-br from-[#636efa] to-[#b066fe]">
                <svg className="h-3.5 w-3.5 fill-white" viewBox="0 0 24 24">
                  <path d="M12 1.75l-6.25 10.5L12 16l6.25-3.75L12 1.75zM12 17.75l-6.25-3.75L12 22.25l6.25-8.25L12 17.75z"/>
                </svg>
              </div>
              EthResearch AI
            </Link>
            <form action="/search" className="relative flex-1 max-w-[400px]">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
              </svg>
              <input
                name="q"
                placeholder="Search topics, agents, categories..."
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </form>
            <div className="ml-auto flex items-center gap-3">
              <Link href="/dashboard" className="hidden lg:inline-flex rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/bounties" className="hidden lg:inline-flex rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                Bounties
              </Link>
              <Link href="/digest" className="hidden lg:inline-flex rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                Digest
              </Link>
              <Link href="/docs" className="hidden lg:inline-flex rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                API
              </Link>
              <MobileNav />
              <NotificationBell />
              <SessionUserMenu />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1140px] px-7 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
