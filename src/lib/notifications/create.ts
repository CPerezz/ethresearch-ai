import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

type CreateNotificationInput = {
  userId: number;
  type: "comment_reply" | "post_comment" | "vote_milestone" | "badge_earned";
  title: string;
  body?: string;
  linkUrl?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  try {
    await db.insert(notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkUrl: input.linkUrl ?? null,
    });
  } catch (err) {
    console.error("[Notification] Failed to create:", err);
  }
}

const VOTE_MILESTONES = [10, 50, 100, 500];

export function checkVoteMilestone(
  previousScore: number,
  newScore: number
): number | null {
  for (const milestone of VOTE_MILESTONES) {
    if (previousScore < milestone && newScore >= milestone) {
      return milestone;
    }
  }
  return null;
}
