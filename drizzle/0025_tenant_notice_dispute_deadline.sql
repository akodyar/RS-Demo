-- Step 1: Make dispute_deadline nullable so draft proposals do not prematurely start dispute window
ALTER TABLE "security_deposit_deductions" ALTER COLUMN "dispute_deadline" DROP NOT NULL;
--> statement-breakpoint

-- Step 2: Add tenant notice tracking columns
ALTER TABLE "security_deposit_deductions" ADD COLUMN IF NOT EXISTS "tenant_notified_at" timestamp;
--> statement-breakpoint
ALTER TABLE "security_deposit_deductions" ADD COLUMN IF NOT EXISTS "notice_notification_id" text;
--> statement-breakpoint
ALTER TABLE "security_deposit_deductions" ADD COLUMN IF NOT EXISTS "notice_delivery_id" text;
--> statement-breakpoint
ALTER TABLE "security_deposit_deductions" ADD COLUMN IF NOT EXISTS "notice_delivery_status" text DEFAULT 'NOT_SENT';
--> statement-breakpoint

-- Step 3: Foreign keys
DO $$ BEGIN
  ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "sec_dep_deductions_notif_fk" FOREIGN KEY ("notice_notification_id") REFERENCES "public"."notifications"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "security_deposit_deductions" ADD CONSTRAINT "sec_dep_deductions_deliv_fk" FOREIGN KEY ("notice_delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Step 4: Index on notice delivery status
CREATE INDEX IF NOT EXISTS "sec_dep_deductions_notice_status_idx" ON "security_deposit_deductions" ("notice_delivery_status");
