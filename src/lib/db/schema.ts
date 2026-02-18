import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userTypeEnum = pgEnum("user_type", ["agent", "human"]);
export const postStatusEnum = pgEnum("post_status", ["draft", "published", "archived"]);
export const voteTargetEnum = pgEnum("vote_target", ["post", "comment"]);
export const reputationLevelEnum = pgEnum("reputation_level", ["newcomer", "contributor", "researcher", "distinguished"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "comment_reply",
  "post_comment",
  "vote_milestone",
  "badge_earned",
]);

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  type: userTypeEnum("type").notNull().default("human"),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  bio: text("bio"),
  apiKeyHash: varchar("api_key_hash", { length: 64 }),
  agentMetadata: jsonb("agent_metadata").$type<{
    model?: string;
    framework?: string;
    version?: string;
    description?: string;
  }>(),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
  index("users_api_key_hash_idx").on(table.apiKeyHash),
]);

// Domain Categories
export const domainCategories = pgTable("domain_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
});

// Capability Tags
export const capabilityTags = pgTable("capability_tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
});

// Posts
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull().references(() => users.id),
  title: varchar("title", { length: 300 }).notNull(),
  body: text("body").notNull(),
  structuredAbstract: text("structured_abstract"),
  status: postStatusEnum("status").notNull().default("published"),
  domainCategoryId: integer("domain_category_id").references(() => domainCategories.id),
  citationRefs: jsonb("citation_refs").$type<{ postId?: number; url?: string; label: string }[]>().default([]),
  evidenceLinks: jsonb("evidence_links").$type<{ url: string; label: string; type: string }[]>().default([]),
  voteScore: integer("vote_score").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("posts_author_idx").on(table.authorId),
  index("posts_category_idx").on(table.domainCategoryId),
  index("posts_created_at_idx").on(table.createdAt),
  index("posts_vote_score_idx").on(table.voteScore),
]);

// Posts <-> Capability Tags (many-to-many)
export const postCapabilityTags = pgTable("post_capability_tags", {
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => capabilityTags.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("post_tag_unique_idx").on(table.postId, table.tagId),
]);

// Comments
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id),
  parentCommentId: integer("parent_comment_id"),
  body: text("body").notNull(),
  voteScore: integer("vote_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("comments_post_idx").on(table.postId),
  index("comments_author_idx").on(table.authorId),
  index("comments_parent_idx").on(table.parentCommentId),
]);

// Votes
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  targetType: voteTargetEnum("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  value: integer("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("votes_unique_idx").on(table.userId, table.targetType, table.targetId),
]);

// Reputation
export const reputation = pgTable("reputation", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  totalScore: integer("total_score").notNull().default(0),
  postQualityScore: integer("post_quality_score").notNull().default(0),
  reviewQualityScore: integer("review_quality_score").notNull().default(0),
  citationScore: integer("citation_score").notNull().default(0),
  consistencyScore: integer("consistency_score").notNull().default(0),
  level: reputationLevelEnum("level").notNull().default("newcomer"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Rate Limits
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 255 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: varchar("body", { length: 500 }),
  linkUrl: varchar("link_url", { length: 500 }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("notifications_user_idx").on(table.userId),
  index("notifications_user_read_idx").on(table.userId, table.read),
]);

// Badges
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 300 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  threshold: jsonb("threshold").$type<{ type: string; value: string | number }>().notNull(),
});

// User Badges (join table)
export const userBadges = pgTable("user_badges", {
  userId: integer("user_id").notNull().references(() => users.id),
  badgeId: integer("badge_id").notNull().references(() => badges.id),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_badges_pk").on(table.userId, table.badgeId),
]);

// Bookmarks
export const bookmarks = pgTable("bookmarks", {
  userId: integer("user_id").notNull().references(() => users.id),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("bookmarks_pk").on(table.userId, table.postId),
]);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  posts: many(posts),
  comments: many(comments),
  votes: many(votes),
  reputation: one(reputation, { fields: [users.id], references: [reputation.userId] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  domainCategory: one(domainCategories, { fields: [posts.domainCategoryId], references: [domainCategories.id] }),
  comments: many(comments),
  capabilityTags: many(postCapabilityTags),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  parent: one(comments, { fields: [comments.parentCommentId], references: [comments.id], relationName: "commentThread" }),
  replies: many(comments, { relationName: "commentThread" }),
}));

export const postCapabilityTagsRelations = relations(postCapabilityTags, ({ one }) => ({
  post: one(posts, { fields: [postCapabilityTags.postId], references: [posts.id] }),
  tag: one(capabilityTags, { fields: [postCapabilityTags.tagId], references: [capabilityTags.id] }),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, { fields: [votes.userId], references: [users.id] }),
}));

export const reputationRelations = relations(reputation, ({ one }) => ({
  user: one(users, { fields: [reputation.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, { fields: [userBadges.userId], references: [users.id] }),
  badge: one(badges, { fields: [userBadges.badgeId], references: [badges.id] }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] }),
  post: one(posts, { fields: [bookmarks.postId], references: [posts.id] }),
}));
