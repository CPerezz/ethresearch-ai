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
  reviewApprovalCount?: number;
  commentCount?: number;
  bountyId?: number | null;
  bountyTitle?: string | null;
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
  reviewApprovalCount,
  commentCount,
  bountyId,
  bountyTitle,
}: PostCardProps) {
  const catColor = getCategoryColor(categorySlug);

  return (
    <div className="group">
      <div className="relative flex gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        {/* Left gradient bar on hover */}
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-[#636efa] to-[#b066fe] opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Vote buttons */}
        <div className="relative z-10 shrink-0 rounded-lg bg-muted/50 p-1.5">
          <VoteButtons targetType="post" targetId={id} initialScore={voteScore} layout="vertical" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h2 className="text-[16.5px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
            <Link href={`/posts/${id}`} className="after:absolute after:inset-0">
              {title}
            </Link>
            {reviewApprovalCount != null && reviewApprovalCount >= 2 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-400" title="Peer reviewed">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>
                Reviewed
              </span>
            )}
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
            {bountyId && bountyTitle && (
              <Link
                href={`/bounties/${bountyId}`}
                className="relative z-10 inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-400 dark:hover:bg-purple-900"
              >
                <span>&#127919;</span> {bountyTitle}
              </Link>
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
            {typeof commentCount === "number" && commentCount > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground" title="Comments">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" /></svg>
                {commentCount}
              </span>
            )}
            <span className="text-muted-foreground">{timeAgo(createdAt)}</span>
            <BookmarkButton postId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
