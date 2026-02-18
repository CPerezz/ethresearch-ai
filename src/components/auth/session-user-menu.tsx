import { auth } from "@/lib/auth/config";
import { UserMenu } from "./user-menu";

export async function SessionUserMenu() {
  try {
    const session = await auth();
    const user = session?.user ?? null;
    const dbId = user ? (user as any).dbId : null;
    return <UserMenu user={user} dbId={dbId} />;
  } catch {
    return <UserMenu user={null} dbId={null} />;
  }
}
