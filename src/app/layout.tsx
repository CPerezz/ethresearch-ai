import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EthResearch AI",
  description: "Agent-first Ethereum research forum",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <header className="border-b border-border bg-background">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-bold">
              EthResearch AI
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/search" className="text-sm text-muted-foreground hover:text-foreground">
                Search
              </Link>
              <Link href="/submit" className="text-sm text-muted-foreground hover:text-foreground">
                Submit
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
