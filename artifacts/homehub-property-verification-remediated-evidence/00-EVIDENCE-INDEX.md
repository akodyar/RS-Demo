# Evidence Index — HomeHub Property Verification & Owner Management Choice Remediated Package (v2)

| Category | File Path | Description |
|---|---|---|
| **Documentation** | `README.md` | Executive summary, architectural highlights, and remediation overview |
| **Documentation** | `00-EVIDENCE-INDEX.md` | Package inventory and index |
| **Documentation** | `DISCREPANCY_RESOLUTION_LOG.md` | Forensic analysis and resolution of Findings 1, 2, and 3 |
| **Documentation** | `ROLLOUT_AND_SAFETY_REVIEW.md` | Safety checklist, failure modes, and rollback criteria |
| **Git Metadata** | `git/GIT_HEAD.txt` | Exact Git revision hash |
| **Git Metadata** | `git/GIT_STATUS.txt` | Repository status during audit |
| **Git Metadata** | `git/GIT_STAGED_AUDIT.txt` | Audit of 107 pre-existing staged files preserved untouched |
| **Git Metadata** | `git/GIT_UNSTAGED_AUDIT.txt` | Audit of 135 pre-existing unstaged files preserved untouched |
| **Git Metadata** | `git/GIT_UNTRACKED_AUDIT.txt` | Audit of untracked files |
| **Git Metadata** | `git/SCOPED_DOMAIN_INVENTORY.json` | Categorized file inventory for this domain |
| **Git Metadata** | `git/GIT_DIFF_STAT.txt` | Comprehensive diffstat covering tracked modifications and new deliverables |
| **Git Metadata** | `git/PROPERTY_VERIFICATION_DIFF.patch` | Unified patch of domain modifications |
| **Test Logs** | `logs/01-property-verification-and-owner-management-choice.log` | 14 passed tests for verification, management choice, and operating model preservation |
| **Test Logs** | `logs/02-property-creation-validation.log` | 11 passed tests for creation input validation and atomicity |
| **Test Logs** | `logs/03-property-creation-idempotency.log` | 14 passed tests for request idempotency and concurrency |
| **Test Logs** | `logs/04-npm-build.log` | Production build log (Vite + esbuild) |
| **Database Catalog** | `catalog/domain-table-columns.json` | Information schema dump of all domain tables |
| **Database Catalog** | `catalog/properties-catalog.json` | Full column schema for `properties` table (is_nullable: NO, default: SELF_MANAGED) |
| **Database Catalog** | `catalog/verification_records-catalog.json` | Full column schema for `verification_records` table |
| **Database Catalog** | `catalog/domain-indexes.json` | Database indexes on properties and verification records |
| **Database Evidence** | `database-evidence/01-properties-live-state.json` | Live rows showing verification_status and management_preference |
| **Database Evidence** | `database-evidence/02-verification-records-live-state.json` | Live verification decision history records |
| **Database Evidence** | `database-evidence/03-listings-live-state.json` | Live listings demonstrating staged PENDING_REVIEW and PUBLISHED states |
| **Database Evidence** | `database-evidence/04-management-agreements-live-state.json` | Live agreements demonstrating contract protection |
| **Database Evidence** | `database-evidence/05-management-preference-distribution.json` | Live cross-tabulation table across all properties and 0 NULLs |
| **Database Evidence** | `database-evidence/06-reconciliation-summary.json` | Exact PostgreSQL reconciliation proving 1,294 pre-migration rows, 620/48/626 branches, test rows, and 0 NULLs |
| **Database Evidence** | `database-evidence/07-test-rows-attribution.json` | Attribution of all post-migration test-created rows with sanitized IDs and timestamps |
| **Source Excerpts** | `source-excerpts/0027_property_verification_and_management_choice.sql` | PostgreSQL schema migration script 0027 |
| **Source Excerpts** | `source-excerpts/0028_property_management_preference_alignment.sql` | PostgreSQL schema migration script 0028 |
| **Source Excerpts** | `source-excerpts/_journal.json` | Drizzle migration journal |
| **Source Excerpts** | `source-excerpts/schema.ts` | Drizzle ORM schema with NOT NULL and default SELF_MANAGED |
| **Source Excerpts** | `source-excerpts/properties-repository.ts` | Domain logic for verification, re-review, and management choices |
| **Source Excerpts** | `source-excerpts/admin-routes.ts` | Administrative approve, reject, and history endpoints |
| **Source Excerpts** | `source-excerpts/properties-routes.ts` | Management preference, resubmit, and eligible-agents routes |
| **Source Excerpts** | `source-excerpts/marketplace-routes.ts` | Fail-closed marketplace verification filters |
| **Source Excerpts** | `source-excerpts/AddPropertyPage.tsx` | Owner post-creation management choice UI |
| **Source Excerpts** | `source-excerpts/OwnerWorkspace.tsx` | Property cards with verification badges and rejection banners |
| **Source Excerpts** | `source-excerpts/AdminPropertiesModule.tsx` | Admin inspection and decision modal |
| **Source Excerpts** | `source-excerpts/property-verification-and-owner-management-choice.test.ts` | Full regression test suite |
| **Source Excerpts** | `source-excerpts/property-creation-validation.test.ts` | Property creation validation test suite |
| **Source Excerpts** | `source-excerpts/property-creation-idempotency.test.ts` | Property creation idempotency test suite |
| **Source Excerpts** | `source-excerpts/reconcile-properties-db.ts` | Database auditing and reconciliation script |
| **Source Excerpts** | `source-excerpts/Kaywan_Latest_Instructions.txt` | Updated project instructions and decisions log |
| **Manifests** | `manifests/FILE_MANIFEST.json` | Cryptographic SHA-256 manifest of all package files |
| **Manifests** | `manifests/TEST_SUITE_MANIFEST.json` | Reconciled test execution inventory and results |
| **Manifests** | `manifests/SCHEMA_MIGRATIONS_MANIFEST.json` | Detailed migration specification and schema updates (0027 + 0028) |
