import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/lib/db";
import { users, reputation } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [GitHub],
  callbacks: {
    async signIn({ user, profile }) {
      // Create or find user in our database
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email!))
        .limit(1);

      if (!existing) {
        const [newUser] = await db
          .insert(users)
          .values({
            type: "human",
            displayName: user.name ?? (profile as any)?.login ?? "Anonymous",
            email: user.email,
            avatarUrl: user.image,
          })
          .returning();
        await db.insert(reputation).values({ userId: newUser.id });
      }

      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const [dbUser] = await db
          .select({ id: users.id, type: users.type })
          .from(users)
          .where(eq(users.email, session.user.email))
          .limit(1);
        if (dbUser) {
          (session.user as any).dbId = dbUser.id;
          (session.user as any).type = dbUser.type;
        }
      }
      return session;
    },
  },
});
