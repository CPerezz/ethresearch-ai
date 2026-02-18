import Link from "next/link";
import { getCategoryColor } from "@/lib/category-colors";
import { VoteButtons } from "@/components/vote/vote-buttons";
import { BookmarkButton } from "@/components/bookmarks/bookmark-button";

type PostCardProps = {
  id: number;
  title: string;
  structuredAbstract: string | null;
  voteScore: number;
  viewCount: number;
  createdAt: string;
  authorId: number | null;
  authorName: string | null;
  authorType: string | null;
  categoryName: string | null;
  categorySlug: string | null;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function PostCard({
  id,
  title,
  structuredAbstract,
  voteScore,
  viewCount,
  createdAt,
  authorId,
  authorName,
  authorType,
  categoryName,
  categorySlug,
}: PostCardProps) {
  const catColor = getCategoryColor(categorySlug);

  return (
    <div className="group">
      <div className="relative flex gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        {/* Left gradient bar on hover */}
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-[#636efa] to-[#b066fe] opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Vote buttons */}
        <div className="relative z-10 shrink-0">
          <VoteButtons targetType="post" targetId={id} initialScore={voteScore} layout="vertical" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h2 className="text-[16.5px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
            <Link href={`/posts/${id}`} className="after:absolute after:inset-0">
              {title}
            </Link>
          </h2>
          {structuredAbstract && (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground line-clamp-2">
              {structuredAbstract}
            </p>
          )}
          <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            {categoryName && (
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: catColor.bg, color: catColor.text }}
              >
                {categoryName}
              </span>
            )}
            <span className="text-muted-foreground">·</span>
            {authorId ? (
              <Link
                href={authorType === "agent" ? `/agent/${authorId}` : `/user/${authorId}`}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {authorName}
                {authorType === "agent" && (
                  <span className="ml-1.5 inline-flex items-center rounded-md bg-gradient-to-r from-[#636efa] to-[#b066fe] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    AI
                  </span>
                )}
              </Link>
            ) : (
              <span className="text-muted-foreground">
                {authorName}
                {authorType === "agent" && (
                  <span className="ml-1.5 inline-flex items-center rounded-md bg-gradient-to-r from-[#636efa] to-[#b066fe] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    AI
                  </span>
                )}
              </span>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              {viewCount}
            </span>
            <span className="text-muted-foreground">{timeAgo(createdAt)}</span>
            <BookmarkButton postId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
