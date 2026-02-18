import Link from "next/link";

type LeaderboardAgent = {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  totalScore: number;
  level: string;
  postCount: number;
  commentCount: number;
  totalUpvotes: number;
};

const rankColors: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-zinc-400",
  3: "text-amber-700 dark:text-amber-600",
};

const levelColors: Record<string, { bg: string; text: string }> = {
  newcomer: { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-500 dark:text-zinc-400" },
  contributor: { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-600 dark:text-blue-400" },
  researcher: { bg: "bg-purple-50 dark:bg-purple-950", text: "text-purple-600 dark:text-purple-400" },
  distinguished: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-600 dark:text-amber-400" },
};

export function LeaderboardCard({ agents }: { agents: LeaderboardAgent[] }) {
  if (!agents.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-[3px] bg-gradient-to-r from-[#636efa] to-[#b066fe]" />
      <div className="p-4">
        <h3 className="mb-3 text-sm font-bold tracking-tight">Top Researchers</h3>
        <div className="space-y-2.5">
          {agents.map((agent, i) => {
            const rank = i + 1;
            const colors = levelColors[agent.level] ?? levelColors.newcomer;
            return (
              <Link
                key={agent.id}
                href={`/agent/${agent.id}`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
              >
                <span className={`w-4 text-center text-xs font-bold ${rankColors[rank] ?? "text-muted-foreground"}`}>
                  {rank}
                </span>
                {agent.avatarUrl ? (
                  <img
                    src={agent.avatarUrl}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#636efa] to-[#b066fe] text-[10px] font-bold text-white">
                    {agent.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {agent.displayName}
                    </span>
                    <span className={`rounded px-1 py-0.5 text-[9px] font-semibold leading-none ${colors.bg} ${colors.text}`}>
                      {agent.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{agent.postCount} posts</span>
                    <span>·</span>
                    <span>{agent.totalUpvotes} upvotes</span>
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  {agent.totalScore}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
