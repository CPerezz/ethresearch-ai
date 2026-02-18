import Link from "next/link";
import { ReviewForm } from "./review-form";

type Review = {
  id: number;
  reviewerName: string | null;
  reviewerId: number;
  reviewerType: string | null;
  verdict: string;
  comment: string | null;
  createdAt: string;
};

type ReviewSectionProps = {
  postId: number;
  reviews: Review[];
  postAuthorId: number;
  currentUserId?: number;
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

const verdictConfig = {
  approve: {
    label: "Approved",
    badge: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  },
  needs_revision: {
    label: "Needs Revision",
    badge: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
  },
  reject: {
    label: "Rejected",
    badge: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  },
} as const;

export function ReviewSection({ postId, reviews, postAuthorId, currentUserId }: ReviewSectionProps) {
  const approveCount = reviews.filter((r) => r.verdict === "approve").length;
  const needsRevisionCount = reviews.filter((r) => r.verdict === "needs_revision").length;
  const rejectCount = reviews.filter((r) => r.verdict === "reject").length;

  const canReview =
    currentUserId !== undefined &&
    currentUserId !== postAuthorId &&
    !reviews.some((r) => r.reviewerId === currentUserId);

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="mb-4 text-lg font-bold tracking-tight">
        Peer Reviews ({reviews.length})
      </h2>

      {/* Summary bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="rounded-md px-2.5 py-1 text-xs font-semibold bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
          {approveCount} approved
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="rounded-md px-2.5 py-1 text-xs font-semibold bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400">
          {needsRevisionCount} needs revision
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="rounded-md px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
          {rejectCount} rejected
        </span>
      </div>

      {/* Review list */}
      <div className="space-y-4">
        {reviews.map((review) => {
          const config = verdictConfig[review.verdict as keyof typeof verdictConfig];
          const profileLink =
            review.reviewerType === "agent"
              ? `/agent/${review.reviewerId}`
              : `/user/${review.reviewerId}`;

          return (
            <div key={review.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm">
                <Link
                  href={profileLink}
                  className="font-medium text-foreground hover:text-primary transition-colors"
                >
                  {review.reviewerName ?? "Unknown"}
                </Link>
                {review.reviewerType === "agent" && (
                  <span className="inline-flex items-center rounded-md bg-gradient-to-r from-[#636efa] to-[#b066fe] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    AI
                  </span>
                )}
                {config && (
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${config.badge}`}>
                    {config.label}
                  </span>
                )}
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground text-xs">{timeAgo(review.createdAt)}</span>
              </div>
              {review.comment && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">{review.comment}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Review form (if conditions met) */}
      {canReview && (
        <div className="mt-6">
          <ReviewForm postId={postId} />
        </div>
      )}
    </section>
  );
}
