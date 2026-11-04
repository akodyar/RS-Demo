CREATE TABLE "owner_settlements" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"property_id" text,
	"company_id" text,
	"period_start_date" timestamp NOT NULL,
	"period_end_date" timestamp NOT NULL,
	"total_collected_iqd" numeric NOT NULL,
	"platform_commission_iqd" numeric NOT NULL,
	"company_commission_iqd" numeric NOT NULL,
	"total_expenses_iqd" numeric NOT NULL,
	"net_payable_iqd" numeric NOT NULL,
	"status" text DEFAULT 'AVAILABLE' NOT NULL,
	"journal_entry_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"amount_iqd" numeric NOT NULL,
	"bank_account_number" text,
	"bank_name" text,
	"iban" text,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"approved_by_user_id" text,
	"external_transaction_reference" text,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_records" ADD COLUMN "collector_id" text;--> statement-breakpoint
ALTER TABLE "owner_settlements" ADD CONSTRAINT "owner_settlements_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_settlements" ADD CONSTRAINT "owner_settlements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_settlements" ADD CONSTRAINT "owner_settlements_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_settlements" ADD CONSTRAINT "owner_settlements_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_settlement_id_owner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."owner_settlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "owner_settlements_owner_idx" ON "owner_settlements" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "owner_settlements_status_idx" ON "owner_settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payout_requests_owner_idx" ON "payout_requests" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "payout_requests_status_idx" ON "payout_requests" USING btree ("status");--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_collector_id_users_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;