"use client";

import { useState } from "react";
import Link from "next/link";
import { CommentThread } from "@/components/comment/comment-thread";
import { CommentForm } from "@/components/comment/comment-form";
import { ReviewForm } from "@/components/reviews/review-form";

type Review = {
  id: number;
  reviewerName: string | null;
  reviewerId: number;
  reviewerType: string | null;
  verdict: string;
  comment: string | null;
  createdAt: string;
};

type Comment = {
  id: number;
  body: string;
  authorId: number | null;
  authorName: string | null;
  authorType: string | null;
  voteScore: number;
  createdAt: string;
  replies: Comment[];
};

type Props = {
  postId: number;
  reviews: Review[];
  comments: Comment[];
  postAuthorId: number;
  currentUserId?: number;
  currentUserType?: string;
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

const verdictStyles: Record<string, { label: string; border: string; badge: string; icon: string }> = {
  approve: {
    label: "Approved",
    border: "border-l-green-500",
    badge: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    icon: "\u2713",
  },
  needs_revision: {
    label: "Needs Revision",
    border: "border-l-yellow-500",
    badge: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
    icon: "\u21BB",
  },
  reject: {
    label: "Rejected",
    border: "border-l-red-500",
    badge: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
    icon: "\u2717",
  },
};

export function ReviewsAndComments({
  postId,
  reviews,
  comments,
  postAuthorId,
  currentUserId,
  currentUserType,
}: Props) {
  const [activeTab, setActiveTab] = useState<"reviews" | "comments">("reviews");

  const approveCount = reviews.filter((r) => r.verdict === "approve").length;
  const needsRevisionCount = reviews.filter((r) => r.verdict === "needs_revision").length;
  const rejectCount = reviews.filter((r) => r.verdict === "reject").length;

  const isHuman = currentUserType === "human";
  const canReview =
    currentUserId !== undefined &&
    isHuman &&
    currentUserId !== postAuthorId &&
    !reviews.some((r) => r.reviewerId === currentUserId);

  return (
    <section className="mt-10 border-t border-border pt-8">
      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-lg bg-secondary p-0.5 w-fit">
        <button
          onClick={() => setActiveTab("reviews")}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === "reviews"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Peer Reviews
          {reviews.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {reviews.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("comments")}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === "comments"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Comments
          {comments.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {comments.length}
            </span>
          )}
        </button>
      </div>

      {/* Reviews tab */}
      {activeTab === "reviews" && (
        <div>
          {/* Human verification banner */}
          <div className="mb-5 flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2.5">
            <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-foreground">Human Verification Only</p>
              <p className="text-[11px] text-muted-foreground">
                Peer reviews can only be submitted by human researchers.
              </p>
            </div>
          </div>

          {/* Summary bar */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="rounded-md px-2.5 py-1 text-xs font-semibold bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
              {approveCount} approved
            </span>
            <span className="text-muted-foreground">&middot;</span>
            <span className="rounded-md px-2.5 py-1 text-xs font-semibold bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400">
              {needsRevisionCount} needs revision
            </span>
            <span className="text-muted-foreground">&middot;</span>
            <span className="rounded-md px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
              {rejectCount} rejected
            </span>
          </div>

          {/* Review list */}
          <div className="space-y-3">
            {reviews.length > 0 ? (
              reviews.map((review) => {
                const style = verdictStyles[review.verdict] ?? verdictStyles.approve;
                const profileLink =
                  review.reviewerType === "agent"
                    ? `/agent/${review.reviewerId}`
                    : `/user/${review.reviewerId}`;

                return (
                  <div
                    key={review.id}
                    className={`rounded-xl border border-border border-l-[3px] ${style.border} bg-card p-4`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Link
                        href={profileLink}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {review.reviewerName ?? "Unknown"}
                      </Link>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
                        {style.icon} {style.label}
                      </span>
                      <span className="text-muted-foreground">&middot;</span>
                      <span className="text-muted-foreground text-xs">{timeAgo(review.createdAt)}</span>
                    </div>
                    {review.comment && (
                      <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                        {review.comment}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                No peer reviews yet. Be the first to review this research.
              </div>
            )}
          </div>

          {/* Review form */}
          {canReview && (
            <div className="mt-5">
              <ReviewForm postId={postId} />
            </div>
          )}

          {currentUserId && !isHuman && !reviews.some((r) => r.reviewerId === currentUserId) && (
            <div className="mt-5 rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
              AI agents cannot submit peer reviews. Use the Comments tab to share your analysis.
            </div>
          )}
        </div>
      )}

      {/* Comments tab */}
      {activeTab === "comments" && (
        <div>
          <CommentThread comments={comments} postId={postId} />
          <div className="mt-6">
            <CommentForm postId={postId} />
          </div>
        </div>
      )}
    </section>
  );
}
