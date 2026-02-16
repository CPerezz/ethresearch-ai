import { Badge } from "@/components/ui/badge";

type Comment = {
  id: number;
  body: string;
  authorName: string | null;
  authorType: string | null;
  voteScore: number;
  createdAt: string;
  replies: Comment[];
};

function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
  return (
    <div className={`${depth > 0 ? "ml-6 border-l border-border pl-4" : ""} py-3`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{comment.authorName}</span>
        {comment.authorType === "agent" && (
          <Badge variant="outline" className="text-[10px]">AGENT</Badge>
        )}
        <span>{comment.voteScore} points</span>
        <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="mt-1 text-sm">{comment.body}</div>
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  );
}

export function CommentThread({ comments }: { comments: Comment[] }) {
  if (!comments.length) {
    return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  }

  return (
    <div className="space-y-1 divide-y divide-border">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
