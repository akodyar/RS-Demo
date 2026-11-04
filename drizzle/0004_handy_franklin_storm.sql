CREATE TABLE "portfolio_snapshots" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"company_id" text,
	"snapshot_date" text NOT NULL,
	"total_properties" integer NOT NULL,
	"total_units" integer NOT NULL,
	"occupancy_rate" numeric NOT NULL,
	"gross_revenue" numeric NOT NULL,
	"operating_expenses" numeric NOT NULL,
	"net_operating_income" numeric NOT NULL,
	"total_asset_value" numeric,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "property_valuations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL,
	"valuation_date" text NOT NULL,
	"estimated_value" numeric NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"method" text NOT NULL,
	"source" text NOT NULL,
	"confidence_indicator" text DEFAULT 'MEDIUM',
	"reviewer_user_id" text,
	"document_url" text,
	"notes" text,
	"status" text DEFAULT 'FINAL' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "acquisition_cost" numeric;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "acquisition_date" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_valuations" ADD CONSTRAINT "property_valuations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_valuations" ADD CONSTRAINT "property_valuations_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_snap_owner_date_idx" ON "portfolio_snapshots" USING btree ("owner_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "portfolio_snap_company_date_idx" ON "portfolio_snapshots" USING btree ("company_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "prop_val_prop_date_status_idx" ON "property_valuations" USING btree ("property_id","valuation_date","status");--> statement-breakpoint
CREATE INDEX "journal_entries_prop_date_idx" ON "journal_entries" USING btree ("property_id","date");--> statement-breakpoint
CREATE INDEX "payment_records_prop_status_date_idx" ON "payment_records" USING btree ("property_id","status","recorded_date");--> statement-breakpoint
CREATE INDEX "rent_schedules_prop_due_status_idx" ON "rent_schedules" USING btree ("property_id","due_date","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "buyer_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL UNIQUE REFERENCES "users"("id"),
	"budget_min" numeric,
	"budget_max" numeric,
	"preferred_cities" jsonb,
	"preferred_property_types" jsonb,
	"min_bedrooms" integer,
	"min_bathrooms" numeric,
	"min_area_sqm" numeric,
	"purchase_purpose" text DEFAULT 'PRIMARY_RESIDENCE',
	"financing_status" text DEFAULT 'CASH',
	"preferred_currency" text DEFAULT 'IQD',
	"notification_preferences" jsonb,
	"is_profile_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "buyer_favorites" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL REFERENCES "users"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"listing_id" text REFERENCES "listings"("id"),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "buyer_property_favorite_unique" UNIQUE("buyer_id", "property_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_searches" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL REFERENCES "users"("id"),
	"name" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"notifications_enabled" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_inquiries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL REFERENCES "users"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"listing_id" text REFERENCES "listings"("id"),
	"message" text NOT NULL,
	"status" text DEFAULT 'PENDING',
	"recipient_user_id" text REFERENCES "users"("id"),
	"recipient_company_id" text REFERENCES "organizations"("id"),
	"response_message" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_viewings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL REFERENCES "users"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"listing_id" text REFERENCES "listings"("id"),
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"viewing_type" text DEFAULT 'IN_PERSON',
	"notes" text,
	"cancellation_reason" text,
	"cancelled_by" text,
	"organizer_user_id" text REFERENCES "users"("id"),
	"organizer_company_id" text REFERENCES "organizations"("id"),
	"feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_offers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL REFERENCES "users"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"listing_id" text REFERENCES "listings"("id"),
	"offer_amount" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"deposit_amount" numeric,
	"financing_type" text DEFAULT 'CASH',
	"terms" text,
	"conditions" jsonb,
	"status" text DEFAULT 'OFFER_SUBMITTED' NOT NULL,
	"expires_at" timestamp,
	"seller_user_id" text REFERENCES "users"("id"),
	"seller_company_id" text REFERENCES "organizations"("id"),
	"rejection_reason" text,
	"withdrawn_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offer_counter_history" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" text NOT NULL REFERENCES "property_offers"("id"),
	"actor_id" text NOT NULL REFERENCES "users"("id"),
	"actor_role" text NOT NULL,
	"counter_amount" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"counter_terms" text,
	"status" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_contracts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" text NOT NULL REFERENCES "property_offers"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"listing_id" text REFERENCES "listings"("id"),
	"buyer_id" text NOT NULL REFERENCES "users"("id"),
	"seller_id" text NOT NULL REFERENCES "users"("id"),
	"contract_number" text NOT NULL UNIQUE,
	"agreed_price" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"deposit_amount" numeric,
	"status" text DEFAULT 'DRAFTED' NOT NULL,
	"document_url" text,
	"document_ids" jsonb,
	"terms" text,
	"execution_date" timestamp,
	"closing_deadline" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" text NOT NULL REFERENCES "sales_contracts"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"buyer_id" text NOT NULL REFERENCES "users"("id"),
	"seller_id" text NOT NULL REFERENCES "users"("id"),
	"transaction_number" text NOT NULL UNIQUE,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"status" text DEFAULT 'TRANSACTION_OPENED' NOT NULL,
	"due_diligence_status" text DEFAULT 'PENDING',
	"settlement_details" jsonb,
	"ownership_transition_ref" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL UNIQUE REFERENCES "users"("id"),
	"display_name" text NOT NULL,
	"professional_title" text DEFAULT 'Real Estate Agent' NOT NULL,
	"biography" text,
	"phone" text,
	"email" text,
	"avatar_url" text,
	"office_name" text,
	"office_address" text,
	"spoken_languages" jsonb,
	"specialties" jsonb,
	"property_types" jsonb,
	"service_areas" jsonb,
	"availability_status" text DEFAULT 'AVAILABLE' NOT NULL,
	"working_hours" jsonb,
	"status" text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_licenses" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL REFERENCES "agent_profiles"("id"),
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"license_number" text NOT NULL,
	"issuing_authority" text NOT NULL,
	"issued_date" text,
	"expiry_date" text,
	"document_url" text,
	"verification_status" text DEFAULT 'SUBMITTED' NOT NULL,
	"reviewed_by" text REFERENCES "users"("id"),
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_property_assignments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text REFERENCES "agent_profiles"("id"),
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"company_id" text REFERENCES "organizations"("id"),
	"assigned_by" text NOT NULL REFERENCES "users"("id"),
	"permissions" jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"effective_date" timestamp DEFAULT now(),
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_leads" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text REFERENCES "agent_profiles"("id"),
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"company_id" text REFERENCES "organizations"("id"),
	"client_name" text NOT NULL,
	"client_phone" text,
	"client_email" text,
	"lead_type" text DEFAULT 'BUY' NOT NULL,
	"stage" text DEFAULT 'NEW' NOT NULL,
	"budget_min" numeric,
	"budget_max" numeric,
	"currency" text DEFAULT 'USD' NOT NULL,
	"preferred_locations" jsonb,
	"property_type" text,
	"notes" text,
	"next_follow_up" timestamp,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"source" text DEFAULT 'MARKETPLACE_INQUIRY' NOT NULL,
	"linked_buyer_id" text REFERENCES "users"("id"),
	"linked_property_id" text REFERENCES "properties"("id"),
	"linked_listing_id" text REFERENCES "listings"("id"),
	"linked_inquiry_id" text REFERENCES "property_inquiries"("id"),
	"linked_viewing_id" text REFERENCES "property_viewings"("id"),
	"linked_offer_id" text REFERENCES "property_offers"("id"),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text REFERENCES "agent_profiles"("id"),
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"company_id" text REFERENCES "organizations"("id"),
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"due_date" timestamp,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"category" text DEFAULT 'GENERAL' NOT NULL,
	"linked_lead_id" text REFERENCES "agent_leads"("id"),
	"linked_property_id" text REFERENCES "properties"("id"),
	"linked_viewing_id" text REFERENCES "property_viewings"("id"),
	"linked_offer_id" text REFERENCES "property_offers"("id"),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_commissions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text REFERENCES "agent_profiles"("id"),
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"company_id" text REFERENCES "organizations"("id"),
	"transaction_id" text REFERENCES "sales_transactions"("id"),
	"contract_id" text REFERENCES "sales_contracts"("id"),
	"property_id" text REFERENCES "properties"("id"),
	"listing_id" text REFERENCES "listings"("id"),
	"deal_amount" numeric NOT NULL,
	"deal_type" text DEFAULT 'SALE' NOT NULL,
	"commission_basis" text DEFAULT 'PERCENTAGE' NOT NULL,
	"gross_commission_rate" numeric,
	"gross_commission_amount" numeric NOT NULL,
	"brokerage_split_rate" numeric DEFAULT '0.30',
	"brokerage_share_amount" numeric NOT NULL,
	"agent_share_amount" numeric NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'CALCULATED' NOT NULL,
	"approved_by" text REFERENCES "users"("id"),
	"approved_at" timestamp,
	"disbursed_at" timestamp,
	"payment_reference" text,
	"journal_entry_id" text REFERENCES "journal_entries"("id"),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"title" text NOT NULL,
	"event_type" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"location" text,
	"meeting_link" text,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"linked_lead_id" text REFERENCES "agent_leads"("id"),
	"linked_viewing_id" text REFERENCES "property_viewings"("id"),
	"linked_property_id" text REFERENCES "properties"("id"),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL REFERENCES "organizations"("id"),
	"status" text DEFAULT 'ACTIVE',
	"categories" jsonb,
	"coverage_area_ids" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_quotes" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_request_id" text NOT NULL REFERENCES "maintenance_requests"("id"),
	"vendor_id" text,
	"vendor_user_id" text REFERENCES "users"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"total_amount" numeric NOT NULL,
	"labor_amount" numeric,
	"materials_amount" numeric,
	"fees_amount" numeric,
	"currency" text DEFAULT 'USD',
	"estimated_duration" text,
	"warranty_terms" text,
	"line_items" jsonb,
	"valid_until" text,
	"revision_number" integer DEFAULT 1,
	"status" text DEFAULT 'PENDING_APPROVAL',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_orders" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_request_id" text NOT NULL REFERENCES "maintenance_requests"("id"),
	"quote_id" text REFERENCES "maintenance_quotes"("id"),
	"vendor_id" text,
	"vendor_user_id" text REFERENCES "users"("id"),
	"assigned_technician_id" text REFERENCES "users"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"priority" text DEFAULT 'MEDIUM',
	"status" text DEFAULT 'SCHEDULED',
	"scheduled_start_date" text,
	"scheduled_end_date" text,
	"actual_start_date" text,
	"actual_end_date" text,
	"scope_of_work" text,
	"materials_used" jsonb,
	"completion_notes" text,
	"completion_photos" jsonb,
	"rating" numeric(3, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inspections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" text NOT NULL REFERENCES "work_orders"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"inspector_id" text NOT NULL REFERENCES "users"("id"),
	"status" text DEFAULT 'PASSED',
	"findings" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"unit_id" text REFERENCES "units"("id"),
	"name" text NOT NULL,
	"type" text NOT NULL,
	"serial_number" text,
	"installation_date" text,
	"warranty_expiration_date" text,
	"status" text DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preventive_maintenance_plans" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"asset_id" text REFERENCES "assets"("id"),
	"category" text NOT NULL,
	"frequency" text NOT NULL,
	"next_due_date" text NOT NULL,
	"assigned_vendor_id" text REFERENCES "organizations"("id"),
	"status" text DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_invoices" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" text NOT NULL REFERENCES "work_orders"("id"),
	"quote_id" text REFERENCES "maintenance_quotes"("id"),
	"property_id" text NOT NULL REFERENCES "properties"("id"),
	"vendor_id" text,
	"vendor_user_id" text REFERENCES "users"("id"),
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'USD',
	"status" text DEFAULT 'PENDING',
	"payment_reference" text,
	"invoice_number" text,
	"due_date" text,
	"line_items" jsonb,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL UNIQUE REFERENCES "users"("id"),
	"organization_id" text REFERENCES "organizations"("id"),
	"business_name" text NOT NULL,
	"legal_name" text,
	"bio" text,
	"categories" jsonb,
	"specialties" jsonb,
	"service_areas" jsonb,
	"phone" text,
	"email" text,
	"working_hours" jsonb,
	"emergency_available" boolean DEFAULT false,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"verification_status" text DEFAULT 'PENDING' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '5.00',
	"review_count" integer DEFAULT 0,
	"hourly_rate" numeric,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_licenses" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" text NOT NULL REFERENCES "vendor_profiles"("id"),
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"license_type" text NOT NULL,
	"license_number" text NOT NULL,
	"issuing_authority" text NOT NULL,
	"issue_date" timestamp,
	"expiry_date" timestamp,
	"document_url" text,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"verified_by" text REFERENCES "users"("id"),
	"verified_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" text REFERENCES "vendor_profiles"("id"),
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"due_date" timestamp,
	"linked_work_order_id" text REFERENCES "work_orders"("id"),
	"linked_request_id" text REFERENCES "maintenance_requests"("id"),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" text REFERENCES "vendor_profiles"("id"),
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"title" text NOT NULL,
	"event_type" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"location" text,
	"linked_work_order_id" text REFERENCES "work_orders"("id"),
	"linked_property_id" text REFERENCES "properties"("id"),
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_reviews" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" text NOT NULL REFERENCES "vendor_profiles"("id"),
	"work_order_id" text NOT NULL REFERENCES "work_orders"("id"),
	"reviewer_user_id" text NOT NULL REFERENCES "users"("id"),
	"reviewer_role" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"vendor_response" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
