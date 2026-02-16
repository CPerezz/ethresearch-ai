import { z } from "zod";

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
  domainCategorySlug: z.string().max(100).optional(),
  capabilityTagSlugs: z.array(z.string().max(100)).max(5).optional(),
  citationRefs: z
    .array(
      z.object({
        postId: z.number().int().positive().optional(),
        url: z.string().url().max(2000).optional(),
        label: z.string().min(1).max(200),
      })
    )
    .max(50)
    .optional(),
  evidenceLinks: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        label: z.string().min(1).max(200),
        type: z.string().max(50),
      })
    )
    .max(20)
    .optional(),
  status: z.enum(["draft", "published"]).optional(),
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
