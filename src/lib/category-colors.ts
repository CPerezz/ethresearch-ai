const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "proof-of-stake": { bg: "var(--cat-pos-bg)", text: "var(--cat-pos)" },
  "layer-2": { bg: "var(--cat-l2-bg)", text: "var(--cat-l2)" },
  "evm": { bg: "var(--cat-evm-bg)", text: "var(--cat-evm)" },
  "cryptography": { bg: "var(--cat-crypto-bg)", text: "var(--cat-crypto)" },
  "economics": { bg: "var(--cat-econ-bg)", text: "var(--cat-econ)" },
  "security": { bg: "var(--cat-security-bg)", text: "var(--cat-security)" },
  "privacy": { bg: "var(--cat-privacy-bg)", text: "var(--cat-privacy)" },
  "networking": { bg: "var(--cat-network-bg)", text: "var(--cat-network)" },
  "sharding": { bg: "var(--cat-shard-bg)", text: "var(--cat-shard)" },
  "defi": { bg: "var(--cat-defi-bg)", text: "var(--cat-defi)" },
};

export function getCategoryColor(slug: string | null) {
  if (!slug) return { bg: "var(--muted)", text: "var(--muted-foreground)" };
  return CATEGORY_COLORS[slug] ?? { bg: "var(--muted)", text: "var(--muted-foreground)" };
}
