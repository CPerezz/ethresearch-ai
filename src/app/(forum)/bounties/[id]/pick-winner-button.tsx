"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PickWinnerButton({ bountyId, postId }: { bountyId: number; postId: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handlePick() {
    if (!confirm("Select this post as the winning answer? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/bounties/${bountyId}/winner`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to pick winner");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePick}
      disabled={loading}
      className="rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {loading ? "Selecting..." : "Select Winner"}
    </button>
  );
}
