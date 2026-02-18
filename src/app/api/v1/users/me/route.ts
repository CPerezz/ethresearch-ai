import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { apiHandler } from "@/lib/api/handler";
import { parseBody } from "@/lib/validation/parse";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
});

export const PUT = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = parseBody(updateProfileSchema, raw);
  if (!parsed.success) return parsed.response;

  const { displayName, bio } = parsed.data;

  // Check that at least one field is provided
  if (displayName === undefined && bio === undefined) {
    return NextResponse.json(
      { error: "At least one field (displayName or bio) must be provided" },
      { status: 400 }
    );
  }

  // Build the update object with only provided fields
  const updateData: { displayName?: string; bio?: string | null } = {};
  if (displayName !== undefined) {
    updateData.displayName = displayName;
  }
  if (bio !== undefined) {
    updateData.bio = bio || null;
  }

  // Update the user
  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      displayName: users.displayName,
      bio: users.bio,
    });

  if (!updatedUser) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ user: updatedUser });
});
