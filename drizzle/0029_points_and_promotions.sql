CREATE TABLE IF NOT EXISTS "points_wallets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"earned_balance" integer DEFAULT 0 NOT NULL,
	"purchased_balance" integer DEFAULT 0 NOT NULL,
	"reserved_earned_balance" integer DEFAULT 0 NOT NULL,
	"reserved_purchased_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "points_wallets_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "points_wallets_earned_balance_non_negative" CHECK ("earned_balance" >= 0),
	CONSTRAINT "points_wallets_purchased_balance_non_negative" CHECK ("purchased_balance" >= 0),
	CONSTRAINT "points_wallets_reserved_earned_non_negative" CHECK ("reserved_earned_balance" >= 0),
	CONSTRAINT "points_wallets_reserved_purchased_non_negative" CHECK ("reserved_purchased_balance" >= 0),
	CONSTRAINT "points_wallets_reserved_earned_within_balance" CHECK ("reserved_earned_balance" <= "earned_balance"),
	CONSTRAINT "points_wallets_reserved_purchased_within_balance" CHECK ("reserved_purchased_balance" <= "purchased_balance")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"source_type" text NOT NULL,
	"amount" integer NOT NULL,
	"earned_delta" integer DEFAULT 0 NOT NULL,
	"purchased_delta" integer DEFAULT 0 NOT NULL,
	"reserved_earned_delta" integer DEFAULT 0 NOT NULL,
	"reserved_purchased_delta" integer DEFAULT 0 NOT NULL,
	"available_balance_after" integer NOT NULL,
	"total_balance_after" integer NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"idempotency_key" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "points_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "points_tx_amount_positive" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_reward_rules" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_key" text NOT NULL,
	"role" text NOT NULL,
	"points_amount" integer NOT NULL,
	"max_grants_per_user" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "points_reward_rules_rule_key_unique" UNIQUE("rule_key"),
	CONSTRAINT "points_rules_amount_positive" CHECK ("points_amount" > 0),
	CONSTRAINT "points_rules_max_grants_positive" CHECK ("max_grants_per_user" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_reward_grants" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" text NOT NULL,
	"rule_key" text NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"reference_event_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "points_reward_grants_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_purchase_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"points" integer NOT NULL,
	"price" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"allowed_roles" jsonb DEFAULT '["PROPERTY_OWNER","AGENT"]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "points_packages_points_positive" CHECK ("points" > 0),
	CONSTRAINT "points_packages_price_positive" CHECK ("price" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_purchase_orders" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"package_id" text NOT NULL,
	"points" integer NOT NULL,
	"price" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"payment_method" text,
	"payment_reference" text,
	"confirmed_by_admin_id" text,
	"confirmed_at" timestamp,
	"transaction_id" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "points_purchase_orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promotion_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"points_cost" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"placement_scope" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "promotion_packages_points_cost_positive" CHECK ("points_cost" > 0),
	CONSTRAINT "promotion_packages_duration_days_positive" CHECK ("duration_days" > 0),
	CONSTRAINT "promotion_packages_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promotion_campaigns" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" text NOT NULL,
	"property_id" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"payer_user_id" text NOT NULL,
	"package_id" text NOT NULL,
	"package_version" integer NOT NULL,
	"campaign_type" text NOT NULL,
	"placement_scope" jsonb NOT NULL,
	"points_cost" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"reservation_transaction_id" text,
	"spend_transaction_id" text,
	"start_time" timestamp,
	"end_time" timestamp,
	"moderated_by_admin_id" text,
	"moderation_decision" text,
	"moderation_reason" text,
	"moderated_at" timestamp,
	"consent_status" text DEFAULT 'NOT_REQUIRED' NOT NULL,
	"consent_granted_by_user_id" text,
	"consent_granted_at" timestamp,
	"consent_evidence" jsonb,
	"consent_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "campaigns_points_cost_positive" CHECK ("points_cost" > 0),
	CONSTRAINT "campaigns_duration_days_positive" CHECK ("duration_days" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_wallets" ADD CONSTRAINT "points_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_wallet_id_points_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."points_wallets"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_reward_grants" ADD CONSTRAINT "points_reward_grants_rule_id_points_reward_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."points_reward_rules"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_reward_grants" ADD CONSTRAINT "points_reward_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_reward_grants" ADD CONSTRAINT "points_reward_grants_transaction_id_points_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."points_transactions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_purchase_orders" ADD CONSTRAINT "points_purchase_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_purchase_orders" ADD CONSTRAINT "points_purchase_orders_package_id_points_purchase_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."points_purchase_packages"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_purchase_orders" ADD CONSTRAINT "points_purchase_orders_confirmed_by_admin_id_users_id_fk" FOREIGN KEY ("confirmed_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_purchase_orders" ADD CONSTRAINT "points_purchase_orders_transaction_id_points_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."points_transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_package_id_promotion_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."promotion_packages"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_reservation_transaction_id_points_transactions_id_fk" FOREIGN KEY ("reservation_transaction_id") REFERENCES "public"."points_transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_spend_transaction_id_points_transactions_id_fk" FOREIGN KEY ("spend_transaction_id") REFERENCES "public"."points_transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_moderated_by_admin_id_users_id_fk" FOREIGN KEY ("moderated_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_consent_granted_by_user_id_users_id_fk" FOREIGN KEY ("consent_granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "points_tx_user_created_idx" ON "points_transactions" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "points_tx_ref_idx" ON "points_transactions" USING btree ("reference_type","reference_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "points_grants_user_event_idx" ON "points_reward_grants" USING btree ("rule_key","user_id","reference_event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "promotion_campaigns" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_property_listing_idx" ON "promotion_campaigns" USING btree ("property_id","listing_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_active_time_idx" ON "promotion_campaigns" USING btree ("status","start_time","end_time");
--> statement-breakpoint

-- Initial Configurable Promotion Packages (provisional non-production example values)
INSERT INTO "promotion_packages" ("id", "type", "name", "points_cost", "duration_days", "placement_scope", "is_active", "version", "description")
VALUES 
  ('PKG_MULTI_PAGE_7D', 'MULTI_PAGE', 'Multi-Page Rental Promotion (7 Days)', 1000, 7, '["HOMEPAGE", "SEARCH"]'::jsonb, true, 1, 'Provisional Multi-Page promotion package across homepage and search results.'),
  ('PKG_HOME_FEATURED_7D', 'HOME_FEATURED', 'Homepage Featured Placement (7 Days)', 600, 7, '["HOMEPAGE"]'::jsonb, true, 1, 'Provisional Homepage featured placement for verified rental properties.'),
  ('PKG_SPONSORED_SEARCH_7D', 'SPONSORED_SEARCH', 'Sponsored Search Results (7 Days)', 500, 7, '["SEARCH"]'::jsonb, true, 1, 'Provisional Sponsored placement in rental search results.')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- Initial Configurable Points Purchase Packages (for Owners and Agents)
INSERT INTO "points_purchase_packages" ("id", "name", "points", "price", "currency", "is_active", "allowed_roles")
VALUES
  ('PKG_POINTS_500', 'Starter Pack (500 Points)', 500, 50000, 'IQD', true, '["PROPERTY_OWNER", "AGENT"]'::jsonb),
  ('PKG_POINTS_1000', 'Standard Pack (1,000 Points)', 1000, 95000, 'IQD', true, '["PROPERTY_OWNER", "AGENT"]'::jsonb),
  ('PKG_POINTS_2500', 'Pro Pack (2,500 Points)', 2500, 225000, 'IQD', true, '["PROPERTY_OWNER", "AGENT"]'::jsonb)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- Initial Configurable Reward Rules (Server-Authoritative Earning)
INSERT INTO "points_reward_rules" ("rule_key", "role", "points_amount", "max_grants_per_user", "is_active", "description")
VALUES
  ('OWNER_FIRST_LISTING', 'PROPERTY_OWNER', 200, 1, true, 'Reward for property owner publishing their first verified rental listing.'),
  ('TENANT_ON_TIME_RENT', 'TENANT', 50, 12, true, 'Reward for tenant making a confirmed on-time rent payment.'),
  ('AGENT_VERIFIED_PROFILE', 'AGENT', 150, 1, true, 'Reward for agent completing verified licensing and onboarding.')
ON CONFLICT ("rule_key") DO NOTHING;