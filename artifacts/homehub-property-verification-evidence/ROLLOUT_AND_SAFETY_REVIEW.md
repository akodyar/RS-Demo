# Rollout and Safety Review — Property Verification & Owner Management Choice

## Pre-Deployment Verification Checklist
- [x] Schema migration applied cleanly to PostgreSQL `homehub_test` (297ms).
- [x] Zero access, connection, or migration runs against `homehub_production`.
- [x] Server-side default `PENDING_VERIFICATION` verified in database and API responses.
- [x] Marketplace queries fail closed against unverified and rejected properties.
- [x] Admin approval/rejection endpoints require administrative authorization and enforce mutation guards.
- [x] Meaningful rejection reason strictly required for rejection.
- [x] Material updates trigger safe re-review and unpublish active listings.
- [x] Owner management preference persists 3 canonical choices (`SELF_MANAGED`, `HOMEHUB_MANAGED`, `AGENT_MANAGED`).
- [x] Eligible agent verification checks performed server-side.
- [x] Active management agreement blocks unilateral switch to `SELF_MANAGED` with HTTP 409 Conflict.
- [x] Kurdish Sorani RTL, Arabic RTL, and English LTR layouts preserved.
- [x] Payment-reversal vs lease-renewal defect untouched.
- [x] 38 out of 38 regression tests pass with exit code 0.
- [x] Production build (`npm run build`) succeeds with exit code 0.

## Rollback Plan
If an unexpected defect occurs in staging:
1. Revert application bundle to previous release commit.
2. The schema columns added in `0027_property_verification_and_management_choice.sql` (`verification_status`, `rejection_reason`, `verified_at`, `verified_by`, `management_preference`, `management_arrangement_status`) all have safe defaults or are nullable. Legacy code paths ignoring these columns remain functional without database table rollback.
3. No data loss will occur.
