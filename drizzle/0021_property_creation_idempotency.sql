CREATE TABLE IF NOT EXISTS "idempotency_records" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"scope" text NOT NULL,
	"user_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"resource_id" text,
	"response_status" integer DEFAULT 201 NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_user_scope_key_unique" ON "idempotency_records" ("user_id", "scope", "key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_records_expires_at_idx" ON "idempotency_records" ("expires_at");
