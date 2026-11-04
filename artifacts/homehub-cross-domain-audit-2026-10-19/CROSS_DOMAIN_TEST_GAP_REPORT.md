# HomeHub — Cross-Domain Test Gap & Execution Report
**Audit Date**: 2026-10-19  
**Execution Environment**: Local PostgreSQL (`homehub_test`) & Node.js test runner (`tsx`)  
**Scope**: Strictly Rental-Only Release (`FeatureFlags.BUY_SELL_ENABLED === false`)  

---

## 1. Executive Summary of Test Coverage

HomeHub features extensive automated test coverage across cross-domain boundaries, including unit, integration, and specialized adversarial suites designed to verify that every entity, transaction, and authorization check is correctly scoped to its parent property and authorized parties.

### Summary of Tests Executed During this Audit

| Test Suite File | Domain & Focus | Commands Executed | Test Count | Result |
| :--- | :--- | :--- | :---: | :---: |
| `tests/company-lease-approval-bypass.test.ts` | Cross-Domain: Company Manager vs Owner Authority | `npx tsx tests/company-lease-approval-bypass.test.ts` | 8/8 assertions | **100% PASS** |
| `tests/tenant-document-privacy-audit.test.ts` | Cross-Domain: Tenant vs Owner vs Foreign Tenant Privacy | `npx tsx tests/tenant-document-privacy-audit.test.ts` | 32/32 assertions | **100% PASS** |
| `tests/finding11-tenant-spending.test.ts` | Cross-Domain: Spending Limits & Quote Approval Authority | `npx tsx tests/finding11-tenant-spending.test.ts` | 1/1 assertions | **100% PASS** |

---

## 2. Existing Test Coverage Mapping

The table below maps existing test suites to the major cross-domain relationship families:

| Relationship Family | Relevant Test Suite | Key Boundary Verified |
| :--- | :--- | :--- |
| **Identity & Organization** | `tests/company-domain-adversary.test.ts` | Member suspension, cross-organization data isolation, role elevation prevention. |
| **Owner Authority & IDOR** | `tests/owner-domain-idor-adversary.test.ts` | Cross-owner property and financial data access, forged ownerId rejection. |
| **Management Authority** | `tests/company-lease-approval-bypass.test.ts` | Company manager draft creation vs mandatory owner approval boundary. |
| **Spending Limits** | `tests/finding11-tenant-spending.test.ts` | Tenant and manager quote approval blocked when exceeding spending threshold. |
| **Physical Space & Units** | `tests/lease-physical-space-overlap.test.ts` | Whole-property lease (`unit_id: null`) vs unit-level lease bidirectional conflict. |
| **Lease Concurrency** | `tests/lease-concurrency-postgres.test.ts` | Pessimistic parent-property row lock (`SELECT FOR UPDATE`) under concurrent race conditions. |
| **Rental Application** | `tests/rental-application-consumption.test.ts` | Exclusive reservation and atomic conversion of approved rental applications. |
| **Lease Renewal & Schedules**| `tests/focused-lease-renewal-payment-reversal.test.ts` | Future schedule generation without overwriting or deleting historical paid installments. |
| **Payment Integrity** | `tests/tenant-unconfirmed-payment-financial-integrity.test.ts` | Unconfirmed (`RECORDED`) claims leave schedule balance and fee engine untouched. |
| **Double-Entry Accounting** | `tests/atomic-payment-reversal-boundary.test.ts` | Compensating journal entries, ledger balancing ($\sum \text{Debits} = \sum \text{Credits}$). |
| **3 Operating Models** | `tests/verify-all-3-models-ledger.ts` | Entitlement routing for `FULLY_MANAGED`, `AGENT_LISTED_PLATFORM_MANAGED`, and `AGENT_OPERATED`. |
| **Custodial Deposits** | `tests/security-deposit-authorization.test.ts` | Segregated escrow, move-out inspection reconciliation, and deduction authorization. |
| **Tenant Privacy & Storage** | `tests/tenant-document-privacy-audit.test.ts` | IDOR on documents, TAPU/DEED isolation, prior tenant contract isolation, empty metadata guard. |
| **Communications & CRM** | `tests/communications-crm-adversary.test.ts` | Cross-tenant notification leakage, forged delivery status, CRM contact scoping. |
| **Fail-Closed DB Gateway** | `tests/database-gateway-fail-closed.test.ts` | Clean HTTP 503 `DATABASE_NOT_CONFIGURED` without mock state fabrication. |

---

## 3. Identified Gaps and Missing Test Recommendations

While coverage is comprehensive for single-owner, company management, and standard tenancy lifecycles, our systematic combination analysis identified three secondary edge cases that would benefit from focused regression tests:

### Gap 1: Multi-Owner Fractional Payout Split Regression
- **Scenario**: A property has two co-owners in `ownership_records` (60% and 40%).
- **Current Behavior**: Both co-owners have `VIEW_PROPERTY` and `VIEW_FINANCIALS` access. However, automated net rent payout distribution defaults to the primary verified owner's bank account.
- **Risk Level**: **MEDIUM**
- **Recommendation**: Add a dedicated unit test verifying how financial statements report fractional earnings vs actual payment distribution once a co-ownership payout policy is formalized.

### Gap 2: Active Tenancy Mid-Cycle Ownership Transfer
- **Scenario**: Legal title of an occupied property transfers from Owner A to Owner B while an active 1-year lease is ongoing.
- **Current Behavior**: `ownership_records` can be updated to link the new owner. Historical commission and payment records correctly preserve the `ownerId` that was active at collection time. However, there is no automated proration service for mid-month rent collections.
- **Risk Level**: **LOW (In Rental-Only Release)**
- **Reasoning**: In the current Rental-Only release, property sales and title transfers are intentionally deferred. If an owner transfers title externally, safe interim procedure requires manual adjustment of rent schedule payout routing.

### Gap 3: Tenant In-Tenancy Damage Recovery vs Utility Recharging
- **Scenario**: An active tenant causes accidental plumbing damage mid-lease. The vendor repairs it, and the owner wants to bill the tenant before move-out.
- **Current Behavior**: Vendor invoice is recorded against the property. Move-out deposit deductions only apply after move-out requests. Current procedure bills the tenant via an ad-hoc utility/maintenance bill or offline settlement.
- **Risk Level**: **LOW**
- **Recommendation**: Build a focused test verifying that a maintenance invoice cannot be automatically added as a rent surcharge without an explicit billing record.

---

## 4. Test Execution Commands & Verification Log

### Suite 1: Company Lease Approval Bypass Prevention
```powershell
npx tsx tests/company-lease-approval-bypass.test.ts
```
**Output Log**:
```
[AUDIT] User: appr_sec_company_admin | Action: LEASE_CREATED | Resource: Lease#a6b49aa0
✔ 1. Company cannot activate or bypass approval for a lease still awaiting owner approval (219ms)
✔ 2. Tenant cannot activate or approve on behalf of the owner (33ms)
✔ 3. Unauthorized company member or foreign owner cannot approve or activate (59ms)
[AUDIT] User: appr_sec_owner_A | Action: OWNER_APPROVE_LEASE | Resource: Lease#a6b49aa0
✔ 4. The authorized owner approval path succeeds and transitions to PENDING_SIGNATURE (29ms)
[AUDIT] User: appr_sec_tenant_1 | Action: LEASE_ACCEPTED | Resource: Lease#a6b49aa0
✔ 5. Legitimate subsequent signature and activation flows work seamlessly (61ms)
✔ 6. Rejected transitions leave lease CANCELLED and rent schedules unchanged (109ms)
✔ 7. Concurrent approval/activation attempts cannot bypass the required transition (1057ms)
✔ Company Lease Approval Bypass Prevention & Lifecycle Integrity Suite (2347ms)
tests 8 | pass 8 | fail 0
```

### Suite 2: Tenant Document Privacy & Object-Level Authorization
```powershell
npx tsx tests/tenant-document-privacy-audit.test.ts
```
**Output Log**:
```
✔ 1. Authorized tenant can see permitted resident rules in dashboard (48ms)
✔ 2. Authorized tenant can see inspection report associated with their occupied unit (17ms)
✔ 3. Authorized tenant can see lease document associated with their lease (13ms)
✔ 4. Authorized tenant can see their own uploaded identity document (13ms)
✔ 5. Tenant CANNOT see owner TAPU/DEED in dashboard (13ms)
✔ 6. Tenant CANNOT see another tenant identity document in dashboard (19ms)
✔ 7. Tenant CANNOT see another tenant lease document in dashboard (11ms)
✔ 8. Tenant CANNOT see another unit inspection report in dashboard (15ms)
✔ 9. Unknown/unclassified document types are excluded from dashboard by default (29ms)
✔ 10. Terminated lease tenant cannot view property documents in dashboard (11ms)
✔ 11. Authorized tenant can generate presigned download URL for permitted rules (14ms)
✔ 12. Authorized tenant can generate presigned download URL for own lease document (7ms)
✔ 13. Tenant CANNOT generate presigned download URL for owner TAPU/DEED (13ms)
✔ 14. Tenant CANNOT generate presigned download URL for another tenant ID (7ms)
✔ 15. Tenant CANNOT generate presigned download URL for another tenant lease contract (6ms)
✔ 16. Tenant CANNOT download document associated with different unit (8ms)
✔ 17. Unknown/private document key is rejected with 403 (6ms)
✔ 18. Non-existent or forged document key is rejected with 403 (8ms)
✔ 19. Terminated-lease tenant CANNOT download property documents (8ms)
✔ 20. Existing owner document download permissions remain intact (5ms)
✔ 21. Existing owner scoped documents query remains intact (14ms)
✔ 22. Tenant uploader CANNOT access forbidden TAPU/DEED in dashboard (16ms)
✔ 23. Tenant uploader CANNOT generate presigned download URL for forbidden TAPU/DEED (22ms)
✔ 24. Current tenant CANNOT see prior tenant lease contract for the same unit in dashboard (26ms)
✔ 25. Current tenant CANNOT generate presigned download URL for prior tenant lease contract in same unit (68ms)
✔ 26. Database authorization query exception strictly denies access and produces no signed URL (1ms)
✔ 27. Tenant with upcoming SIGNED lease and prior TERMINATED lease can see property documents in dashboard (18ms)
✔ 28. Tenant CANNOT see inspection report with empty metadata in dashboard (30ms)
✔ 29. Tenant CANNOT generate presigned download URL for inspection report with empty metadata (12ms)
✔ 30. Tenant CAN see explicitly classified property-wide inspection report in dashboard (29ms)
✔ 31. Tenant CAN generate presigned download URL for explicitly classified property-wide inspection (13ms)
✔ Tenant Document Privacy and Object-Level Authorization Suite (1591ms)
tests 32 | pass 32 | fail 0
```

### Suite 3: Tenant Spending Limits & Quote Approval Bypass
```powershell
npx tsx tests/finding11-tenant-spending.test.ts
```
**Output Log**:
```
✅ PASS [FINDING-11-01] Tenant spending limits bypass prevented (Tenant gets 403 when trying to approve quote). Got 403
TOTAL: 1 | PASSED: 1 | FAILED: 0
```
