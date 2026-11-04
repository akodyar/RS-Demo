# Evidence Index — HomeHub Property Verification & Owner Management Choice

| Category | File Path | Description |
|---|---|---|
| **Documentation** | `README.md` | Executive summary, architectural highlights, and verification guarantees |
| **Documentation** | `00-EVIDENCE-INDEX.md` | This document inventory |
| **Documentation** | `ROLLOUT_AND_SAFETY_REVIEW.md` | Safety checklist, failure modes, and rollback criteria |
| **Git Metadata** | `git/GIT_HEAD.txt` | Exact Git revision hash |
| **Git Metadata** | `git/GIT_STATUS.txt` | Repository status during audit |
| **Git Metadata** | `git/GIT_DIFF_STAT.txt` | Changed file summary and insertion/deletion counts |
| **Git Metadata** | `git/PROPERTY_VERIFICATION_DIFF.patch` | Unified patch of domain modifications |
| **Test Logs** | `logs/01-property-verification-and-owner-management-choice.log` | 13/13 passing tests for verification and management choice |
| **Test Logs** | `logs/02-property-creation-validation.log` | 10/10 passing tests for creation input validation |
| **Test Logs** | `logs/03-property-creation-idempotency.log` | 13/13 passing tests for request idempotency |
| **Test Logs** | `logs/04-npm-build.log` | Production build log (Vite + esbuild) |
| **Database Catalog** | `catalog/domain-table-columns.json` | Information schema dump of all domain tables |
| **Database Catalog** | `catalog/properties-catalog.json` | Full column schema for `properties` table |
| **Database Catalog** | `catalog/verification_records-catalog.json` | Full column schema for `verification_records` table |
| **Database Catalog** | `catalog/domain-indexes.json` | Database indexes on properties and verification records |
| **Database Evidence** | `database-evidence/01-properties-live-state.json` | Live rows showing verification_status and management_preference |
| **Database Evidence** | `database-evidence/02-verification-records-live-state.json` | Live verification decision history records |
| **Database Evidence** | `database-evidence/03-listings-live-state.json` | Live listings demonstrating staged PENDING_REVIEW and PUBLISHED states |
| **Database Evidence** | `database-evidence/04-management-agreements-live-state.json` | Live agreements demonstrating contract protection |
| **Source Excerpts** | `source-excerpts/0027_property_verification_and_management_choice.sql` | PostgreSQL schema migration script |
| **Source Excerpts** | `source-excerpts/properties-repository.ts` | Domain logic for verification, re-review, and management choices |
| **Source Excerpts** | `source-excerpts/admin-routes.ts` | Administrative approve, reject, and history endpoints |
| **Source Excerpts** | `source-excerpts/properties-routes.ts` | Management preference, resubmit, and material update routes |
| **Source Excerpts** | `source-excerpts/marketplace-routes.ts` | Fail-closed marketplace verification filters |
| **Source Excerpts** | `source-excerpts/AddPropertyPage.tsx` | Owner post-creation management choice UI |
| **Source Excerpts** | `source-excerpts/OwnerWorkspace.tsx` | Property cards with verification badges and rejection banners |
| **Source Excerpts** | `source-excerpts/AdminPropertiesModule.tsx` | Admin inspection and decision modal |
| **Source Excerpts** | `source-excerpts/property-verification-and-owner-management-choice.test.ts` | Full regression test suite |
| **Source Excerpts** | `source-excerpts/Kaywan_Latest_Instructions.txt` | Updated project instructions and decisions log |
| **Manifests** | `manifests/FILE_MANIFEST.json` | Cryptographic SHA-256 manifest of all package files |
| **Manifests** | `manifests/TEST_SUITE_MANIFEST.json` | Test execution inventory and results |
| **Manifests** | `manifests/SCHEMA_MIGRATIONS_MANIFEST.json` | Detailed migration specification and schema updates |
