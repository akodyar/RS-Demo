ALTER TABLE "units" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "units" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "units" DROP CONSTRAINT IF EXISTS "units_currency_check";--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
ALTER TABLE "rent_schedules" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
ALTER TABLE "payment_records" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
ALTER TABLE "ledger_lines" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "ledger_lines" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "ledger_lines" DROP CONSTRAINT IF EXISTS "ledger_lines_currency_check";--> statement-breakpoint
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "security_deposits" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "security_deposits" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "security_deposits" DROP CONSTRAINT IF EXISTS "security_deposits_currency_check";--> statement-breakpoint
ALTER TABLE "security_deposits" ADD CONSTRAINT "security_deposits_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "maintenance_quotes" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "maintenance_quotes" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "maintenance_quotes" DROP CONSTRAINT IF EXISTS "maintenance_quotes_currency_check";--> statement-breakpoint
ALTER TABLE "maintenance_quotes" ADD CONSTRAINT "maintenance_quotes_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "maintenance_invoices" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "maintenance_invoices" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "maintenance_invoices" DROP CONSTRAINT IF EXISTS "maintenance_invoices_currency_check";--> statement-breakpoint
ALTER TABLE "maintenance_invoices" ADD CONSTRAINT "maintenance_invoices_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "agent_leads" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "agent_leads" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "agent_leads" DROP CONSTRAINT IF EXISTS "agent_leads_currency_check";--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "agent_commissions" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "agent_commissions" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "agent_commissions" DROP CONSTRAINT IF EXISTS "agent_commissions_currency_check";--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "vendor_profiles" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "vendor_profiles" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "vendor_profiles" DROP CONSTRAINT IF EXISTS "vendor_profiles_currency_check";--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "chart_of_accounts" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" DROP CONSTRAINT IF EXISTS "chart_of_accounts_currency_check";--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "accounts_receivable" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "accounts_receivable" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "accounts_receivable" DROP CONSTRAINT IF EXISTS "accounts_receivable_currency_check";--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "accounts_payable" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "accounts_payable" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "accounts_payable" DROP CONSTRAINT IF EXISTS "accounts_payable_currency_check";--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "refund_records" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "refund_records" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "refund_records" DROP CONSTRAINT IF EXISTS "refund_records_currency_check";--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "bank_accounts" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "bank_accounts" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" DROP CONSTRAINT IF EXISTS "bank_accounts_currency_check";--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "bank_statements" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "bank_statements" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "bank_statements" DROP CONSTRAINT IF EXISTS "bank_statements_currency_check";--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "property_valuations" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "property_valuations" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "property_valuations" DROP CONSTRAINT IF EXISTS "property_valuations_currency_check";--> statement-breakpoint
ALTER TABLE "property_valuations" ADD CONSTRAINT "property_valuations_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "portfolio_snapshots" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" DROP CONSTRAINT IF EXISTS "portfolio_snapshots_currency_check";--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "buyer_profiles" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "buyer_profiles" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "buyer_profiles" DROP CONSTRAINT IF EXISTS "buyer_profiles_currency_check";--> statement-breakpoint
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "property_offers" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "property_offers" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "property_offers" DROP CONSTRAINT IF EXISTS "property_offers_currency_check";--> statement-breakpoint
ALTER TABLE "property_offers" ADD CONSTRAINT "property_offers_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "offer_counter_history" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "offer_counter_history" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "offer_counter_history" DROP CONSTRAINT IF EXISTS "offer_counter_history_currency_check";--> statement-breakpoint
ALTER TABLE "offer_counter_history" ADD CONSTRAINT "offer_counter_history_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "sales_contracts" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "sales_contracts" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "sales_contracts" DROP CONSTRAINT IF EXISTS "sales_contracts_currency_check";--> statement-breakpoint
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "sales_transactions" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "sales_transactions" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "sales_transactions" DROP CONSTRAINT IF EXISTS "sales_transactions_currency_check";--> statement-breakpoint
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_currency_check" CHECK ("currency" IN ('IQD', 'USD'));--> statement-breakpoint
ALTER TABLE "utility_payments" ALTER COLUMN "currency" SET DEFAULT 'IQD';--> statement-breakpoint
UPDATE "utility_payments" SET "currency" = 'IQD' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "utility_payments" DROP CONSTRAINT IF EXISTS "utility_payments_currency_check";--> statement-breakpoint
ALTER TABLE "utility_payments" ADD CONSTRAINT "utility_payments_currency_check" CHECK ("currency" IN ('IQD', 'USD'));
