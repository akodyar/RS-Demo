CREATE TABLE "accounts_payable" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text,
	"company_id" text,
	"creditor_organization_id" text,
	"creditor_user_id" text,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"settled_amount" numeric DEFAULT '0',
	"journal_entry_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts_receivable" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text,
	"company_id" text,
	"debtor_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"settled_amount" numeric DEFAULT '0',
	"journal_entry_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text,
	"company_id" text,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"ledger_account_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_reconciliations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_statement_id" text NOT NULL,
	"bank_transaction_id" text,
	"journal_entry_id" text NOT NULL,
	"matched_amount" numeric NOT NULL,
	"matched_by" text NOT NULL,
	"status" text DEFAULT 'MATCHED' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_statements" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" text NOT NULL,
	"statement_date" text NOT NULL,
	"opening_balance" numeric NOT NULL,
	"closing_balance" numeric NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'UNRECONCILED' NOT NULL,
	"file_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refund_records" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_payment_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"compensating_journal_id" text NOT NULL,
	"processed_by" text NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "refund_records_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "reversal_records" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_journal_id" text NOT NULL,
	"reversal_journal_id" text NOT NULL,
	"reason" text NOT NULL,
	"processed_by" text NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "reversal_records_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_creditor_organization_id_organizations_id_fk" FOREIGN KEY ("creditor_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_creditor_user_id_users_id_fk" FOREIGN KEY ("creditor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_debtor_id_users_id_fk" FOREIGN KEY ("debtor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_statement_id_bank_statements_id_fk" FOREIGN KEY ("bank_statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_matched_by_users_id_fk" FOREIGN KEY ("matched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_original_payment_id_payment_records_id_fk" FOREIGN KEY ("original_payment_id") REFERENCES "public"."payment_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_compensating_journal_id_journal_entries_id_fk" FOREIGN KEY ("compensating_journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reversal_records" ADD CONSTRAINT "reversal_records_original_journal_id_journal_entries_id_fk" FOREIGN KEY ("original_journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reversal_records" ADD CONSTRAINT "reversal_records_reversal_journal_id_journal_entries_id_fk" FOREIGN KEY ("reversal_journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reversal_records" ADD CONSTRAINT "reversal_records_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;