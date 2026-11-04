-- Step 1: Explicit, domain-aware backfill of existing properties based on established operating model
UPDATE "properties"
SET "management_preference" = 'HOMEHUB_MANAGED',
    "management_arrangement_status" = CASE 
      WHEN "management_arrangement_status" IS NULL OR "management_arrangement_status" = 'NOT_APPLICABLE' 
      THEN 'AWAITING_ONBOARDING' 
      ELSE "management_arrangement_status" 
    END
WHERE "management_preference" IS NULL 
  AND "operating_model" IN ('FULLY_MANAGED', 'AGENT_LISTED_PLATFORM_MANAGED');
--> statement-breakpoint

UPDATE "properties"
SET "management_preference" = 'AGENT_MANAGED',
    "management_arrangement_status" = CASE 
      WHEN "management_arrangement_status" IS NULL OR "management_arrangement_status" = 'NOT_APPLICABLE' 
      THEN 'AWAITING_AGREEMENT' 
      ELSE "management_arrangement_status" 
    END
WHERE "management_preference" IS NULL 
  AND "operating_model" = 'AGENT_OPERATED';
--> statement-breakpoint

UPDATE "properties"
SET "management_preference" = 'SELF_MANAGED'
WHERE "management_preference" IS NULL;
--> statement-breakpoint

-- Step 2: Set default to 'SELF_MANAGED' and enforce NOT NULL constraint
ALTER TABLE "properties" ALTER COLUMN "management_preference" SET DEFAULT 'SELF_MANAGED';
--> statement-breakpoint

ALTER TABLE "properties" ALTER COLUMN "management_preference" SET NOT NULL;
--> statement-breakpoint

-- Step 3: Add check constraint for allowed management preference values
DO $$ BEGIN
  ALTER TABLE "properties" ADD CONSTRAINT "properties_management_preference_check" 
    CHECK ("management_preference" IN ('SELF_MANAGED', 'HOMEHUB_MANAGED', 'AGENT_MANAGED'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
