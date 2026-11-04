ALTER TABLE "properties" ADD COLUMN "operating_model" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "managed_by_agent_id" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "listed_by_agent_id" text;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_managed_by_agent_id_organizations_id_fk" FOREIGN KEY ("managed_by_agent_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_listed_by_agent_id_organizations_id_fk" FOREIGN KEY ("listed_by_agent_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;