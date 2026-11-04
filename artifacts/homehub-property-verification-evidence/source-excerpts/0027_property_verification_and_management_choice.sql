-- Step 1: Add verification and management preference columns to properties table
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "verification_status" text DEFAULT 'PENDING_VERIFICATION' NOT NULL;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "management_preference" text;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "management_arrangement_status" text DEFAULT 'NOT_APPLICABLE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "verified_at" timestamp;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "verified_by" text;
--> statement-breakpoint

-- Step 2: Foreign key for verified_by
DO $$ BEGIN
  ALTER TABLE "properties" ADD CONSTRAINT "properties_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Step 3: Populate verification_status for existing properties from ownership_records
UPDATE "properties" p
SET "verification_status" = 'VERIFIED'
FROM "ownership_records" o
WHERE o."property_id" = p."id" AND o."status" = 'VERIFIED';
--> statement-breakpoint

-- Step 4: Indexes for performance
CREATE INDEX IF NOT EXISTS "properties_verification_status_idx" ON "properties" ("verification_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_mgmt_pref_idx" ON "properties" ("management_preference");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_mgmt_arr_idx" ON "properties" ("management_arrangement_status");
