# Discrepancy Resolution Log — Property Verification & Owner Management Choice
Date: 2026-10-21
Lead Full-Stack & Systems Engineering Agent

This document records the exact findings from the review, their forensic investigation against the real codebase and PostgreSQL test database, and the deterministic remediation applied.

---

### Finding 1: Reconcile Migration and Database Counts
- **Review Finding**: The report claimed 1,283 NULL management preferences were backfilled, but the backfill counts and final distribution in the report and evidence package did not consistently reconcile.
- **Forensic Investigation**:
  * Executed live read-only queries against PostgreSQL test database (`homehub_test`).
  * Total properties in `properties` table: **1,365**.
  * Current `management_preference IS NULL` count: **0** (strictly enforced by NOT NULL constraint).
  * Historical Timestamp Audit: Migration 0028 executed at `2026-10-21T13:34:36.000Z`.
  * Pre-Migration Row Count (`created_at <= '2026-10-21T13:34:36.000Z'`): **1,294 rows**.
  * Migration 0028 Backfill Branches at Migration Timestamp:
    1. Branch 1 (`operating_model IN ('FULLY_MANAGED', 'AGENT_LISTED_PLATFORM_MANAGED')`): **620 rows** (587 FULLY_MANAGED + 33 ALPM) -> `HOMEHUB_MANAGED` and `AWAITING_ONBOARDING`.
    2. Branch 2 (`operating_model = 'AGENT_OPERATED'`): **48 rows** -> `AGENT_MANAGED` and `AWAITING_AGREEMENT`.
    3. Branch 3 (Unmanaged / Legacy Operating Models: 584 NULL + 21 SELF_MANAGED + 21 DIRECT_RENTAL): **626 rows** -> `SELF_MANAGED` and `NOT_APPLICABLE`.
  * Forensic Identification of the "1,283" Figure:
    - Inspection of prior task logs proves that `1,283` originated in an early post-backfill query log (`task-1472.log`).
    - In `task-1472.log`, the query grouped properties by `operating_model`, `management_preference`, and `management_arrangement_status`, producing 6 row counts: `null` (613), `FULLY_MANAGED` (595), `AGENT_LISTED_PLATFORM_MANAGED` (33), `SELF_MANAGED` (21), `DIRECT_RENTAL` (21), and `AGENT_OPERATED` (48).
    - Summing the 5 non-agent rows yields exactly: $613 + 595 + 33 + 21 + 21 = \mathbf{1,283}$.
    - That early calculation accidentally omitted the 48 `AGENT_OPERATED` properties ($1,283 + 48 = 1,331$).
    - A subsequent report attempted to explain `1,283` by asserting it was the sum of Branch 1 (620) and Branch 3 (626), which was mathematically defective ($620 + 626 = 1,246$).
    - The true verified migration backfill counts across all pre-existing properties at migration timestamp `2026-10-21T13:34:36.000Z` are: Branch 1 (`620`) + Branch 2 (`48`) + Branch 3 (`626`) = `1,294 rows` (100% verified by live PostgreSQL timestamp query).
  * Root Cause of "1,349" vs "1,365" (the "16 rows"): An intermediate database snapshot captured 1,349 rows during testing (1,294 pre-existing + 55 test-created rows = 1,349). A subsequent run created further test rows, reaching 1,365 rows. A prior reviewer compared 1,365 with 1,349, inferring that 16 rows were added. Forensic timestamp verification (`created_at > '2026-10-21T13:34:36.000Z'`) proves that subsequent rows were created by automated test suite executions. Zero NULLs remain.
    - 44 rows created by `tests/property-creation-validation.test.ts`
    - 15 rows created by `tests/property-verification-and-owner-management-choice.test.ts`
    - 12 rows created by earlier test iterations/scratch runs
    * Total rows: 1,294 pre-migration + 71 test-created = **1,365 rows**.
  * Current Distribution by `management_preference` across all 1,365 rows:
    - `SELF_MANAGED`: 677 rows (49.6%)
    - `HOMEHUB_MANAGED`: 634 rows (46.4%)
    - `AGENT_MANAGED`: 54 rows (4.0%)
    * Total: 677 + 634 + 54 = **1,365 rows**. Exactly 0 NULLs.
  * Branch 3 Domain Correctness Justification: Under `Kaywan_Latest_Instructions.txt` and HomeHub core business rules, company management requires an executed, active `management_agreement`. Properties without management agreements are self-managed by the owner. Legacy properties with NULL operating models or `DIRECT_RENTAL` have no platform management agreement; therefore, mapping them to `management_preference = 'SELF_MANAGED'` and `management_arrangement_status = 'NOT_APPLICABLE'` is the only domain-correct invariant.
  * Database Constraints: Catalog audit confirms `properties.management_preference` has `is_nullable: NO`, `column_default: "'SELF_MANAGED'::text"`, and `properties_management_preference_check` constraint `CHECK (management_preference IN ('SELF_MANAGED', 'HOMEHUB_MANAGED', 'AGENT_MANAGED'))`.

---

### Finding 2: Preserve Separation of Management Preference and Operating Model
- **Review Finding**: Selecting `SELF_MANAGED` set `operatingModel` to null, while selecting `HOMEHUB_MANAGED` set it to `FULLY_MANAGED`. Management preference, operating model, arrangement status, and contractual authorization must remain distinct concepts unless the domain model explicitly defines a mapping. Changing management preference must not silently erase or rewrite an operating model.
- **Forensic Investigation**:
  * Inspected `setManagementPreference` in `src/server/repositories/properties.ts`:
    - Line 1043 previously had `operatingModel: null` on `SELF_MANAGED`.
    - Line 1063 previously had `operatingModel: 'FULLY_MANAGED'` on `HOMEHUB_MANAGED`.
    - Line 1098 previously had `operatingModel: 'AGENT_OPERATED'` on `AGENT_MANAGED`.
  * Inspected `createProperty` in `src/server/repositories/properties.ts`:
    - Lines 424-433 previously inferred `managementPreference` from `operatingModel` when not explicitly passed.
  * Architectural Hazard: `operatingModel` defines fee applicability under the 3-fee model. Model B (`AGENT_LISTED_PLATFORM_MANAGED`) strictly charges Platform Fee + Management Fee, with Rent Fee set to null. If an owner sets preference to `HOMEHUB_MANAGED`, overwriting `operatingModel` to `FULLY_MANAGED` would unlawfully alter the property's fee structure to charge rent fees. Similarly, clearing `operatingModel` to null on `SELF_MANAGED` destroyed the property's operational classification.
- **Remediation**:
  1. Removed all `operatingModel` mutations from `setManagementPreference` in `src/server/repositories/properties.ts`. The existing `operatingModel` is preserved untouched across all preference updates.
  2. Removed undocumented preference inference from `createProperty`. Newly created properties default to `managementPreference = 'SELF_MANAGED'` and `managementArrangementStatus = 'NOT_APPLICABLE'` unless explicitly specified by the owner.
  3. Expanded regression test suite (`tests/property-verification-and-owner-management-choice.test.ts` Test 9d):
     - Created a property with `operatingModel = 'AGENT_LISTED_PLATFORM_MANAGED'` and `managementFee = 0.04`.
     - Updated preference to `HOMEHUB_MANAGED`: verified `operatingModel` remains `AGENT_LISTED_PLATFORM_MANAGED` (NOT overwritten to `FULLY_MANAGED`).
     - Updated preference to `AGENT_MANAGED`: verified `operatingModel` remains `AGENT_LISTED_PLATFORM_MANAGED` (NOT overwritten to `AGENT_OPERATED`).
     - Updated preference to `SELF_MANAGED`: verified `operatingModel` remains `AGENT_LISTED_PLATFORM_MANAGED` (NOT nulled out).
     - Verified fee breakdown through `GET /api/properties/:id/financial-summary`: `rentFeeRate` remains strictly null, and `managementFeeRate` is preserved.

---

### Finding 3: Verify the Actual Git Change Set & Diffstat Audit
- **Review Finding**: The archived `GIT_DIFF_STAT.txt` listed only four files, while the report claimed changes to migrations, tests, and project instructions. The working-tree status includes staged, unstaged, and untracked changes.
- **Forensic Investigation**:
  * `git diff --stat` by default only reports modified tracked files that have unstaged modifications.
  * Because `drizzle/0028_property_management_preference_alignment.sql` and the regression tests were newly created untracked files, they were omitted from the standard `git diff --stat` output.
  * In addition, the repository has 107 pre-existing staged files and 135 pre-existing unstaged files from earlier completed domains (pricing, fees, onboarding, lease management, etc.).
- **Remediation**:
  1. Inspected staged, unstaged, and untracked files separately.
  2. Produced `git/GIT_STAGED_AUDIT.txt` documenting all 107 pre-existing staged files and their preservation invariant.
  3. Produced `git/GIT_UNSTAGED_AUDIT.txt` documenting all 135 pre-existing unstaged files.
  4. Produced `git/GIT_UNTRACKED_AUDIT.txt` documenting untracked files.
  5. Created `git/SCOPED_DOMAIN_INVENTORY.json` establishing the complete scoped change inventory:
     - 5 Tracked modified files: `Kaywan_Latest_Instructions.txt`, `drizzle/meta/_journal.json`, `src/db/schema.ts`, `src/server/repositories/properties.ts`, `src/server/routes/properties.ts`.
     - 4 New domain deliverables: `drizzle/0028_property_management_preference_alignment.sql`, `tests/property-verification-and-owner-management-choice.test.ts`, `tests/property-creation-validation.test.ts`, `tests/property-creation-idempotency.test.ts`.
     - 2 Auditing and packaging scripts: `scripts/package-property-verification-remediated-evidence.ts`, `scripts/reconcile-properties-db.ts`.
  6. Generated comprehensive `git/GIT_DIFF_STAT.txt` and `git/PROPERTY_VERIFICATION_DIFF.patch` combining tracked modifications and unified diffs of new domain deliverables.
  7. Confirmed 0 unrelated files were reverted, reset, or overwritten.
