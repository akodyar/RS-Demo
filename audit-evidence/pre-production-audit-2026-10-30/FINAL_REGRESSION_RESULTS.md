# FINAL REGRESSION RESULTS REPORT

**Date & Time**: 2026-10-30T08:25:00+03:00  
**Target Environment**: Isolated Verification Cluster (`homehub_test`) & Project-Local Playwright  
**Auditor**: Lead Full-Stack & Systems Engineering Agent  
**Status**: 100% PASS (Zero Failures Across All Suites)

---

## 1. Comprehensive Test Execution Summary

| Suite / Test Name | Category | Runner | Assertions / Tests | Result | Duration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **verify-disaster-recovery.ts** | Disaster Recovery | Node/psql/pg_dump | 113 tables, 41,027 rows parity | **PASS (100%)** | 18.38 s |
| **communications-crm-adversary.test.ts** | Notifications & CRM | npx tsx | 131 tests / 63 specs | **PASS (100%)** | 35.2 s |
| **property-discovery-sponsored-points-lifecycle.test.ts** | Marketplace / Promotions | npx tsx | 12 tests | **PASS (100%)** | 13.4 s |
| **owner-listing-rental-only.test.ts** | Rental Boundary | npx tsx | 10 tests | **PASS (100%)** | 12.8 s |
| **rent-marketplace-modernization.test.ts** | Marketplace Architecture | npx tsx | 8 tests | **PASS (100%)** | 1.6 s |
| **storage-route-identity.test.ts** | Storage Security | npx tsx | 7 tests | **PASS (100%)** | 13.3 s |
| **tenant-document-privacy-audit.test.ts** | Object-Level Authorization | npx tsx | 32 tests | **PASS (100%)** | 12.5 s |
| **property-creation-idempotency.test.ts** | Request Idempotency | npx tsx | 14 tests | **PASS (100%)** | 17.7 s |
| **lease-concurrency-postgres.test.ts** | PostgreSQL Concurrency | npx tsx | 23 tests (72 attempts) | **PASS (100%)** | 45.1 s |
| **native-auth-security.test.ts** | Auth / Argon2id / JWT | npx tsx | 33 tests | **PASS (100%)** | 22.4 s |
| **user-registration-permissions-security-lifecycle.test.ts** | Multi-Role Security | npx tsx | 32 tests | **PASS (100%)** | 20.8 s |
| **property-verification-and-owner-management-choice.test.ts**| Property Lifecycle | npx tsx | 14 tests | **PASS (100%)** | 14.6 s |
| **vendor-expense-trade-ap-accounting.test.ts** | Vendor / AP Accounting | npx tsx | 7 tests | **PASS (100%)** | 10.8 s |
| **focused-lease-renewal-payment-reversal.test.ts** | Lease / Reversal Integrity| npx tsx | 9 tests | **PASS (100%)** | 19.1 s |
| **unmapped-ledger-reporting-integrity.test.ts** | Accounting Integrity | npx tsx | 7 tests | **PASS (100%)** | 12.4 s |
| **owner-finance-confirmed-collection.test.ts** | Financial Collections | npx tsx | 1 test | **PASS (100%)** | 11.6 s |
| **f001-ownership-percentage-rtl.test.ts** | RTL Percentage Unit | npx tsx | 4 tests | **PASS (100%)** | 0.3 s |
| **f001-sorani-rtl-percentage-rendering.spec.ts** | RTL Browser Playwright | Playwright (Option C) | 2 tests | **PASS (100%)** | 72.0 s |
| **Production Build (`npm run build`)** | Build & Bundling | Vite + esbuild | 2,829 modules + server.cjs | **PASS (100%)** | 14.8 s |
| **TOTAL** | — | — | **356 Assertions / Tests** | **100% PASS** | — |

---

## 2. Invariants Check
- **Zero Data Loss**: Parity confirmed across 113 tables and 41,027 live rows.
- **Double-Entry Reconciliation**: Debits equal Credits across all journal entries ($\Delta = 0.00$).
- **Fail-Closed Guarantees**: Database disconnection yields immediate 503 fail-closed responses. Zero shadow or fabricated mock data.
- **Rental-Only Scope**: `BUY_SELL_ENABLED` is false; public listing queries strictly enforce rental transactions.
- **Option 3 Layout**: 100% implemented across all 14 workspaces.

