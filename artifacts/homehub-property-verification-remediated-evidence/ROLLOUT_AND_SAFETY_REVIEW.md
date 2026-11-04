# Rollout and Safety Review — Property Verification & Owner Management Choice Remediated (v2)

## Pre-Deployment Verification Checklist
- [x] Schema migrations 0027 and 0028 applied cleanly to PostgreSQL `homehub_test`.
- [x] Zero access, connection, or migration runs against `homehub_production`.
- [x] Database reconciliation verified: 1,294 pre-migration rows (Branch 1: 620, Branch 2: 48, Branch 3: 626), 0 NULL management preferences.
- [x] Operating model preserved: `setManagementPreference` does not erase or rewrite `operatingModel`.
- [x] Fee applicability preserved: Model B (`AGENT_LISTED_PLATFORM_MANAGED`) rent fee remains null.
- [x] Database constraints enforce `is_nullable: NO` and `column_default: "'SELF_MANAGED'::text"` with CHECK constraint.
- [x] Canonical agent eligibility unified across route query and server-side mutation revalidation.
- [x] Marketplace queries fail closed against unverified and rejected properties.
- [x] Admin approval/rejection endpoints require administrative authorization and enforce mutation guards.
- [x] Meaningful rejection reason strictly required for rejection.
- [x] Material updates trigger safe re-review and unpublish active listings.
- [x] Owner management preference persists 3 canonical choices (`SELF_MANAGED`, `HOMEHUB_MANAGED`, `AGENT_MANAGED`).
- [x] Active management agreement blocks unilateral switch to `SELF_MANAGED` with HTTP 409 Conflict.
- [x] Kurdish Sorani RTL, Arabic RTL, and English LTR layouts preserved.
- [x] Payment-reversal vs lease-renewal defect untouched.
- [x] 39 out of 39 regression tests pass with exit code 0 across 3 test suites.
- [x] Production build (`npm run build`) succeeds with exit code 0.

## Rollback Plan
If an unexpected defect occurs in staging:
1. Revert application bundle to previous release commit.
2. The schema columns added in migrations 0027 and 0028 have defaults or safe nullability. If necessary, migration 0028 column constraint can be relaxed via:
   `ALTER TABLE properties ALTER COLUMN management_preference DROP NOT NULL;`
3. No data loss will occur.
