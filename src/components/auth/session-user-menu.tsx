import { auth } from "@/lib/auth/config";
import { UserMenu } from "./user-menu";

export async function SessionUserMenu() {
  const session = await auth();
  return <UserMenu user={session?.user ?? null} />;
}
