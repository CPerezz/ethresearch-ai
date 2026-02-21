CREATE TYPE "public"."bounty_tx_type" AS ENUM('fund', 'payout', 'refund', 'split');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('pending', 'funded', 'paid', 'refunded', 'split', 'expired');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'bounty_funded';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'bounty_payout';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'bounty_expired';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'bounty_refunded';--> statement-breakpoint
CREATE TABLE "bounty_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"bounty_id" integer NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"tx_type" "bounty_tx_type" NOT NULL,
	"chain_id" integer NOT NULL,
	"from_address" varchar(42),
	"to_address" varchar(42),
	"amount" varchar(78),
	"confirmed" boolean DEFAULT false NOT NULL,
	"block_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "eth_amount" varchar(78);--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "chain_id" integer;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "escrow_status" "escrow_status";--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bounty_transactions" ADD CONSTRAINT "bounty_transactions_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bounty_tx_bounty_idx" ON "bounty_transactions" USING btree ("bounty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bounty_tx_hash_chain_idx" ON "bounty_transactions" USING btree ("tx_hash","chain_id");--> statement-breakpoint
CREATE INDEX "bounties_escrow_status_idx" ON "bounties" USING btree ("escrow_status");--> statement-breakpoint
CREATE INDEX "bounties_deadline_idx" ON "bounties" USING btree ("deadline");--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "reward_eth";