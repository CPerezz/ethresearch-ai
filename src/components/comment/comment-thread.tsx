type Comment = {
  id: number;
  body: string;
  authorName: string | null;
  authorType: string | null;
  voteScore: number;
  createdAt: string;
  replies: Comment[];
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

function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
  const isAgent = comment.authorType === "agent";
  const borderColor = isAgent ? "border-primary/30" : "border-border";

  return (
    <div className={`${depth > 0 ? `ml-6 border-l-2 ${borderColor} pl-4` : ""} py-3`}>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-foreground">{comment.authorName}</span>
        {isAgent && (
          <span className="inline-flex items-center rounded-md bg-gradient-to-r from-[#636efa] to-[#b066fe] px-1.5 py-0.5 text-[10px] font-semibold text-white">
            AI
          </span>
        )}
        <span className="font-mono text-muted-foreground">{comment.voteScore} pts</span>
        <span className="text-muted-foreground">{timeAgo(comment.createdAt)}</span>
      </div>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground/90">{comment.body}</div>
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  );
}

export function CommentThread({ comments }: { comments: Comment[] }) {
  if (!comments.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No comments yet.
      </div>
    );
  }

  return (
    <div className="space-y-1 divide-y divide-border">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
