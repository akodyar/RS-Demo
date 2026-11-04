# Payment Reversal × Lease Renewal: Audit, Remediation & Architectural Verification Report

**Project**: HomeHub (پلاتفۆرمی مۆدێرنی خانووبەرە)  
**Date**: October 20, 2026  
**Target Environment**: Isolated PostgreSQL Integration Test Environment (`homehub_test` on `localhost:5432`)  
**Status**: **VERIFIED & COMPLETED (ALL INVARIANTS SATISFIED — ZERO OPEN DEFECTS)**  

---

## 1. Executive Summary & Objective

The objective of this engineering task was to investigate and resolve any confirmed defect at the accounting boundary between payment reversal and lease renewal within HomeHub.

### Required Invariant Verification Points:
1. **Rent Schedule Preservation & Foreign-Key Integrity**: Foreign-key references (`rent_schedules.id` referenced by `payment_records.rent_schedule_id` and `journal_entries.rent_schedule_id`) must never be severed or trigger PostgreSQL foreign-key constraint violations (`error 23503`).
2. **Accurate `paidAmount` & Schedule Status Recalculation**: Reversing a payment must decrement `paidAmount` accurately based only on remaining valid `CONFIRMED` payments and transition status (`PAID` $\rightarrow$ `PARTIALLY_PAID` $\rightarrow$ `UPCOMING` / `OVERDUE`).
3. **Shortened Lease-Renewal Behavior**: When a renewal period is shortened, obsolete rent schedules must **never be deleted** if referenced by historical payment records. Instead, they must be marked `status: 'CANCELLED'` and `amount: '0'`, preserving audit history and referential integrity. Shortened renewals must be strictly blocked if any obsolete schedule contains unreversed collected payments (`paidAmount > 0`) or pending `RECORDED` payments.
4. **Transaction Atomicity & Concurrency Protection**: Reversals and renewal approvals must execute inside strict database transaction boundaries (`db.transaction()`) with row-level pessimistic locking (`FOR UPDATE`) to prevent double-decrement balance corruption from concurrent requests.

---

## 2. In-Depth Root Cause & Architectural Audit

### 2.1 The Historical Defect
In earlier versions of the lease management service, `approveRenewal()` generated new schedules and handled date changes by deleting obsolete schedules:
```sql
-- Obsolete legacy behavior that caused defect:
DELETE FROM rent_schedules WHERE lease_id = $1 AND due_date > $2;
```
When a tenant had made a payment on an upcoming schedule (or a payment had been recorded and subsequently reversed), the record in `payment_records` retained a foreign key `payment_records.rent_schedule_id -> rent_schedules.id`. Attempting to delete the referenced `rent_schedules` row failed immediately with PostgreSQL constraint error:
```
error: update or delete on table "rent_schedules" violates foreign key constraint "payment_records_rent_schedule_id_rent_schedules_id_fk" on table "payment_records" (code: 23503)
```

### 2.2 The Remediated Architecture (Current Implementation)

Our source audit of `src/server/repositories/leases.ts` and `src/server/routes/leases.ts` revealed that this defect was systematically addressed in Phases 4 and 4.1:

1. **Non-Destructive Schedule Cancellation in `approveRenewal`** ([`src/server/repositories/leases.ts:1040-1065`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/repositories/leases.ts#L1040-L1065)):
   - Before modifying any schedules, `approveRenewal` fetches all existing schedules for the lease.
   - For any schedule falling outside the renewed lease period:
     * **Validation Gate 1**: Checks if `Number(s.paidAmount || 0) > 0`. If true, aborts renewal with:
       `Cannot shorten lease: rent schedule starting ${s.periodStart} has collected payments ($${s.paidAmount}). Reconcile or refund payments before shortening the lease.`
     * **Validation Gate 2**: Checks if any pending `RECORDED` payment exists for that schedule. If true, aborts renewal with:
       `Cannot shorten lease: rent schedule starting ${s.periodStart} has pending recorded payments. Cancel or resolve pending payments first.`
     * **Safe In-Place Inactivation**: Obsolete schedules are **NEVER deleted**. Instead, they are updated in-place:
       ```typescript
       await tx.update(rentSchedules)
         .set({
           status: 'CANCELLED',
           amount: '0',
           paidAmount: '0',
           notes: `Cancelled due to lease shortening via renewal ${renewalId}`,
           updatedAt: new Date()
         })
         .where(eq(rentSchedules.id, s.id));
       ```
   - Because rows are never deleted, all historical payment records (`CONFIRMED`, `REVERSED`, or `REFUNDED`) maintain 100% valid foreign keys without foreign-key errors.

2. **Period-Aware In-Place Schedule Upsert in `generateRentSchedule`** ([`src/server/repositories/leases.ts:800-880`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/repositories/leases.ts#L800-L880)):
   - Existing schedules are queried and indexed by Year and Month.
   - Overlapping schedules within the renewed lease period are updated in-place (updating `amount` and `dueDate` if changed), while **preserving the existing `rent_schedules.id`** and any existing partial `paidAmount`.
   - If an existing schedule already has collected rent greater than the newly proposed lower rent, the renewal transaction immediately throws a validation error and aborts via transaction rollback.

3. **Atomic Reversal with Pessimistic Locking & Accurate Recalculation** ([`src/server/routes/leases.ts:430-580`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/routes/leases.ts#L430-L580)):
   - Reversal begins inside an atomic transaction: `db.transaction(async (tx) => ...)`.
   - **Row-Level Lock**: The payment record is fetched with pessimistic row locking:
     ```typescript
     const [payment] = await tx.select().from(paymentRecords)
       .where(eq(paymentRecords.id, paymentId))
       .for('update');
     ```
   - **Duplicate Reversal Prevention**: If `payment.status !== 'CONFIRMED'`, the transaction rejects with HTTP 400 Bad Request (`Only CONFIRMED payments can be reversed. Current status: ${payment.status}`).
   - **Schedule Lock & Recalculation**: The associated schedule is selected with `.for('update')`.
   - `paidAmount` is recalculated by aggregating all *remaining* active `CONFIRMED` payments for that schedule:
     ```typescript
     const otherConfirmedPayments = await tx.select().from(paymentRecords).where(
       and(
         eq(paymentRecords.rentScheduleId, schedule.id),
         eq(paymentRecords.status, 'CONFIRMED'),
         ne(paymentRecords.id, paymentId)
       )
     );
     const newPaidAmount = otherConfirmedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
     ```
   - Status transitions strictly adhere to the business rules:
     * If `schedule.status === 'CANCELLED'`, status remains `'CANCELLED'`.
     * If `newPaidAmount >= Number(schedule.amount)`, status is `'PAID'`.
     * If `newPaidAmount > 0`, status is `'PARTIALLY_PAID'`.
     * If `newPaidAmount === 0`, status is `'OVERDUE'` if `schedule.dueDate < today`, otherwise `'UPCOMING'`.

4. **Fee Reversal & Ledger Invariants**:
   - Reversal cascades to HomeHub platform fee commissions (`commissions` table) and dual-entry ledger (`journal_entries` and `ledger_lines`), ensuring zero revenue from reversed payments is reported as collected company or owner income.

---

## 3. Defect Reproduction Matrix & Outcome

We designed and executed a comprehensive test suite reproducing all 8 required scenarios from the prompt:

| Scenario | Test Script / Suite | Expected Behavior | Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Payment reversed before renewal** | `scripts/reproduce-renewal-reversal-defect.ts` | Schedule paidAmount zeroed, renewal approved, schedule updated in-place | Succeeded cleanly, August schedule updated to 1,500,000, paidAmount 0 | **PASS** |
| **2. Renewal approved then payment reversed** | `tests/focused-lease-renewal-payment-reversal.test.ts` | Payment reversed, schedule paidAmount decremented, status recalculated | Succeeded, paidAmount 0, status UPCOMING | **PASS** |
| **3. Shortened renewal (months truncated)** | `tests/lease-shortening-integrity.test.ts` | Obsolete schedules marked CANCELLED with amount 0, rows not deleted | 6 schedules kept, 6 obsolete marked CANCELLED amount 0, 0 deletions | **PASS** |
| **4. Payment history on affected schedules** | `tests/focused-lease-renewal-payment-reversal.test.ts` | Obsolete schedule with historical reversed payment preserved, FK intact | Succeeded, FK constraint valid via PostgreSQL JOIN, no error 23503 | **PASS** |
| **5. Repeated reversal of same payment** | `tests/atomic-payment-reversal-boundary.test.ts` | Second attempt rejected with 400 Bad Request, balance unchanged | Rejected with ALREADY_REVERSED, balance not double-decremented | **PASS** |
| **6. Concurrent reversal requests** | `tests/focused-lease-renewal-payment-reversal.test.ts` | Row lock serializes requests; exactly 1 succeeds, 1 fails | 1 succeeded (200), 1 failed (400), balance decremented exactly once | **PASS** |
| **7. Multi-step failure & atomic rollback** | `tests/atomic-payment-reversal-boundary.test.ts` | Induced failure rolls back transaction completely; zero partial data | Rollback confirmed, payment remained CONFIRMED, schedules intact | **PASS** |
| **8. Status calculation boundaries** | `tests/focused-lease-renewal-payment-reversal.test.ts` | PAID -> PARTIALLY_PAID -> UPCOMING/OVERDUE calculated accurately | All status transitions verified with non-zero and zero balances | **PASS** |

### Reproduction Conclusion
The suspected defect (foreign key violation or schedule deletion error during renewal after payment reversal) **does not reproduce in the current codebase** because the architecture was already upgraded to non-destructive in-place schedule updates and cancellations (`status: 'CANCELLED'`, `amount: '0'`). All 8 scenarios passed with 100% adherence to invariants.

---

## 4. Test Suite Execution Summary

All tests executed directly against PostgreSQL `homehub_test` on `localhost:5432`:

```
========================================================================================
Test Suite                                         Tests Run   Passed   Failed   Time
========================================================================================
scripts/reproduce-renewal-reversal-defect.ts               1        1        0   1.8s
tests/focused-lease-renewal-payment-reversal.test.ts       9        9        0   1.5s
tests/payment-reversal-lease-renewal-integrity.test.ts    11       11        0   2.3s
tests/lease-renewal-reversal-integrated.test.ts            4        4        0   1.2s
tests/atomic-payment-reversal-boundary.test.ts            10       10        0   2.1s
tests/lease-shortening-integrity.test.ts                   4        4        0   0.8s
tests/payment-reversal-integrity.test.ts                   1        1        0   0.8s
tests/lease-renewal-duplicate-check.test.ts                1        1        0   0.6s
tests/lease-renewal-regression.test.ts & audit            18       18        0   2.7s
tests/reversal-fallback-fee-integrity.test.ts              8        8        0   1.9s
========================================================================================
TOTAL                                                     67       67        0  16.7s
========================================================================================
```

In addition, `npx vite build` executed and passed cleanly:
```
✓ 2816 modules transformed.
dist/index.html                     1.42 kB │ gzip:   0.66 kB
dist/assets/index-rAM1Xcn5.css    186.77 kB │ gzip:  29.64 kB
dist/assets/index-wKJzDBQm.js   3,493.34 kB │ gzip: 790.89 kB
✓ built in 10.74s
```

---

## 5. Worktree Preservation & Safety Control

1. **Pre-existing Worktree Preserved**: All 681 untracked and modified files across the workspace remain completely intact. No git stash, reset, clean, or checkout commands were run.
2. **Database Isolation**: All test scripts explicitly connected to `homehub_test` on `localhost:5432`. No production database or credentials were used.
3. **No Unrelated Code Refactoring**: Code modifications were restricted to making legacy test harnesses (`tests/lease-shortening-integrity.test.ts` and `tests/payment-reversal-integrity.test.ts`) compatible with the project's native `node:test` runner.

---

## 6. Business Decisions & Proposed Instruction Update

### Business Policies Confirmed
1. **Shortened Leases**: Obsolete rent schedules are never deleted; they are marked `CANCELLED` with `amount = 0`, preserving referential integrity for historical payment records.
2. **Payment Allocation**: Payments made prior to a lease renewal remain bound to the specific rent schedule on which they were recorded. In-place renewal updates adjust the schedule amount without shifting payment allocations across unrelated periods.
3. **Collected Revenue**: Reversed payments are excluded 100% from owner revenue and platform fees.

### Proposed Update for `Kaywan_Latest_Instructions.txt`
```text
- [VERIFIED] Payment Reversal × Lease Renewal Financial Boundary: Audited and verified across all 8 mandatory scenarios (schedule preservation, foreign-key integrity, accurate paidAmount recalculation, shortened renewal schedule cancellation, pessimistic row locking, and atomic transaction rollback). All 67 focused and adjacent integration tests pass on PostgreSQL homehub_test.
```
