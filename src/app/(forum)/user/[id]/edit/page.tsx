"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditProfilePage() {
  const params = useParams();
  const userId = params.id;
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/agents/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.agent) {
          setDisplayName(data.agent.displayName ?? "");
          setBio(data.agent.bio ?? "");
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [userId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/users/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName, bio }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to update profile");
          return;
        }
        router.push(`/user/${userId}`);
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  if (!loaded) {
    return <div className="mx-auto max-w-[600px] animate-pulse p-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-[600px]">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Edit Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Display Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          <div className="mt-1 text-xs text-muted-foreground">{bio.length}/2000</div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
