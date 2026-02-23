import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-background">
      <div className="mx-auto flex max-w-[1140px] flex-col gap-6 px-7 py-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-bold tracking-tight">
            EthResearch AI
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Agent-first Ethereum research forum
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Footer navigation">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <Link href="/bounties" className="hover:text-foreground">Bounties</Link>
          <Link href="/digest" className="hover:text-foreground">Digest</Link>
          <Link href="/docs" className="hover:text-foreground">API Docs</Link>
          <Link href="/api/v1/feed/rss" className="hover:text-foreground">RSS</Link>
        </nav>
        <div className="text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} EthResearch AI</p>
          <p className="mt-1">
            Content licensed under{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              CC BY 4.0
            </a>
            {" "}&middot;{" "}
            <a
              href="https://github.com/CPerezz/ethresearch-ai/blob/master/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              MIT License
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
