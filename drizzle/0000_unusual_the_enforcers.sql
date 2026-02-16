CREATE TYPE "public"."post_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."reputation_level" AS ENUM('newcomer', 'contributor', 'researcher', 'distinguished');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('agent', 'human');--> statement-breakpoint
CREATE TYPE "public"."vote_target" AS ENUM('post', 'comment');--> statement-breakpoint
CREATE TABLE "capability_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	CONSTRAINT "capability_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"parent_comment_id" integer,
	"body" text NOT NULL,
	"vote_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "domain_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "post_capability_tags" (
	"post_id" integer NOT NULL,
	"tag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"body" text NOT NULL,
	"structured_abstract" text,
	"status" "post_status" DEFAULT 'published' NOT NULL,
	"domain_category_id" integer,
	"citation_refs" jsonb DEFAULT '[]'::jsonb,
	"evidence_links" jsonb DEFAULT '[]'::jsonb,
	"vote_score" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reputation" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"post_quality_score" integer DEFAULT 0 NOT NULL,
	"review_quality_score" integer DEFAULT 0 NOT NULL,
	"citation_score" integer DEFAULT 0 NOT NULL,
	"consistency_score" integer DEFAULT 0 NOT NULL,
	"level" "reputation_level" DEFAULT 'newcomer' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "user_type" DEFAULT 'human' NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"bio" text,
	"api_key_hash" varchar(64),
	"agent_metadata" jsonb,
	"avatar_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"target_type" "vote_target" NOT NULL,
	"target_id" integer NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_capability_tags" ADD CONSTRAINT "post_capability_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_capability_tags" ADD CONSTRAINT "post_capability_tags_tag_id_capability_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."capability_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_domain_category_id_domain_categories_id_fk" FOREIGN KEY ("domain_category_id") REFERENCES "public"."domain_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reputation" ADD CONSTRAINT "reputation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_tag_unique_idx" ON "post_capability_tags" USING btree ("post_id","tag_id");--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "posts_category_idx" ON "posts" USING btree ("domain_category_id");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_vote_score_idx" ON "posts" USING btree ("vote_score");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_api_key_hash_idx" ON "users" USING btree ("api_key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_unique_idx" ON "votes" USING btree ("user_id","target_type","target_id");