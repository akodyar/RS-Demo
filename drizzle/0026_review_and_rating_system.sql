-- Step 1: Create property_reviews table for tenant property ratings and verified feedback
CREATE TABLE IF NOT EXISTS "property_reviews" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" text NOT NULL,
  "lease_id" text,
  "tenant_id" text NOT NULL,
  "rating" integer NOT NULL,
  "cleanliness_rating" integer,
  "maintenance_rating" integer,
  "communication_rating" integer,
  "location_rating" integer,
  "title" text,
  "comment" text NOT NULL,
  "status" text DEFAULT 'PUBLISHED' NOT NULL,
  "moderation_reason" text,
  "moderated_by_user_id" text,
  "moderated_at" timestamp,
  "owner_response" text,
  "owner_responded_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Step 2: Foreign key constraints
DO $$ BEGIN
  ALTER TABLE "property_reviews" ADD CONSTRAINT "property_reviews_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "property_reviews" ADD CONSTRAINT "property_reviews_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "property_reviews" ADD CONSTRAINT "property_reviews_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "property_reviews" ADD CONSTRAINT "property_reviews_mod_user_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Step 3: Uniqueness & Performance Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "prop_reviews_tenant_prop_unique_idx" ON "property_reviews" ("property_id", "tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prop_reviews_property_id_idx" ON "property_reviews" ("property_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prop_reviews_tenant_id_idx" ON "property_reviews" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prop_reviews_status_idx" ON "property_reviews" ("status");
--> statement-breakpoint

-- Step 4: Ensure vendor_reviews has uniqueness constraint per work_order and reviewer
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_reviews_wo_reviewer_unique_idx" ON "vendor_reviews" ("work_order_id", "reviewer_user_id");
--> statement-breakpoint

-- Step 5: Grant least-privilege DML permissions to application role
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'homehub_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "property_reviews" TO "homehub_app";
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "vendor_reviews" TO "homehub_app";
  END IF;
END $$;
