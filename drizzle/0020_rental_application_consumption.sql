ALTER TABLE "leases" ADD COLUMN IF NOT EXISTS "rental_application_id" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leases" ADD CONSTRAINT "leases_rental_application_id_rental_applications_id_fk" FOREIGN KEY ("rental_application_id") REFERENCES "public"."rental_applications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leases_rental_application_active_unique" 
ON "leases" ("rental_application_id") 
WHERE "rental_application_id" IS NOT NULL 
  AND "status" IN ('PENDING_APPROVAL', 'PENDING_SIGNATURE', 'ACTIVE');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rental_applications_active_unique" 
ON "rental_applications" ("applicant_user_id", "property_id") 
WHERE "status" IN ('SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'APPROVED');
