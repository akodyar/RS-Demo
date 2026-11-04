ALTER TABLE "idempotency_records" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lease_move_out_inspection_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lease_move_out_inspections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points_purchase_orders" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points_purchase_packages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points_reward_grants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points_reward_rules" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points_transactions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points_wallets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "promotion_campaigns" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "promotion_packages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_reviews" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "security_deposit_deductions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "idempotency_records" CASCADE;--> statement-breakpoint
DROP TABLE "lease_move_out_inspection_items" CASCADE;--> statement-breakpoint
DROP TABLE "lease_move_out_inspections" CASCADE;--> statement-breakpoint
DROP TABLE "password_reset_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "points_purchase_orders" CASCADE;--> statement-breakpoint
DROP TABLE "points_purchase_packages" CASCADE;--> statement-breakpoint
DROP TABLE "points_reward_grants" CASCADE;--> statement-breakpoint
DROP TABLE "points_reward_rules" CASCADE;--> statement-breakpoint
DROP TABLE "points_transactions" CASCADE;--> statement-breakpoint
DROP TABLE "points_wallets" CASCADE;--> statement-breakpoint
DROP TABLE "promotion_campaigns" CASCADE;--> statement-breakpoint
DROP TABLE "promotion_packages" CASCADE;--> statement-breakpoint
DROP TABLE "property_reviews" CASCADE;--> statement-breakpoint
DROP TABLE "security_deposit_deductions" CASCADE;--> statement-breakpoint
ALTER TABLE "units" DROP CONSTRAINT "units_property_unit_unique";--> statement-breakpoint
ALTER TABLE "leases" DROP CONSTRAINT "leases_rental_application_id_rental_applications_id_fk";
--> statement-breakpoint
ALTER TABLE "properties" DROP CONSTRAINT "properties_verified_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "vendor_reviews_wo_reviewer_unique_idx";--> statement-breakpoint
ALTER TABLE "accounts_payable" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "accounts_receivable" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "agent_commissions" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "agent_leads" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "bank_accounts" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "bank_statements" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "ledger_lines" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "maintenance_invoices" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "maintenance_quotes" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "payment_records" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "status" SET DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "currency" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "property_valuations" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "refund_records" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "rent_schedules" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "security_deposits" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "units" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "utility_payments" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "vendor_profiles" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
CREATE INDEX "commissions_property_id_idx" ON "commissions" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "commissions_lease_id_idx" ON "commissions" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "commissions_company_id_idx" ON "commissions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "commissions_owner_id_idx" ON "commissions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "lease_tenants_lease_id_idx" ON "lease_tenants" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "lease_tenants_tenant_id_idx" ON "lease_tenants" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "leases_property_id_idx" ON "leases" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "leases_unit_id_idx" ON "leases" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "ledger_lines_journal_entry_id_idx" ON "ledger_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "ledger_lines_account_id_idx" ON "ledger_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "maintenance_requests_property_id_idx" ON "maintenance_requests" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "maintenance_requests_reporter_user_id_idx" ON "maintenance_requests" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX "maintenance_requests_assigned_vendor_id_idx" ON "maintenance_requests" USING btree ("assigned_vendor_id");--> statement-breakpoint
CREATE INDEX "management_agreements_property_id_idx" ON "management_agreements" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "management_agreements_company_id_idx" ON "management_agreements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "management_agreements_owner_id_idx" ON "management_agreements" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "owner_settlements_property_id_idx" ON "owner_settlements" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "owner_settlements_company_id_idx" ON "owner_settlements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ownership_records_property_id_idx" ON "ownership_records" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "ownership_records_owner_id_idx" ON "ownership_records" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "ownership_records_company_id_idx" ON "ownership_records" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "properties_status_idx" ON "properties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "properties_managed_by_agent_id_idx" ON "properties" USING btree ("managed_by_agent_id");--> statement-breakpoint
CREATE INDEX "security_deposits_property_id_idx" ON "security_deposits" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "security_deposits_lease_id_idx" ON "security_deposits" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "security_deposits_tenant_id_idx" ON "security_deposits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "units_property_id_idx" ON "units" USING btree ("property_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_roles_is_array" CHECK ("users"."roles" IS NULL OR jsonb_typeof("users"."roles") = 'array');