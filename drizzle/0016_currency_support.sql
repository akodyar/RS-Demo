ALTER TABLE "properties" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "properties" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_currency_check";--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'IQD';--> statement-breakpoint
UPDATE "lease_renewals" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "lease_renewals" DROP CONSTRAINT IF EXISTS "lease_renewals_currency_check";--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD CONSTRAINT "lease_renewals_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "rental_applications" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'IQD';--> statement-breakpoint
UPDATE "rental_applications" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "rental_applications" DROP CONSTRAINT IF EXISTS "rental_applications_currency_check";--> statement-breakpoint
ALTER TABLE "rental_applications" ADD CONSTRAINT "rental_applications_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "leases" DROP CONSTRAINT IF EXISTS "leases_currency_check";--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "rent_schedules" DROP CONSTRAINT IF EXISTS "rent_schedules_currency_check";--> statement-breakpoint
ALTER TABLE "rent_schedules" ADD CONSTRAINT "rent_schedules_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "payment_records" DROP CONSTRAINT IF EXISTS "payment_records_currency_check";--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "listings_currency_check";--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "commissions" DROP CONSTRAINT IF EXISTS "commissions_currency_check";--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_currency_check" CHECK ("currency" IN ('IQD', 'USD'));
