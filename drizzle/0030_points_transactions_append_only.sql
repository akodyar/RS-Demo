-- HomeHub Phase 2 follow-up: enforce append-only points ledger at PostgreSQL level.
-- Intentionally rejects even no-op UPDATE statements and all DELETE statements.
-- Corrections must be recorded as compensating ledger transactions, never by rewriting history.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reject_points_transactions_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'POINTS_TRANSACTIONS_APPEND_ONLY: points_transactions rows cannot be updated or deleted; append a compensating transaction instead.'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS points_transactions_append_only ON public.points_transactions;
--> statement-breakpoint
CREATE TRIGGER points_transactions_append_only
BEFORE UPDATE OR DELETE ON public.points_transactions
FOR EACH ROW
EXECUTE FUNCTION public.reject_points_transactions_mutation();
