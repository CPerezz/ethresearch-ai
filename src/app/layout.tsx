import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
