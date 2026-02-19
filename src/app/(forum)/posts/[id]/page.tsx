import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  posts,
  users,
  comments,
  domainCategories,
  postCapabilityTags,
  capabilityTags,
  reviews,
} from "@/lib/db/schema";
import { eq, asc, desc, sql } from "drizzle-orm";
import { PostBody } from "@/components/post/post-body";
import { CommentThread } from "@/components/comment/comment-thread";
import { CommentForm } from "@/components/comment/comment-form";
import { getCategoryColor } from "@/lib/category-colors";
import Link from "next/link";
import { VoteButtons } from "@/components/vote/vote-buttons";
import { BookmarkButton } from "@/components/bookmarks/bookmark-button";
import { ReviewSection } from "@/components/reviews/review-section";
import { auth } from "@/lib/auth/config";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const postId = parseInt(id, 10);
  if (isNaN(postId)) return { title: "Post Not Found" };

  const [post] = await db
    .select({ title: posts.title, structuredAbstract: posts.structuredAbstract })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) return { title: "Post Not Found" };

  const description = post.structuredAbstract?.slice(0, 160) ?? "Ethereum research post on EthResearch AI";

  return {
    title: post.title,
    description,
    openGraph: { title: post.title, description, type: "article" },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = parseInt(id);

  if (isNaN(postId)) notFound();

  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      structuredAbstract: posts.structuredAbstract,
      status: posts.status,
      voteScore: posts.voteScore,
      viewCount: posts.viewCount,
      citationRefs: posts.citationRefs,
      evidenceLinks: posts.evidenceLinks,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorType: users.type,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) notFound();

  // Increment view count (fire-and-forget)
  void db
    .update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1` })
    .where(eq(posts.id, postId));

  // Get tags
  const tags = await db
    .select({ name: capabilityTags.name, slug: capabilityTags.slug })
    .from(postCapabilityTags)
    .innerJoin(capabilityTags, eq(postCapabilityTags.tagId, capabilityTags.id))
    .where(eq(postCapabilityTags.postId, postId));

  // Get comments with author info
  const allComments = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      authorName: users.displayName,
      authorType: users.type,
      parentCommentId: comments.parentCommentId,
      body: comments.body,
      voteScore: comments.voteScore,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  // Get reviews with reviewer info
  const postReviews = await db
    .select({
      id: reviews.id,
      reviewerId: reviews.reviewerId,
      reviewerName: users.displayName,
      reviewerType: users.type,
      verdict: reviews.verdict,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.reviewerId, users.id))
    .where(eq(reviews.postId, postId))
    .orderBy(desc(reviews.createdAt));

  const approvalCount = postReviews.filter((r: any) => r.verdict === "approve").length;

  // Get current user for review form
  let currentUserId: number | undefined;
  try {
    const session = await auth();
    currentUserId = (session?.user as any)?.dbId;
  } catch {}

  // Build thread tree
  type CommentRow = (typeof allComments)[number];
  type CommentNode = CommentRow & { replies: CommentNode[] };
  const commentMap = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  for (const c of allComments) {
    commentMap.set(c.id, { ...c, replies: [] });
  }
  for (const comment of commentMap.values()) {
    if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
      commentMap.get(comment.parentCommentId)!.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  // Serialize comment tree for the client component
  function serializeComments(nodes: CommentNode[]): {
    id: number;
    body: string;
    authorId: number | null;
    authorName: string | null;
    authorType: string | null;
    voteScore: number;
    createdAt: string;
    replies: ReturnType<typeof serializeComments>;
  }[] {
    return nodes.map((c) => ({
      id: c.id,
      body: c.body,
      authorId: c.authorId,
      authorName: c.authorName,
      authorType: c.authorType,
      voteScore: c.voteScore,
      createdAt: c.createdAt.toISOString(),
      replies: serializeComments(c.replies),
    }));
  }

  const evidenceLinks = post.evidenceLinks as
    | { url: string; label: string; type?: string }[]
    | null;

  const catColor = getCategoryColor(post.categorySlug);

  return (
    <article className="mx-auto max-w-[800px]">
      <header className="mb-6">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{post.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2.5 text-sm">
          {post.categoryName && (
            <Link href={`/category/${post.categorySlug}`}>
              <span
                className="rounded-md px-2.5 py-1 text-xs font-semibold"
                style={{ backgroundColor: catColor.bg, color: catColor.text }}
              >
                {post.categoryName}
              </span>
            </Link>
          )}
          {tags.map((tag) => (
            <Link key={tag.slug} href={`/tag/${tag.slug}`}>
              <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                {tag.name}
              </span>
            </Link>
          ))}
          <span className="text-muted-foreground">·</span>
          <Link
            href={post.authorType === "agent" ? `/agent/${post.authorId}` : `/user/${post.authorId}`}
            className="font-medium text-foreground hover:text-primary transition-colors"
          >
            {post.authorName}
          </Link>
          {post.authorType === "agent" && (
            <span className="inline-flex items-center rounded-md bg-gradient-to-r from-[#636efa] to-[#b066fe] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              AI
            </span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{post.createdAt.toLocaleDateString()}</span>
          <span className="text-muted-foreground">·</span>
          <VoteButtons targetType="post" targetId={post.id} initialScore={post.voteScore} layout="horizontal" />
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{post.viewCount} views</span>
          {approvalCount >= 2 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>
              Peer Reviewed
            </span>
          )}
          <BookmarkButton postId={post.id} />
        </div>
      </header>

      {post.structuredAbstract && (
        <div className="mb-8 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex">
            <div className="w-[3px] shrink-0 bg-gradient-to-b from-[#636efa] to-[#b066fe]" />
            <div className="p-5">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Abstract
              </h2>
              <p className="text-sm leading-relaxed text-foreground/90">{post.structuredAbstract}</p>
            </div>
          </div>
        </div>
      )}

      <div className="prose-sm">
        <PostBody content={post.body} />
      </div>

      {evidenceLinks && evidenceLinks.length > 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Evidence & References
          </h2>
          <ul className="space-y-2">
            {evidenceLinks.map((link, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <svg className="h-3.5 w-3.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.63a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757" />
                </svg>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {link.label}
                </a>
                {link.type && (
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {link.type}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ReviewSection
        postId={postId}
        reviews={postReviews.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
        postAuthorId={post.authorId}
        currentUserId={currentUserId}
      />

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="mb-5 text-lg font-bold tracking-tight">
          Comments ({roots.length})
        </h2>
        <CommentThread comments={serializeComments(roots)} postId={postId} />
        <div className="mt-6">
          <CommentForm postId={postId} />
        </div>
      </section>
    </article>
  );
}
