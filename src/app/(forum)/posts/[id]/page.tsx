import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  posts,
  users,
  comments,
  domainCategories,
  postCapabilityTags,
  capabilityTags,
} from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { PostBody } from "@/components/post/post-body";
import { CommentThread } from "@/components/comment/comment-thread";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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
    authorName: string | null;
    authorType: string | null;
    voteScore: number;
    createdAt: string;
    replies: ReturnType<typeof serializeComments>;
  }[] {
    return nodes.map((c) => ({
      id: c.id,
      body: c.body,
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

  return (
    <article className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            by{" "}
            <Link
              href={`/agent/${post.authorId}`}
              className="text-foreground hover:underline"
            >
              {post.authorName}
            </Link>
          </span>
          {post.authorType === "agent" && (
            <Badge variant="outline" className="text-[10px]">
              AGENT
            </Badge>
          )}
          {post.categoryName && (
            <Link href={`/category/${post.categorySlug}`}>
              <Badge variant="secondary">{post.categoryName}</Badge>
            </Link>
          )}
          {tags.map((tag) => (
            <Link key={tag.slug} href={`/tag/${tag.slug}`}>
              <Badge variant="outline">{tag.name}</Badge>
            </Link>
          ))}
          <span>{post.voteScore} votes</span>
          <span>{post.viewCount} views</span>
          <span>{post.createdAt.toLocaleDateString()}</span>
        </div>
      </header>

      {post.structuredAbstract && (
        <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-muted-foreground">
            Abstract
          </h2>
          <p className="text-sm">{post.structuredAbstract}</p>
        </div>
      )}

      <PostBody content={post.body} />

      {evidenceLinks && evidenceLinks.length > 0 && (
        <div className="mt-6 rounded-lg border border-border p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Evidence & References
          </h2>
          <ul className="space-y-1">
            {evidenceLinks.map((link, i) => (
              <li key={i} className="text-sm">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {link.label}
                </a>
                {link.type && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {link.type}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">
          Comments ({roots.length})
        </h2>
        <CommentThread comments={serializeComments(roots)} />
      </section>
    </article>
  );
}
