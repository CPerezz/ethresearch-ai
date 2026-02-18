import { db } from "@/lib/db";
import { badges, userBadges, posts, comments, reputation, notifications } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const REP_LEVEL_ORDER: Record<string, number> = {
  newcomer: 0,
  contributor: 1,
  researcher: 2,
  distinguished: 3,
};

interface BadgeThreshold {
  type: "post_count" | "comment_count" | "vote_score" | "rep_level";
  value: number | string;
}

export async function checkAndAwardBadges(userId: number): Promise<string[]> {
  try {
    // 1. Fetch all badge definitions
    const allBadges = await db.select().from(badges);

    // 2. Fetch user's already-earned badge IDs
    const earnedRows = await db
      .select({ badgeId: userBadges.badgeId })
      .from(userBadges)
      .where(eq(userBadges.userId, userId));

    const earnedBadgeIds = new Set(earnedRows.map((r) => r.badgeId));

    // 3. Query user stats in parallel
    const [postCountResult, commentCountResult, voteScoreResult, repResult] =
      await Promise.all([
        // Post count
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(posts)
          .where(eq(posts.authorId, userId)),

        // Comment count
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(comments)
          .where(eq(comments.authorId, userId)),

        // Total vote score: sum of voteScore on user's posts + comments
        db
          .select({
            total: sql<number>`coalesce((
              select sum(${posts.voteScore}) from ${posts} where ${posts.authorId} = ${userId}
            ), 0) + coalesce((
              select sum(${comments.voteScore}) from ${comments} where ${comments.authorId} = ${userId}
            ), 0)`,
          })
          .from(sql`(select 1) as _dummy`),

        // Reputation level
        db
          .select({ level: reputation.level })
          .from(reputation)
          .where(eq(reputation.userId, userId)),
      ]);

    const postCount = postCountResult[0]?.count ?? 0;
    const commentCount = commentCountResult[0]?.count ?? 0;
    const totalVoteScore = Number(voteScoreResult[0]?.total ?? 0);
    const repLevel = repResult[0]?.level ?? "newcomer";

    // 4. Check each unearned badge
    const newlyEarned: string[] = [];

    for (const badge of allBadges) {
      if (earnedBadgeIds.has(badge.id)) continue;

      const threshold = badge.threshold as BadgeThreshold;
      let qualifies = false;

      switch (threshold.type) {
        case "post_count":
          qualifies = postCount >= Number(threshold.value);
          break;
        case "comment_count":
          qualifies = commentCount >= Number(threshold.value);
          break;
        case "vote_score":
          qualifies = totalVoteScore >= Number(threshold.value);
          break;
        case "rep_level": {
          const userLevel = REP_LEVEL_ORDER[repLevel] ?? 0;
          const requiredLevel = REP_LEVEL_ORDER[String(threshold.value)] ?? 0;
          qualifies = userLevel >= requiredLevel;
          break;
        }
      }

      if (qualifies) {
        // 6. Insert newly earned badge
        await db
          .insert(userBadges)
          .values({ userId, badgeId: badge.id })
          .onConflictDoNothing();

        // 7. Create notification
        await db.insert(notifications).values({
          userId,
          type: "badge_earned",
          title: `Badge earned: ${badge.name}`,
          body: badge.description,
        });

        newlyEarned.push(badge.name);
      }
    }

    // 8. Return newly earned badge names
    return newlyEarned;
  } catch (error) {
    // 9. Never throw — log and return empty array
    console.error("checkAndAwardBadges failed:", error);
    return [];
  }
}
