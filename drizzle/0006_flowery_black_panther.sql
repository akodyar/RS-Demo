CREATE TABLE "agent_compensation_agreements" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text,
	"user_id" text NOT NULL,
	"company_id" text,
	"agreement_type" text DEFAULT 'STANDARD_SPLIT' NOT NULL,
	"brokerage_split_rate" numeric NOT NULL,
	"agent_split_rate" numeric NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"effective_date" timestamp DEFAULT now() NOT NULL,
	"expiry_date" timestamp,
	"approved_by" text,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agent_compensation_agreements" ADD CONSTRAINT "agent_compensation_agreements_agent_id_agent_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_compensation_agreements" ADD CONSTRAINT "agent_compensation_agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_compensation_agreements" ADD CONSTRAINT "agent_compensation_agreements_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_compensation_agreements" ADD CONSTRAINT "agent_compensation_agreements_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;