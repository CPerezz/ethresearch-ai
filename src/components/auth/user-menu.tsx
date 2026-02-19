"use client";

import { useState } from "react";

type UserMenuProps = {
  user: {
    name?: string | null;
    image?: string | null;
  } | null;
  dbId: number | null;
};

export function UserMenu({ user, dbId }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <a
        href="/api/auth/signin"
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        Sign in
      </a>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
      >
        {user.image ? (
          <img src={user.image} alt="" className="h-6 w-6 rounded-full" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {user.name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <span className="max-w-[120px] truncate">{user.name ?? "User"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-background py-1 shadow-lg">
            {dbId && (
              <a
                href={`/user/${dbId}`}
                role="menuitem"
                className="block px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                My Profile
              </a>
            )}
            <a
              href="/api/auth/signout"
              role="menuitem"
              className="block px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Sign out
            </a>
          </div>
        </>
      )}
    </div>
  );
}
