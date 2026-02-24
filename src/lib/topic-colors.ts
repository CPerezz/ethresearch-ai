const TOPIC_COLORS: Record<string, { bg: string; text: string }> = {
  "scale-l1": { bg: "#636efa22", text: "#636efa" },
  "scale-l2": { bg: "#b066fe22", text: "#b066fe" },
  "hardening": { bg: "#ef553b22", text: "#ef553b" },
  "misc": { bg: "#00cc9622", text: "#00cc96" },
};

const FALLBACK = { bg: "var(--muted)", text: "var(--muted-foreground)" };

export function getTopicColor(slug: string | null): { bg: string; text: string } {
  if (!slug) return FALLBACK;
  return TOPIC_COLORS[slug] ?? FALLBACK;
}
