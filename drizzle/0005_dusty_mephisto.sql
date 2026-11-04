CREATE TABLE "ai_actions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"owner_id" text,
	"property_id" text,
	"action_type" text NOT NULL,
	"action_class" text NOT NULL,
	"risk_level" text NOT NULL,
	"source_type" text NOT NULL,
	"source_reference" text,
	"recommendation" text NOT NULL,
	"rationale" text NOT NULL,
	"proposed_payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"policy_version" text DEFAULT '1.0' NOT NULL,
	"required_approval" boolean DEFAULT false NOT NULL,
	"approval_status" text DEFAULT 'NOT_REQUIRED' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"execution_status" text DEFAULT 'PENDING' NOT NULL,
	"executed_at" timestamp,
	"execution_reference" text,
	"result" jsonb,
	"failure_reason" text,
	"expires_at" timestamp,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_actions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "ai_policies" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"owner_id" text,
	"property_id" text,
	"max_auto_task_cost" numeric DEFAULT '0',
	"auto_actions_enabled" boolean DEFAULT false,
	"allowed_auto_action_types" jsonb DEFAULT '[]'::jsonb,
	"approval_required_categories" jsonb DEFAULT '[]'::jsonb,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"policy_version" text DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "communication_consents" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"consent_type" text NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'GRANTED' NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_cases" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"organization_id" text,
	"property_id" text,
	"severity" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"decision" text DEFAULT 'PENDING' NOT NULL,
	"assigned_reviewer_id" text,
	"remediation_action" text,
	"deadline" timestamp,
	"notes" text,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_rules" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"applicability" jsonb NOT NULL,
	"required_evidence_types" jsonb DEFAULT '[]'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"effective_date" text,
	"expiration_date" text,
	"remediation" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_rules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" text,
	"organization_id" text,
	"property_id" text,
	"activity_type" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"visibility" text DEFAULT 'TEAM_PUBLIC' NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"owner_user_id" text NOT NULL,
	"contact_user_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"relationship" text DEFAULT 'PROSPECT' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_follow_ups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" text,
	"property_id" text,
	"assigned_user_id" text NOT NULL,
	"title" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reminder_channel" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"property_id" text,
	"contact_id" text,
	"title" text NOT NULL,
	"description" text,
	"assigned_user_id" text NOT NULL,
	"creator_user_id" text NOT NULL,
	"due_date" text NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_registrations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_token" text NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_appeals" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" text NOT NULL,
	"appellant_user_id" text NOT NULL,
	"original_resolution_outcome" text NOT NULL,
	"appeal_reason" text NOT NULL,
	"status" text DEFAULT 'FILED' NOT NULL,
	"assigned_appeals_officer_id" text,
	"appeal_decision_notes" text,
	"filed_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dispute_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" text NOT NULL,
	"actor_user_id" text,
	"actor_role" text NOT NULL,
	"event_type" text NOT NULL,
	"visibility" text DEFAULT 'PUBLIC_TO_PARTIES' NOT NULL,
	"from_status" text,
	"to_status" text,
	"details" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_evidence" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" text NOT NULL,
	"submitted_by" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"document_ref" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"visibility" text DEFAULT 'PUBLIC_TO_PARTIES' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"review_notes" text
);
--> statement-breakpoint
CREATE TABLE "dispute_parties" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"organization_id" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_number" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolution_outcome" text DEFAULT 'PENDING' NOT NULL,
	"initiator_user_id" text NOT NULL,
	"respondent_user_id" text,
	"organization_id" text,
	"property_id" text,
	"related_entity_id" text,
	"assigned_reviewer_id" text,
	"external_legal_review_required" boolean DEFAULT false NOT NULL,
	"resolution_notes" text,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_dispute_number_unique" UNIQUE("dispute_number")
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" text NOT NULL,
	"channel" text NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"recipient_address" text NOT NULL,
	"failure_reason" text,
	"idempotency_key" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"channel_preferences" jsonb DEFAULT '{"IN_APP":true,"EMAIL":true,"SMS":true,"PUSH":true}'::jsonb NOT NULL,
	"category_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" text DEFAULT '22:00',
	"quiet_hours_end" text DEFAULT '07:00',
	"preferred_language" text DEFAULT 'ku' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_template_versions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"version" text NOT NULL,
	"language" text NOT NULL,
	"title_template" text NOT NULL,
	"body_template" text NOT NULL,
	"allowed_variables" jsonb NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"supported_channels" jsonb NOT NULL,
	"active_version" text DEFAULT '1.0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notification_webhook_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_webhook_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"score" numeric NOT NULL,
	"level" text NOT NULL,
	"factors" jsonb NOT NULL,
	"contributing_signal_ids" jsonb DEFAULT '[]'::jsonb,
	"rule_version" text DEFAULT '1.0' NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"status" text DEFAULT 'CURRENT' NOT NULL,
	"reviewed_by" text,
	"review_notes" text,
	"organization_id" text,
	"property_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_signals" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"signal_type" text NOT NULL,
	"risk_level" text NOT NULL,
	"numeric_score" numeric NOT NULL,
	"description" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"evidence_ref" text,
	"organization_id" text,
	"property_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"from_state" text,
	"to_state" text,
	"reason" text,
	"evidence_ref" text,
	"correlation_id" text,
	"organization_id" text,
	"property_id" text,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_evidence" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_record_id" text NOT NULL,
	"evidence_type" text NOT NULL,
	"title" text NOT NULL,
	"document_ref" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"submitted_by" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_records" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"verification_type" text NOT NULL,
	"status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"organization_id" text,
	"property_id" text,
	"owner_id" text,
	"submitted_by" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"rejection_reason" text,
	"expires_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "currency" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "sensitivity" text DEFAULT 'NORMAL';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "status" text DEFAULT 'QUEUED';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "source_domain" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "template_version" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "read_at" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dismissed_at" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_policies" ADD CONSTRAINT "ai_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_policies" ADD CONSTRAINT "ai_policies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_policies" ADD CONSTRAINT "ai_policies_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_cases" ADD CONSTRAINT "compliance_cases_rule_id_compliance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_cases" ADD CONSTRAINT "compliance_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_cases" ADD CONSTRAINT "compliance_cases_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_cases" ADD CONSTRAINT "compliance_cases_assigned_reviewer_id_users_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_cases" ADD CONSTRAINT "compliance_cases_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_contact_user_id_users_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_appeals" ADD CONSTRAINT "dispute_appeals_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_appeals" ADD CONSTRAINT "dispute_appeals_appellant_user_id_users_id_fk" FOREIGN KEY ("appellant_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_appeals" ADD CONSTRAINT "dispute_appeals_assigned_appeals_officer_id_users_id_fk" FOREIGN KEY ("assigned_appeals_officer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_parties" ADD CONSTRAINT "dispute_parties_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_parties" ADD CONSTRAINT "dispute_parties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_parties" ADD CONSTRAINT "dispute_parties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_initiator_user_id_users_id_fk" FOREIGN KEY ("initiator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_respondent_user_id_users_id_fk" FOREIGN KEY ("respondent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_reviewer_id_users_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_evidence" ADD CONSTRAINT "verification_evidence_verification_record_id_verification_records_id_fk" FOREIGN KEY ("verification_record_id") REFERENCES "public"."verification_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_evidence" ADD CONSTRAINT "verification_evidence_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_evidence" ADD CONSTRAINT "verification_evidence_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_actions_prop_idx" ON "ai_actions" USING btree ("property_id","execution_status");--> statement-breakpoint
CREATE INDEX "ai_actions_org_idx" ON "ai_actions" USING btree ("organization_id","execution_status");--> statement-breakpoint
CREATE INDEX "ai_actions_owner_idx" ON "ai_actions" USING btree ("owner_id","execution_status");--> statement-breakpoint
CREATE INDEX "ai_actions_created_idx" ON "ai_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_policies_org_idx" ON "ai_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_policies_owner_idx" ON "ai_policies" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "ai_policies_prop_idx" ON "ai_policies" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "comm_consents_user_idx" ON "communication_consents" USING btree ("user_id","consent_type","channel");--> statement-breakpoint
CREATE INDEX "comp_cases_subject_idx" ON "compliance_cases" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "comp_cases_status_idx" ON "compliance_cases" USING btree ("status","severity");--> statement-breakpoint
CREATE INDEX "comp_cases_org_idx" ON "compliance_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_activities_contact_idx" ON "crm_activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_activities_org_idx" ON "crm_activities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_activities_prop_idx" ON "crm_activities" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "crm_activities_actor_idx" ON "crm_activities" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_owner_idx" ON "crm_contacts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_org_idx" ON "crm_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_user_idx" ON "crm_contacts" USING btree ("contact_user_id");--> statement-breakpoint
CREATE INDEX "crm_follow_ups_assigned_idx" ON "crm_follow_ups" USING btree ("assigned_user_id","status");--> statement-breakpoint
CREATE INDEX "crm_tasks_assigned_idx" ON "crm_tasks" USING btree ("assigned_user_id","status");--> statement-breakpoint
CREATE INDEX "crm_tasks_org_idx" ON "crm_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_tasks_prop_idx" ON "crm_tasks" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_user_token_idx" ON "device_registrations" USING btree ("user_id","device_token");--> statement-breakpoint
CREATE INDEX "device_token_idx" ON "device_registrations" USING btree ("device_token");--> statement-breakpoint
CREATE INDEX "dispute_appeals_dispute_idx" ON "dispute_appeals" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_events_dispute_time_idx" ON "dispute_events" USING btree ("dispute_id","timestamp");--> statement-breakpoint
CREATE INDEX "dispute_evidence_dispute_vis_idx" ON "dispute_evidence" USING btree ("dispute_id","visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_party_user_idx" ON "dispute_parties" USING btree ("dispute_id","user_id");--> statement-breakpoint
CREATE INDEX "dispute_party_user_lookup_idx" ON "dispute_parties" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_initiator_idx" ON "disputes" USING btree ("initiator_user_id");--> statement-breakpoint
CREATE INDEX "disputes_respondent_idx" ON "disputes" USING btree ("respondent_user_id");--> statement-breakpoint
CREATE INDEX "disputes_org_idx" ON "disputes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "disputes_prop_idx" ON "disputes" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "notif_deliv_notif_idx" ON "notification_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notif_deliv_status_idx" ON "notification_deliveries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_deliv_idemp_idx" ON "notification_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "template_version_lang_idx" ON "notification_template_versions" USING btree ("template_id","version","language");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_webhook_provider_event_idx" ON "notification_webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "notif_webhook_idemp_idx" ON "notification_webhook_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "risk_assess_target_status_idx" ON "risk_assessments" USING btree ("target_type","target_id","status");--> statement-breakpoint
CREATE INDEX "risk_assess_org_idx" ON "risk_assessments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "risk_assess_prop_idx" ON "risk_assessments" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "risk_signals_target_idx" ON "risk_signals" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "risk_signals_status_level_idx" ON "risk_signals" USING btree ("status","risk_level");--> statement-breakpoint
CREATE INDEX "trust_events_entity_idx" ON "trust_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "trust_events_type_idx" ON "trust_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "trust_events_time_idx" ON "trust_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "ver_evid_record_idx" ON "verification_evidence" USING btree ("verification_record_id");--> statement-breakpoint
CREATE INDEX "ver_evid_status_idx" ON "verification_evidence" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ver_rec_subject_idx" ON "verification_records" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "ver_rec_status_idx" ON "verification_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ver_rec_org_idx" ON "verification_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ver_rec_prop_idx" ON "verification_records" USING btree ("property_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_idempotency_key_unique" UNIQUE("idempotency_key");