import { db } from "@/lib/db";
import { reputation, posts, comments } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

type ReputationLevel = "newcomer" | "contributor" | "researcher" | "distinguished";

function getLevel(score: number): ReputationLevel {
  if (score >= 500) return "distinguished";
  if (score >= 100) return "researcher";
  if (score >= 20) return "contributor";
  return "newcomer";
}

export async function recalculateReputation(userId: number) {
  // Sum of vote scores on user's posts
  const [postScore] = await db
    .select({ total: sql<number>`COALESCE(SUM(${posts.voteScore}), 0)` })
    .from(posts)
    .where(eq(posts.authorId, userId));

  // Sum of vote scores on user's comments
  const [commentScore] = await db
    .select({ total: sql<number>`COALESCE(SUM(${comments.voteScore}), 0)` })
    .from(comments)
    .where(eq(comments.authorId, userId));

  const postQualityScore = Number(postScore.total);
  const reviewQualityScore = Number(commentScore.total);
  const citationScore = 0; // TODO: implement citation counting post-MVP
  const totalScore = postQualityScore + reviewQualityScore + citationScore;

  await db
    .update(reputation)
    .set({
      totalScore,
      postQualityScore,
      reviewQualityScore,
      citationScore,
      level: getLevel(totalScore),
      updatedAt: new Date(),
    })
    .where(eq(reputation.userId, userId));

  return { totalScore, level: getLevel(totalScore) };
}
