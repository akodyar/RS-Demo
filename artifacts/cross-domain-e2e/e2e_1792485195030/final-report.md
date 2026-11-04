# HomeHub Cross-Domain Property Lifecycle E2E Audit Report
**Run ID**: `e2e_1792485195030`
**Date**: `2026-10-20T08:35:18.970Z`
**Environment**: Local Development (http://localhost:3048)
**Database**: `homehub_test` on `localhost:5432`
**Automation Framework**: Option C (Project-Local Playwright Headless Chromium)

## Executive Summary
A comprehensive, evidence-driven, cross-domain end-to-end audit of HomeHub was executed autonomously using an authoritative synthetic test identity and an anchor synthetic rental property (`60061892-861f-41ca-9a18-14ada57b7370`). The audit exercised interactive user interfaces, backend API routes, foreign-key relationships, financial invariants, and adversarial isolation boundaries across 8 integrated functional domains.

### Key Metrics
- **Interactive UI Actions Captured with Before/After Screenshots**: 59 actions (100% paired screenshots)
- **Cross-Domain Workflows Identified & Tested**: 8
- **Workflows Passed**: 8 / 8 (100%)
- **Workflows Failed**: 0
- **Workflows Blocked**: 0
- **Anchor Property ID**: `60061892-861f-41ca-9a18-14ada57b7370`
- **Anchor Owner User ID**: `19e8ae0b-c1ff-4e75-b8a9-1ed7dc5241f0`
- **Anchor Tenant User ID**: `462f2eb2-b043-47d0-8937-3fb62693bb29`
- **Active Lease ID**: `lease_e2e_1792485195030`
- **Confirmed Payment ID**: `pay_e2e_1792485195030`
- **Dynamic 3-Fee Commission ID**: `930876d4-3b45-40c8-96bf-15e57869982b`

## Invariant & Security Verification
1. **Authoritative Registration**: Dedicated test account registered through supported onboarding forms (`/onboarding/purpose` -> `Screen4Signup`), Argon2id password hashing, and deterministic role assignment.
2. **Anchor Property Creation**: Property wizard (`/properties/add`) successfully validated, persisted, and created linked `ownership_records` with status `VERIFIED`.
3. **Rental-Only Discipline**: Public marketplace enforces `domainMode="rent-only"`; navigating to `/sale` automatically redirects to `/rentals`.
4. **Tenant Isolation**: Unaffiliated tenant accounts cannot access active tenancy dashboards without an approved active lease.
5. **Dynamic 3-Fee Accounting**: Rent payment (`1,500,000 IQD`) verified under `FULLY_MANAGED` model with Platform Fee (2% = `30,000 IQD`), Rent Fee (5% = `75,000 IQD`), and Management Fee (5% = `75,000 IQD`).
6. **Payment Reversal Integrity**: Payment reversal correctly restored schedule balance to `0 IQD` and status `UPCOMING` without violating foreign keys or deleting records.
7. **Adversarial Access Denial**: Malicious mutation attempts from unauthorized users were blocked with HTTP 403 Forbidden.
