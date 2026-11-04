-- Step 1: Add composite unique constraints to parent tables if they don't already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'move_out_requests_id_lease_id_unique'
  ) THEN
    ALTER TABLE "move_out_requests" ADD CONSTRAINT "move_out_requests_id_lease_id_unique" UNIQUE ("id", "lease_id");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'security_deposits_id_lease_id_unique'
  ) THEN
    ALTER TABLE "security_deposits" ADD CONSTRAINT "security_deposits_id_lease_id_unique" UNIQUE ("id", "lease_id");
  END IF;
END $$;
--> statement-breakpoint

-- Step 2: Create lease_move_out_inspections table
CREATE TABLE IF NOT EXISTS "lease_move_out_inspections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" text NOT NULL,
	"move_out_request_id" text,
	"property_id" text NOT NULL,
	"inspector_id" text NOT NULL,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"has_move_in_baseline" boolean DEFAULT false NOT NULL,
	"move_in_baseline_reference" text,
	"general_notes" text,
	"tenant_present" boolean DEFAULT false NOT NULL,
	"tenant_signature_ref" text,
	"metadata" jsonb,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Foreign keys for lease_move_out_inspections
DO $$ BEGIN
 ALTER TABLE "lease_move_out_inspections" ADD CONSTRAINT "lease_move_out_inspections_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lease_move_out_inspections" ADD CONSTRAINT "lease_move_out_inspections_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lease_move_out_inspections" ADD CONSTRAINT "lease_move_out_inspections_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lease_move_out_inspections" ADD CONSTRAINT "lease_move_out_inspections_req_lease_fk" FOREIGN KEY ("move_out_request_id", "lease_id") REFERENCES "public"."move_out_requests"("id", "lease_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Check constraints for lease_move_out_inspections
DO $$ BEGIN
  ALTER TABLE "lease_move_out_inspections" DROP CONSTRAINT IF EXISTS "lease_move_out_inspections_status_check";
  ALTER TABLE "lease_move_out_inspections" ADD CONSTRAINT "lease_move_out_inspections_status_check" CHECK ("status" IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lease_move_out_inspections" DROP CONSTRAINT IF EXISTS "lease_move_out_inspections_baseline_check";
  ALTER TABLE "lease_move_out_inspections" ADD CONSTRAINT "lease_move_out_inspections_baseline_check" CHECK ("has_move_in_baseline" = true OR "move_in_baseline_reference" IS NULL);
END $$;
--> statement-breakpoint

-- Indexes for lease_move_out_inspections
CREATE INDEX IF NOT EXISTS "lease_move_out_inspections_lease_idx" ON "lease_move_out_inspections" ("lease_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lease_move_out_inspections_property_idx" ON "lease_move_out_inspections" ("property_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lease_move_out_inspections_status_idx" ON "lease_move_out_inspections" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lease_move_out_inspections_req_idx" ON "lease_move_out_inspections" ("move_out_request_id");
--> statement-breakpoint

-- Step 3: Create lease_move_out_inspection_items table
CREATE TABLE IF NOT EXISTS "lease_move_out_inspection_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" text NOT NULL,
	"area" text NOT NULL,
	"component" text NOT NULL,
	"condition" text NOT NULL,
	"damage_description" text,
	"is_tenant_caused" boolean DEFAULT false NOT NULL,
	"estimated_repair_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"evidence_refs" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Foreign keys for lease_move_out_inspection_items
DO $$ BEGIN
 ALTER TABLE "lease_move_out_inspection_items" ADD CONSTRAINT "lease_move_out_inspection_items_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."lease_move_out_inspections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Check constraints for lease_move_out_inspection_items
DO $$ BEGIN
  ALTER TABLE "lease_move_out_inspection_items" DROP CONSTRAINT IF EXISTS "lease_move_out_items_condition_check";
  ALTER TABLE "lease_move_out_inspection_items" ADD CONSTRAINT "lease_move_out_items_condition_check" CHECK ("condition" IN ('EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'MISSING', 'DIRTY'));
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lease_move_out_inspection_items" DROP CONSTRAINT IF EXISTS "lease_move_out_items_currency_check";
  ALTER TABLE "lease_move_out_inspection_items" ADD CONSTRAINT "lease_move_out_items_currency_check" CHECK ("currency" IN ('IQD', 'USD'));
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lease_move_out_inspection_items" DROP CONSTRAINT IF EXISTS "lease_move_out_items_repair_cost_check";
  ALTER TABLE "lease_move_out_inspection_items" ADD CONSTRAINT "lease_move_out_items_repair_cost_check" CHECK ("estimated_repair_cost"::numeric >= 0);
END $$;
--> statement-breakpoint

-- Indexes for lease_move_out_inspection_items
CREATE INDEX IF NOT EXISTS "lease_move_out_items_inspection_idx" ON "lease_move_out_inspection_items" ("inspection_id");
--> statement-breakpoint

-- Step 4: Create security_deposit_deductions table
CREATE TABLE IF NOT EXISTS "security_deposit_deductions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deposit_id" text NOT NULL,
	"lease_id" text NOT NULL,
	"inspection_item_id" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"evidence_refs" jsonb,
	"proposed_by_id" text NOT NULL,
	"proposed_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'PROPOSED' NOT NULL,
	"approved_by_id" text,
	"approved_at" timestamp,
	"rejection_reason" text,
	"disputed_at" timestamp,
	"dispute_reason" text,
	"dispute_deadline" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Foreign keys for security_deposit_deductions
DO $$ BEGIN
 ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "security_deposit_deductions_dep_lease_fk" FOREIGN KEY ("deposit_id", "lease_id") REFERENCES "public"."security_deposits"("id", "lease_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "security_deposit_deductions_item_fk" FOREIGN KEY ("inspection_item_id") REFERENCES "public"."lease_move_out_inspection_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "security_deposit_deductions_proposed_by_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "security_deposit_deductions_approved_by_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Check constraints for security_deposit_deductions
DO $$ BEGIN
  ALTER TABLE "security_deposit_deductions" DROP CONSTRAINT IF EXISTS "sec_dep_deductions_amount_check";
  ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "sec_dep_deductions_amount_check" CHECK ("amount"::numeric > 0);
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "security_deposit_deductions" DROP CONSTRAINT IF EXISTS "sec_dep_deductions_currency_check";
  ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "sec_dep_deductions_currency_check" CHECK ("currency" IN ('IQD', 'USD'));
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "security_deposit_deductions" DROP CONSTRAINT IF EXISTS "sec_dep_deductions_category_check";
  ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "sec_dep_deductions_category_check" CHECK ("category" IN ('DAMAGE', 'CLEANING', 'KEY_REPLACEMENT', 'UNPAID_UTILITIES', 'OTHER'));
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "security_deposit_deductions" DROP CONSTRAINT IF EXISTS "sec_dep_deductions_status_check";
  ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "sec_dep_deductions_status_check" CHECK ("status" IN ('PROPOSED', 'OWNER_APPROVED', 'REJECTED', 'DISPUTED', 'SETTLED', 'CANCELLED'));
END $$;
--> statement-breakpoint

-- Indexes for security_deposit_deductions
CREATE INDEX IF NOT EXISTS "sec_dep_deductions_deposit_idx" ON "security_deposit_deductions" ("deposit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sec_dep_deductions_lease_idx" ON "security_deposit_deductions" ("lease_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sec_dep_deductions_status_idx" ON "security_deposit_deductions" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sec_dep_deductions_deadline_idx" ON "security_deposit_deductions" ("dispute_deadline");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sec_dep_deductions_item_idx" ON "security_deposit_deductions" ("inspection_item_id");
