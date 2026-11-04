ALTER TABLE "leases" ALTER COLUMN "deposit_reconciliation_status" SET DEFAULT 'NOT_EVALUATED';
--> statement-breakpoint
UPDATE "leases"
SET "deposit_reconciliation_status" = 'NOT_EVALUATED'
WHERE "status" IN ('ACTIVE', 'DRAFT', 'PENDING_APPROVAL', 'PENDING_SIGNATURE', 'EXPIRING')
  AND "deposit_reconciliation_status" = 'NOT_APPLICABLE';
--> statement-breakpoint
UPDATE "leases"
SET "deposit_reconciliation_status" = 'UNRESOLVED'
WHERE "status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
  AND "deposit_reconciliation_status" != 'UNRESOLVED'
  AND (
    EXISTS (
      SELECT 1 FROM "security_deposits" sd
      WHERE sd."lease_id" = "leases"."id"
        AND (
          sd."status" IN ('HELD', 'PENDING', 'PARTIALLY_COLLECTED', 'PARTIALLY_REFUNDED')
          OR sd."recorded_amount"::numeric > sd."released_amount"::numeric
          OR sd."released_amount"::numeric > sd."recorded_amount"::numeric
          OR sd."status" != 'REFUNDED'
        )
    )
    OR (
      "status" IN ('TERMINATED', 'EXPIRED')
      AND COALESCE("deposit_amount"::numeric, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM "security_deposits" sd
        WHERE sd."lease_id" = "leases"."id"
      )
    )
  );
--> statement-breakpoint
UPDATE "leases"
SET "deposit_reconciliation_status" = 'RECONCILED'
WHERE "status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
  AND "deposit_reconciliation_status" NOT IN ('RECONCILED', 'UNRESOLVED')
  AND EXISTS (
    SELECT 1 FROM "security_deposits" sd
    WHERE sd."lease_id" = "leases"."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "security_deposits" sd
    WHERE sd."lease_id" = "leases"."id"
      AND NOT (
        sd."status" = 'REFUNDED'
        AND sd."recorded_amount"::numeric > 0
        AND sd."released_amount"::numeric = sd."recorded_amount"::numeric
      )
  );
--> statement-breakpoint
UPDATE "leases"
SET "deposit_reconciliation_status" = 'NOT_APPLICABLE'
WHERE "status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
  AND "deposit_reconciliation_status" NOT IN ('NOT_APPLICABLE', 'UNRESOLVED', 'RECONCILED')
  AND COALESCE("deposit_amount"::numeric, 0) = 0
  AND NOT EXISTS (
    SELECT 1 FROM "security_deposits" sd
    WHERE sd."lease_id" = "leases"."id"
  );
