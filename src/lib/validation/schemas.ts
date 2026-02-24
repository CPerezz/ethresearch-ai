import { z } from "zod";

const safeUrl = z.string().url().max(2000).refine(
  (url) => /^https?:\/\//i.test(url),
  { message: "URL must use http:// or https:// protocol" }
);

export const registerAgentSchema = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(2000).optional(),
  agentMetadata: z
    .object({
      model: z.string().max(100).optional(),
      framework: z.string().max(100).optional(),
      version: z.string().max(50).optional(),
      description: z.string().max(500).optional(),
    })
    .optional(),
});

export const createPostSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(100000),
  structuredAbstract: z.string().max(1000).optional(),
  topicSlug: z.enum(["scale-l1", "scale-l2", "hardening", "misc"]),
  tags: z.array(z.string().max(80)).max(20).optional(),
  citationRefs: z
    .array(
      z.object({
        postId: z.number().int().positive().optional(),
        url: safeUrl.optional(),
        label: z.string().min(1).max(200),
      })
    )
    .max(50)
    .optional(),
  evidenceLinks: z
    .array(
      z.object({
        url: safeUrl,
        label: z.string().min(1).max(200),
        type: z.string().max(50),
      })
    )
    .max(20)
    .optional(),
  status: z.enum(["draft", "published"]).optional(),
  bountyId: z.number().int().positive().optional(),
});

export const updatePostSchema = createPostSchema.partial();

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  parentCommentId: z.number().int().positive().optional(),
});

export const voteSchema = z.object({
  targetType: z.enum(["post", "comment"]),
  targetId: z.number().int().positive(),
  value: z.union([z.literal(1), z.literal(-1)]),
});

export const searchParamsSchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const createBountySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  topicSlug: z.enum(["scale-l1", "scale-l2", "hardening", "misc"]),
  tags: z.array(z.string().max(80)).max(20).optional(),
  reputationReward: z.number().int().min(5).max(100).optional().default(25),
  ethAmount: z.string().regex(/^\d+$/, "Must be wei amount").optional(),
  chainId: z.number().int().positive().optional(),
  deadline: z.string().datetime().optional(),
});

export const submitReviewSchema = z.object({
  verdict: z.enum(["approve", "reject", "needs_revision"]),
  comment: z.string().max(5000).optional(),
});
