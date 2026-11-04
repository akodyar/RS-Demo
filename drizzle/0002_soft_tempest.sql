CREATE TABLE "agent_commissions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text,
	"user_id" text NOT NULL,
	"company_id" text,
	"transaction_id" text,
	"contract_id" text,
	"property_id" text,
	"listing_id" text,
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
	"approved_by" text,
	"approved_at" timestamp,
	"disbursed_at" timestamp,
	"payment_reference" text,
	"journal_entry_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"event_type" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"location" text,
	"meeting_link" text,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"linked_lead_id" text,
	"linked_viewing_id" text,
	"linked_property_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_leads" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text,
	"user_id" text NOT NULL,
	"company_id" text,
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
	"linked_buyer_id" text,
	"linked_property_id" text,
	"linked_listing_id" text,
	"linked_inquiry_id" text,
	"linked_viewing_id" text,
	"linked_offer_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_licenses" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"license_number" text NOT NULL,
	"issuing_authority" text NOT NULL,
	"issued_date" text,
	"expiry_date" text,
	"document_url" text,
	"verification_status" text DEFAULT 'SUBMITTED' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
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
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agent_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "agent_property_assignments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text,
	"user_id" text NOT NULL,
	"property_id" text NOT NULL,
	"company_id" text,
	"assigned_by" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"effective_date" timestamp DEFAULT now(),
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text,
	"user_id" text NOT NULL,
	"company_id" text,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"due_date" timestamp,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"category" text DEFAULT 'GENERAL' NOT NULL,
	"linked_lead_id" text,
	"linked_property_id" text,
	"linked_viewing_id" text,
	"linked_offer_id" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL,
	"unit_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"serial_number" text,
	"installation_date" text,
	"warranty_expiration_date" text,
	"status" text DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "buyer_favorites" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL,
	"property_id" text NOT NULL,
	"listing_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "buyer_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"budget_min" numeric,
	"budget_max" numeric,
	"currency" text DEFAULT 'IQD',
	"preferred_cities" jsonb,
	"preferred_property_types" jsonb,
	"min_beds" integer,
	"min_baths" numeric,
	"min_square_meters" integer,
	"purchase_purpose" text,
	"financing_status" text,
	"notification_preferences" jsonb,
	"is_complete" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "buyer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"account_type" text NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"system_account" boolean DEFAULT false NOT NULL,
	"parent_account_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chart_of_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_record_id" text NOT NULL,
	"property_id" text NOT NULL,
	"unit_id" text,
	"lease_id" text,
	"tenant_id" text NOT NULL,
	"owner_id" text,
	"company_id" text,
	"commission_type" text DEFAULT 'RENT_MANAGEMENT' NOT NULL,
	"rate" numeric DEFAULT '0.05' NOT NULL,
	"base_amount" numeric NOT NULL,
	"commission_amount" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"status" text DEFAULT 'POSTED' NOT NULL,
	"policy_version" text DEFAULT 'v1.0' NOT NULL,
	"journal_entry_id" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp,
	"reversed_at" timestamp,
	CONSTRAINT "commissions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "company_invitations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"assigned_property_ids" jsonb,
	"status" text DEFAULT 'PENDING',
	"expires_at" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text,
	"creator_user_id" text NOT NULL,
	"participant_ids" jsonb NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL,
	"owner_id" text,
	"uploader_user_id" text NOT NULL,
	"title" text NOT NULL,
	"document_type" text NOT NULL,
	"verification_state" text DEFAULT 'PENDING',
	"file_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" text NOT NULL,
	"target_currency" text NOT NULL,
	"rate" numeric NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_periods" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_policies" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_type" text NOT NULL,
	"policy_value" numeric NOT NULL,
	"currency" text,
	"active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "financial_policies_policy_type_unique" UNIQUE("policy_type")
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" text NOT NULL,
	"property_id" text NOT NULL,
	"inspector_id" text NOT NULL,
	"status" text DEFAULT 'PASSED',
	"findings" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lease_renewals" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" text NOT NULL,
	"property_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"proposed_start_date" text NOT NULL,
	"proposed_end_date" text NOT NULL,
	"proposed_rent_amount" numeric,
	"status" text DEFAULT 'REQUESTED',
	"tenant_notes" text,
	"owner_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL,
	"publisher_user_id" text NOT NULL,
	"publisher_company_id" text,
	"type" text NOT NULL,
	"price" numeric NOT NULL,
	"currency" text DEFAULT 'USD',
	"status" text DEFAULT 'DRAFT',
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "maintenance_invoices" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" text NOT NULL,
	"quote_id" text,
	"property_id" text NOT NULL,
	"vendor_id" text,
	"vendor_user_id" text,
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
CREATE TABLE "maintenance_quotes" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_request_id" text NOT NULL,
	"vendor_id" text,
	"vendor_user_id" text,
	"property_id" text NOT NULL,
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
CREATE TABLE "messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'TEXT',
	"read_by_user_ids" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "move_out_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" text NOT NULL,
	"property_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"requested_move_out_date" text NOT NULL,
	"reason" text,
	"forwarding_address" text,
	"status" text DEFAULT 'PENDING_REVIEW',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"property_id" text,
	"category" text NOT NULL,
	"priority" text DEFAULT 'NORMAL',
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false,
	"entity_id" text,
	"entity_type" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "offer_counter_history" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"counter_amount" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"counter_terms" text,
	"status" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL,
	"lease_id" text,
	"rent_schedule_id" text,
	"payer_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'USD',
	"payment_method" text,
	"reference_number" text,
	"status" text DEFAULT 'PENDING',
	"recorded_date" text NOT NULL,
	"receipt_number" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_records_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "preventive_maintenance_plans" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL,
	"asset_id" text,
	"category" text NOT NULL,
	"frequency" text NOT NULL,
	"next_due_date" text NOT NULL,
	"assigned_vendor_id" text,
	"status" text DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "property_inquiries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL,
	"property_id" text NOT NULL,
	"listing_id" text,
	"inquiry_type" text DEFAULT 'GENERAL',
	"message" text NOT NULL,
	"status" text DEFAULT 'PENDING',
	"recipient_user_id" text,
	"recipient_company_id" text,
	"response_message" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "property_offers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL,
	"property_id" text NOT NULL,
	"listing_id" text,
	"offer_amount" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"deposit_amount" numeric,
	"financing_type" text DEFAULT 'CASH',
	"terms" text,
	"conditions" jsonb,
	"status" text DEFAULT 'OFFER_SUBMITTED' NOT NULL,
	"expires_at" timestamp,
	"seller_user_id" text,
	"seller_company_id" text,
	"rejection_reason" text,
	"withdrawn_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "property_viewings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL,
	"property_id" text NOT NULL,
	"listing_id" text,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"viewing_type" text DEFAULT 'IN_PERSON',
	"notes" text,
	"cancellation_reason" text,
	"cancelled_by" text,
	"organizer_user_id" text,
	"organizer_company_id" text,
	"feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rent_schedules" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" text NOT NULL,
	"property_id" text NOT NULL,
	"unit_id" text,
	"tenant_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'USD',
	"due_date" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"status" text DEFAULT 'UPCOMING',
	"paid_amount" numeric DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rental_applications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL,
	"unit_id" text,
	"applicant_user_id" text NOT NULL,
	"status" text DEFAULT 'SUBMITTED',
	"monthly_income" numeric,
	"employment_status" text,
	"preferred_move_in_date" text,
	"notes" text,
	"submitted_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_contracts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" text NOT NULL,
	"property_id" text NOT NULL,
	"listing_id" text,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"contract_number" text NOT NULL,
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
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "sales_transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" text NOT NULL,
	"property_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"transaction_number" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"status" text DEFAULT 'TRANSACTION_OPENED' NOT NULL,
	"due_diligence_status" text DEFAULT 'PENDING',
	"settlement_details" jsonb,
	"ownership_transition_ref" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_transactions_transaction_number_unique" UNIQUE("transaction_number")
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL,
	"name" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"notify_on_match" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_deposits" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" text NOT NULL,
	"property_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"required_amount" numeric NOT NULL,
	"recorded_amount" numeric DEFAULT '0',
	"currency" text DEFAULT 'USD',
	"status" text DEFAULT 'PENDING',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"rate" numeric NOT NULL,
	"jurisdiction" text NOT NULL,
	"is_inclusive" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tax_rates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "vendor_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" text,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"event_type" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"location" text,
	"linked_work_order_id" text,
	"linked_property_id" text,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendor_licenses" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" text NOT NULL,
	"user_id" text NOT NULL,
	"license_type" text NOT NULL,
	"license_number" text NOT NULL,
	"issuing_authority" text NOT NULL,
	"issue_date" timestamp,
	"expiry_date" timestamp,
	"document_url" text,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"verified_by" text,
	"verified_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendor_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
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
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "vendor_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_reviews" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"reviewer_role" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"vendor_response" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendor_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" text,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"due_date" timestamp,
	"linked_work_order_id" text,
	"linked_request_id" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE',
	"categories" jsonb,
	"coverage_area_ids" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_request_id" text NOT NULL,
	"quote_id" text,
	"vendor_id" text,
	"vendor_user_id" text,
	"assigned_technician_id" text,
	"property_id" text NOT NULL,
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
ALTER TABLE "journal_entries" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "management_agreements" ADD COLUMN "spending_limit" numeric;--> statement-breakpoint
ALTER TABLE "management_agreements" ADD COLUMN "commission_rate" numeric;--> statement-breakpoint
ALTER TABLE "management_agreements" ADD COLUMN "approval_rules" jsonb;--> statement-breakpoint
ALTER TABLE "management_agreements" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "assigned_property_ids" jsonb;--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "registration_number" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "service_area" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "service_categories" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "team_size" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "spending_limit_default" numeric;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "status" text DEFAULT 'PENDING_VERIFICATION';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_agent_id_agent_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_transaction_id_sales_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."sales_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_contract_id_sales_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."sales_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_linked_lead_id_agent_leads_id_fk" FOREIGN KEY ("linked_lead_id") REFERENCES "public"."agent_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_linked_viewing_id_property_viewings_id_fk" FOREIGN KEY ("linked_viewing_id") REFERENCES "public"."property_viewings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_linked_property_id_properties_id_fk" FOREIGN KEY ("linked_property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_agent_id_agent_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_linked_buyer_id_users_id_fk" FOREIGN KEY ("linked_buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_linked_property_id_properties_id_fk" FOREIGN KEY ("linked_property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_linked_listing_id_listings_id_fk" FOREIGN KEY ("linked_listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_linked_inquiry_id_property_inquiries_id_fk" FOREIGN KEY ("linked_inquiry_id") REFERENCES "public"."property_inquiries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_linked_viewing_id_property_viewings_id_fk" FOREIGN KEY ("linked_viewing_id") REFERENCES "public"."property_viewings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_linked_offer_id_property_offers_id_fk" FOREIGN KEY ("linked_offer_id") REFERENCES "public"."property_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_licenses" ADD CONSTRAINT "agent_licenses_agent_id_agent_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_licenses" ADD CONSTRAINT "agent_licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_licenses" ADD CONSTRAINT "agent_licenses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_property_assignments" ADD CONSTRAINT "agent_property_assignments_agent_id_agent_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_property_assignments" ADD CONSTRAINT "agent_property_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_property_assignments" ADD CONSTRAINT "agent_property_assignments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_property_assignments" ADD CONSTRAINT "agent_property_assignments_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_property_assignments" ADD CONSTRAINT "agent_property_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_agent_id_agent_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_linked_lead_id_agent_leads_id_fk" FOREIGN KEY ("linked_lead_id") REFERENCES "public"."agent_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_linked_property_id_properties_id_fk" FOREIGN KEY ("linked_property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_linked_viewing_id_property_viewings_id_fk" FOREIGN KEY ("linked_viewing_id") REFERENCES "public"."property_viewings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_linked_offer_id_property_offers_id_fk" FOREIGN KEY ("linked_offer_id") REFERENCES "public"."property_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_favorites" ADD CONSTRAINT "buyer_favorites_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_favorites" ADD CONSTRAINT "buyer_favorites_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_favorites" ADD CONSTRAINT "buyer_favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_payment_record_id_payment_records_id_fk" FOREIGN KEY ("payment_record_id") REFERENCES "public"."payment_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploader_user_id_users_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD CONSTRAINT "lease_renewals_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD CONSTRAINT "lease_renewals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD CONSTRAINT "lease_renewals_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_publisher_user_id_users_id_fk" FOREIGN KEY ("publisher_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_publisher_company_id_organizations_id_fk" FOREIGN KEY ("publisher_company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_invoices" ADD CONSTRAINT "maintenance_invoices_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_invoices" ADD CONSTRAINT "maintenance_invoices_quote_id_maintenance_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."maintenance_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_invoices" ADD CONSTRAINT "maintenance_invoices_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_invoices" ADD CONSTRAINT "maintenance_invoices_vendor_user_id_users_id_fk" FOREIGN KEY ("vendor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_quotes" ADD CONSTRAINT "maintenance_quotes_maintenance_request_id_maintenance_requests_id_fk" FOREIGN KEY ("maintenance_request_id") REFERENCES "public"."maintenance_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_quotes" ADD CONSTRAINT "maintenance_quotes_vendor_user_id_users_id_fk" FOREIGN KEY ("vendor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_quotes" ADD CONSTRAINT "maintenance_quotes_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_out_requests" ADD CONSTRAINT "move_out_requests_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_out_requests" ADD CONSTRAINT "move_out_requests_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_out_requests" ADD CONSTRAINT "move_out_requests_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_counter_history" ADD CONSTRAINT "offer_counter_history_offer_id_property_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."property_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_counter_history" ADD CONSTRAINT "offer_counter_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_rent_schedule_id_rent_schedules_id_fk" FOREIGN KEY ("rent_schedule_id") REFERENCES "public"."rent_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preventive_maintenance_plans" ADD CONSTRAINT "preventive_maintenance_plans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preventive_maintenance_plans" ADD CONSTRAINT "preventive_maintenance_plans_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preventive_maintenance_plans" ADD CONSTRAINT "preventive_maintenance_plans_assigned_vendor_id_organizations_id_fk" FOREIGN KEY ("assigned_vendor_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_inquiries" ADD CONSTRAINT "property_inquiries_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_inquiries" ADD CONSTRAINT "property_inquiries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_inquiries" ADD CONSTRAINT "property_inquiries_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_inquiries" ADD CONSTRAINT "property_inquiries_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_inquiries" ADD CONSTRAINT "property_inquiries_recipient_company_id_organizations_id_fk" FOREIGN KEY ("recipient_company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_offers" ADD CONSTRAINT "property_offers_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_offers" ADD CONSTRAINT "property_offers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_offers" ADD CONSTRAINT "property_offers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_offers" ADD CONSTRAINT "property_offers_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_offers" ADD CONSTRAINT "property_offers_seller_company_id_organizations_id_fk" FOREIGN KEY ("seller_company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_viewings" ADD CONSTRAINT "property_viewings_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_viewings" ADD CONSTRAINT "property_viewings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_viewings" ADD CONSTRAINT "property_viewings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_viewings" ADD CONSTRAINT "property_viewings_organizer_user_id_users_id_fk" FOREIGN KEY ("organizer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_viewings" ADD CONSTRAINT "property_viewings_organizer_company_id_organizations_id_fk" FOREIGN KEY ("organizer_company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_schedules" ADD CONSTRAINT "rent_schedules_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_schedules" ADD CONSTRAINT "rent_schedules_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_schedules" ADD CONSTRAINT "rent_schedules_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_schedules" ADD CONSTRAINT "rent_schedules_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_applications" ADD CONSTRAINT "rental_applications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_applications" ADD CONSTRAINT "rental_applications_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_applications" ADD CONSTRAINT "rental_applications_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_offer_id_property_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."property_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_contract_id_sales_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."sales_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_deposits" ADD CONSTRAINT "security_deposits_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_deposits" ADD CONSTRAINT "security_deposits_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_deposits" ADD CONSTRAINT "security_deposits_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_events" ADD CONSTRAINT "vendor_events_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_events" ADD CONSTRAINT "vendor_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_events" ADD CONSTRAINT "vendor_events_linked_work_order_id_work_orders_id_fk" FOREIGN KEY ("linked_work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_events" ADD CONSTRAINT "vendor_events_linked_property_id_properties_id_fk" FOREIGN KEY ("linked_property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_licenses" ADD CONSTRAINT "vendor_licenses_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_licenses" ADD CONSTRAINT "vendor_licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_licenses" ADD CONSTRAINT "vendor_licenses_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_tasks" ADD CONSTRAINT "vendor_tasks_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_tasks" ADD CONSTRAINT "vendor_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_tasks" ADD CONSTRAINT "vendor_tasks_linked_work_order_id_work_orders_id_fk" FOREIGN KEY ("linked_work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_tasks" ADD CONSTRAINT "vendor_tasks_linked_request_id_maintenance_requests_id_fk" FOREIGN KEY ("linked_request_id") REFERENCES "public"."maintenance_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_maintenance_request_id_maintenance_requests_id_fk" FOREIGN KEY ("maintenance_request_id") REFERENCES "public"."maintenance_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_quote_id_maintenance_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."maintenance_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vendor_user_id_users_id_fk" FOREIGN KEY ("vendor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_technician_id_users_id_fk" FOREIGN KEY ("assigned_technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "buyer_property_unique_idx" ON "buyer_favorites" USING btree ("buyer_id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rate_date_idx" ON "exchange_rates" USING btree ("base_currency","target_currency","date");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_idempotency_key_unique" UNIQUE("idempotency_key");