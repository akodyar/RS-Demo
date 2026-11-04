CREATE TABLE "pricing_tiers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"min_properties" integer NOT NULL,
	"max_properties" integer,
	"rent_fee_rate" numeric NOT NULL,
	"management_fee_rate" numeric NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
