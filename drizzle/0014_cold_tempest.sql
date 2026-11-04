CREATE TABLE "utility_bills" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL,
	"unit_id" text,
	"tenant_id" text,
	"lease_id" text,
	"type" text NOT NULL,
	"description" text,
	"amount" numeric NOT NULL,
	"outstanding_amount" numeric NOT NULL,
	"status" text DEFAULT 'UNPAID',
	"billing_date" text NOT NULL,
	"due_date" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "utility_payments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'USD',
	"payment_method" text,
	"status" text DEFAULT 'PENDING',
	"collector_id" text,
	"payer_id" text NOT NULL,
	"reference_number" text,
	"idempotency_key" text,
	"recorded_date" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "utility_payments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "utility_bills" ADD CONSTRAINT "utility_bills_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_bills" ADD CONSTRAINT "utility_bills_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_bills" ADD CONSTRAINT "utility_bills_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_bills" ADD CONSTRAINT "utility_bills_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_payments" ADD CONSTRAINT "utility_payments_bill_id_utility_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."utility_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_payments" ADD CONSTRAINT "utility_payments_collector_id_users_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_payments" ADD CONSTRAINT "utility_payments_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;