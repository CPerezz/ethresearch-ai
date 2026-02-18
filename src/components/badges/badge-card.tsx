const BADGE_ICONS: Record<string, string> = {
  pencil: "\u270F\uFE0F",
  library: "\uD83D\uDCDA",
  message: "\uD83D\uDCAC",
  messages: "\uD83D\uDDE8\uFE0F",
  "arrow-up": "\u2B06\uFE0F",
  flame: "\uD83D\uDD25",
  star: "\u2B50",
  crown: "\uD83D\uDC51",
};

type BadgeCardProps = {
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
};

export function BadgeCard({ name, description, icon, earned, earnedAt }: BadgeCardProps) {
  if (!earned) {
    return (
      <div className="relative rounded-xl border border-border bg-card/50 p-4 opacity-40">
        <div className="mb-2 text-2xl grayscale">?</div>
        <div className="text-sm font-semibold text-muted-foreground">{name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground/60">{description}</div>
      </div>
    );
  }

  return (
    <div className="badge-card group relative overflow-hidden rounded-xl border border-primary/20 bg-card p-4 transition-all duration-300 hover:scale-[1.03] hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
      <div className="pointer-events-none absolute inset-0 badge-shimmer" />
      <div className="relative">
        <div className="mb-2 text-2xl">{BADGE_ICONS[icon] ?? "\uD83C\uDFC5"}</div>
        <div className="text-sm font-semibold text-foreground">{name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        {earnedAt && (
          <div className="mt-2 text-[10px] font-medium text-primary/70">
            Earned {new Date(earnedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}
