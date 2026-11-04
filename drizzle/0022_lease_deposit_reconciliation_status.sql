ALTER TABLE "leases" ADD COLUMN IF NOT EXISTS "deposit_reconciliation_status" text DEFAULT 'NOT_APPLICABLE' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leases_status_deposit_reconcil_idx" ON "leases" ("status", "deposit_reconciliation_status");
