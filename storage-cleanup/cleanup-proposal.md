# HomeHub Storage Cleanup Proposal (Phase Three)

**Generated At**: 2026-10-30T09:17:05.508Z
**Strategy**: Conservative, high-confidence deletion of verified duplicates, transient build caches, temporary extraction folders, and redundant superseded screenshots.

## 1. Summary of Proposed Storage Recovery

- **Current Repository Size**: 2.07 GB (2,217,697,174 bytes)
- **Current File Count**: 55,380 files
- **Proposed Space Recovery**: **119.06 MB** (124,843,495 bytes)
- **Proposed Files to Remove**: **938 files** across 26 directories and 23 individual files
- **Estimated Post-Cleanup Repository Size**: **1.95 GB** (~1.95 GB)
- **Estimated File Count Post-Cleanup**: **54,442 files**

## 2. High-Confidence Deletion Proposal Table

| Candidate Path | Size | Category | Evidence & Preservation Rationale | Proposed Action |
|---|---:|:---:|---|:---:|
| `scratch/HomeHub_Account_CrossDomain_Audit_2026-10-27` | 6.02 MB | **A** | Temporary extraction directory from zip package; original archive is preserved in archive/ directory (65 files) | **DELETE** |
| `scratch/HomeHub_Final_Verification_Closure_2026-10-27` | 6.02 MB | **A** | Temporary extraction directory from zip package; original archive is preserved in archive/ directory (65 files) | **DELETE** |
| `scratch/HomeHub_Audit_Evidence_Corrected_2026-10-27` | 2.64 MB | **A** | Temporary extraction directory from zip package; original archive is preserved in archive/ directory (43 files) | **DELETE** |
| `scratch/HomeHub_Audit_Evidence_2026-10-27` | 2.63 MB | **A** | Temporary extraction directory from zip package; original archive is preserved in archive/ directory (41 files) | **DELETE** |
| `scratch/HomeHub_F001_Final_Verification_2026-10-27` | 605.05 KB | **A** | Temporary extraction directory from zip package; original archive is preserved in archive/ directory (23 files) | **DELETE** |
| `test-results` | 180.42 KB | **A** | Transient test run outputs, traces, and HTML reports (3 files). Regenerable via npx playwright test. | **DELETE** |
| `playwright-report` | 692.86 KB | **A** | Transient test run outputs, traces, and HTML reports (3 files). Regenerable via npx playwright test. | **DELETE** |
| `dist` | 9.82 MB | **A** | Compiled client and server bundles (71 files). 100% regenerable in 19s via npm run build. | **DELETE** |
| `artifacts/homehub-admin-fees-and-property-verification-evidence.zip` | 17.03 MB | **C** | Exact byte-for-byte SHA-256 duplicate of archive/homehub-admin-fees-and-property-verification-evidence.zip | **DELETE** |
| `artifacts/homehub-multi-role-enrollment-evidence.zip` | 1.67 MB | **C** | Exact byte-for-byte SHA-256 duplicate of archive/homehub-multi-role-enrollment-evidence.zip | **DELETE** |
| `artifacts/multi-role-enrollment-final-audit.zip` | 1.67 MB | **C** | Triplicate copy of archive/homehub-multi-role-enrollment-evidence.zip | **DELETE** |
| `artifacts/homehub-property-verification-and-owner-management-choice-evidence.zip` | 308.76 KB | **C** | Exact byte-for-byte SHA-256 duplicate of archive/homehub-property-verification-and-owner-management-choice-evidence.zip | **DELETE** |
| `artifacts/homehub-property-verification-and-owner-management-choice-remediated-evidence.zip` | 326.4 KB | **C** | Exact byte-for-byte SHA-256 duplicate of archive/homehub-property-verification-and-owner-management-choice-remediated-evidence.zip | **DELETE** |
| `artifacts/homehub-cross-domain-audit-validated-2026-10-19.zip` | 4.71 MB | **C** | Duplicate package matching homehub-cross-domain-audit-final-2026-10-19.zip | **DELETE** |
| `archive/homehub-db-safety-phase-64-4` | 1.03 MB | **C** | Unpacked folder duplicating archive content; the packaged archive (archive/homehub-db-safety-phase-64-4.zip) is fully preserved | **DELETE** |
| `archive/homehub-db-safety-audit-package` | 1.02 MB | **C** | Unpacked folder duplicating archive content; the packaged archive (archive/homehub-db-safety-audit-package.zip) is fully preserved | **DELETE** |
| `archive/homehub-db-safety-phase-64-7` | 897.92 KB | **C** | Unpacked folder duplicating archive content; the packaged archive (archive/homehub-db-safety-phase-64-7.zip) is fully preserved | **DELETE** |
| `archive/homehub-db-safety-phase-64-6` | 867.16 KB | **C** | Unpacked folder duplicating archive content; the packaged archive (archive/homehub-db-safety-phase-64-6.zip) is fully preserved | **DELETE** |
| `archive/homehub-db-safety-phase-64-5` | 848.02 KB | **C** | Unpacked folder duplicating archive content; the packaged archive (archive/homehub-db-safety-phase-64-5.zip) is fully preserved | **DELETE** |
| `archive/homehub-lease-renewal-evidence` | 220.01 KB | **C** | Unpacked folder duplicating archive content; the packaged archive (archive/homehub-lease-renewal-evidence.zip) is fully preserved | **DELETE** |
| `archive/homehub-lease-renewal-corrected-evidence` | 126.52 KB | **C** | Unpacked folder duplicating archive content; the packaged archive (archive/homehub-lease-renewal-corrected-evidence.zip) is fully preserved | **DELETE** |
| `archive/flutter_homehub` | 213.88 KB | **C** | Unpacked folder duplicating archive content; the packaged archive (dist/flutter_homehub.zip) is fully preserved | **DELETE** |
| `screenshots/New folder` | 5.44 MB | **B** | Accidentally created Windows directory containing 36 duplicated screenshots from points-promotion audit | **DELETE** |
| `screenshots/homehub-whole-system-ui-audit/audit-run-2026-10-25` | 20.47 MB | **B** | Duplicate subfolder containing 28 exact SHA-256 duplicate PNGs identical to parent screenshots/homehub-whole-system-ui-audit/ folder | **DELETE** |
| `screenshots/homehub-midnight-gold-redesign` | 2.58 MB | **B** | Superseded exploratory design mockups (6 PNGs) from October 25; final design system documented in docs/ and live in codebase | **DELETE** |
| `screenshots/homehub-new-english-homepage-design` | 4.71 MB | **B** | Superseded exploratory homepage mockups (9 PNGs) from October 25; live homepage verified in option-3 audit | **DELETE** |
| `screenshots/homehub-property-discovery-sponsored-points-audit` | 6.71 MB | **B** | Superseded partial audit run (47 files); comprehensive complete audit run is fully preserved in screenshots/homehub-property-discovery-sponsored-points-comprehensive-audit/ | **DELETE** |
| `backups/homehub-backup-2026-10-30T04-51-42-488Z.json.gz` | 1.9 MB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T15-27-37-426Z.json.gz` | 18.9 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T15-13-13-473Z.json.gz` | 16.82 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T14-10-51-046Z.json.gz` | 12.62 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T14-11-36-596Z.json.gz` | 12.62 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T14-06-47-331Z.json.gz` | 10.87 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-24T16-33-38-689Z.json.gz` | 9.07 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T11-22-21-926Z.json.gz` | 4.37 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T10-54-19-542Z.json.gz` | 3.8 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T07-57-14-851Z.json.gz` | 3.24 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T07-51-35-369Z.json.gz` | 3.01 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T07-51-50-069Z.json.gz` | 3.01 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T07-52-51-324Z.json.gz` | 3.01 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T07-53-53-391Z.json.gz` | 3.01 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T07-54-18-455Z.json.gz` | 3.01 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T07-26-48-521Z.json.gz` | 2.18 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `backups/homehub-backup-2026-09-23T07-27-43-090Z.json.gz` | 2.18 KB | **C** | Rapid successive test database dump created seconds apart; primary consolidated backup is retained in backups/ | **DELETE** |
| `artifacts/homehub-cross-domain-audit-final-2026-10-19` | 4.86 MB | **C** | Unpacked directory duplicating archive contents; primary archive artifacts/homehub-cross-domain-audit-final-2026-10-19.zip is retained | **DELETE** |
| `artifacts/homehub-cross-domain-audit-validated-2026-10-19` | 4.84 MB | **C** | Unpacked directory duplicating archive contents; primary archive artifacts/homehub-cross-domain-audit-final-2026-10-19.zip is retained | **DELETE** |
| `artifacts/homehub-multi-role-enrollment-evidence` | 1.94 MB | **C** | Unpacked directory duplicating archive contents; primary archive archive/homehub-multi-role-enrollment-evidence.zip is retained | **DELETE** |
| `artifacts/multi-role-enrollment-final-audit` | 1.94 MB | **C** | Unpacked directory duplicating archive contents; primary archive archive/homehub-multi-role-enrollment-evidence.zip is retained | **DELETE** |
| `artifacts/evidence-gaps-closure-20261022` | 4.13 MB | **C** | Unpacked directory duplicating archive contents; primary archive artifacts/homehub-audit-evidence-portable-20261022.zip is retained | **DELETE** |

## 3. Deliberately Preserved Assets (Never Delete)

The following categories are **strictly preserved** and zero deletions are proposed from them:
1. **PostgreSQL Runtime & Database Data** (`.local_postgres/` [989 MB], `.pgdata/` [42 MB]): Preserved intact per Category E / Rule E.
2. **Node Dependencies** (`node_modules/` [412 MB]): Preserved intact per explicit user instructions.
3. **Git History & Configuration** (`.git/` [59.8 MB], `.gitignore`, `.dockerignore`): Preserved intact.
4. **Application Source Code** (`src/` [5.21 MB]): 100% preserved intact.
5. **Automated Test Suites & Harnesses** (`tests/` [4.98 MB]): 100% preserved intact.
6. **Database Schema & Migrations** (`drizzle/` [6.96 MB], `src/db/`): 100% preserved intact.
7. **Official Project Instructions & Rules** (`Kaywan_Latest_Instructions.txt`, `AGENTS.md`, `docs/`): 100% preserved intact.
8. **Authoritative Option 3 UI Audit Evidence** (`screenshots/option-3-workspace-audit-2026-10-30/` [92.52 MB]): 100% preserved intact as the latest proof of Option 3 implementation.
9. **Git-Tracked Screenshot Baselines** (`screenshots/fee-model/`, `screenshots/homehub-full-audit/`): 100% preserved intact.
10. **Pre-Production Audit Documentation** (`audit-evidence/` [55.5 KB]): 100% preserved intact.
11. **Primary Archive Evidence** in `archive/` (e.g. `HomeHub_Final_Verification_Closure_2026-10-27.zip`, `homehub-admin-fees-and-property-verification-evidence.zip`): Preserved intact.

## 4. Uncertain Candidates (Deferred / Not Proposed for Deletion)

The following folders were audited and evaluated but are **NOT** scheduled for deletion because their contents may contain historical reference material whose ownership has not been explicitly disclaimed:
- `artifacts/cross-domain-e2e/` (52.75 MB): Retained for historical audit comparison.
- `artifacts/homehub-ui-audit-2026-10-19-1400/` (24.63 MB): Retained for historical reference.
- `artifacts/homehub-e2e-audit-remediated-evidence/` (17.58 MB): Retained for historical reference.
- `header-design-options/` (2.18 MB): Retained for design review.
- Root audit scratch scripts (`audit_ui.ts`, `adversarial-utility.ts`, etc.): Retained intact.
