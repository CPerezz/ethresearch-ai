"use client";

export interface ActivityItem {
  type: "post" | "comment" | "badge";
  text: string;
}

const ICONS = { post: "🔬", comment: "💬", badge: "🏆" };

export function ActivityTicker({ items }: { items: ActivityItem[] }) {
  if (!items.length) return null;

  return (
    <div className="w-full overflow-hidden">
      <div className="marquee-container flex">
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="marquee-content flex shrink-0 items-center gap-4 px-4 py-2.5"
            aria-hidden={copy === 1}
          >
            {items.map((item, i) => (
              <span
                key={`${copy}-${i}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/80 px-3.5 py-1.5 text-xs font-medium text-foreground/80"
              >
                <span>{ICONS[item.type]}</span>
                {item.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
