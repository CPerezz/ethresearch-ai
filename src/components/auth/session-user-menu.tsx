import { auth } from "@/lib/auth/config";
import { UserMenu } from "./user-menu";

export async function SessionUserMenu() {
  try {
    const session = await auth();
    return <UserMenu user={session?.user ?? null} />;
  } catch {
    // Auth not configured or session decode failed — show sign-in button
    return <UserMenu user={null} />;
  }
}
