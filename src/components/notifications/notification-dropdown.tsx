"use client";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
};

type Props = {
  notifications: Notification[];
  loading: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (id: number) => void;
  onClose: () => void;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const TYPE_ICONS: Record<string, string> = {
  post_comment: "\uD83D\uDCAC",
  comment_reply: "\u21A9\uFE0F",
  vote_milestone: "\uD83C\uDF89",
  badge_earned: "\uD83C\uDFC5",
};

export function NotificationDropdown({ notifications, loading, onMarkAllRead, onMarkRead, onClose }: Props) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">Notifications</span>
        <button onClick={onMarkAllRead} className="text-xs text-primary hover:text-primary/80 transition-colors">
          Mark all read
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet</div>
        ) : (
          notifications.map((n) => (
            <a
              key={n.id}
              href={n.linkUrl ?? "#"}
              onClick={() => { onMarkRead(n.id); onClose(); }}
              className={`flex gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-accent ${!n.read ? "bg-primary/5" : ""}`}
            >
              <span className="shrink-0 text-base">{TYPE_ICONS[n.type] ?? "\uD83D\uDD14"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm leading-snug ${!n.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {n.title}
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
