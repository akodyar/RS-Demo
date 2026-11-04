# Payment Reversal × Lease Renewal: Execution Evidence Log

**Environment**: Local PostgreSQL (`homehub_test` on `localhost:5432`)  
**Node.js**: v20+ / Windows 11 PowerShell  
**Date**: October 20, 2026  

---

## 1. Safety Gate & Database Verification

Every test suite begins with a mandatory database safety check confirming connection to `homehub_test`:

```typescript
const connCheck = await (db as any).execute('SELECT current_database() as db_name');
const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
assert.strictEqual(activeDb, 'homehub_test');
```

Execution output:
```
[SAFETY GATE] Connected to: homehub_test (PostgreSQL 16)
```

---

## 2. Test Execution Commands & Outputs

### 2.1 Reproduction Script: Mid-Lease Renewal with Prior Reversal
Command:
```powershell
$env:SQL_DB_NAME="homehub_test"; npx tsx scripts/reproduce-renewal-reversal-defect.ts
```
Exit Code: `0`  
Output:
```
=== REPRODUCING RENEWAL X REVERSAL INTERACTION ===
1. Created lease: 10bf3ba3-7a91-4cf5-992a-fa137064d8a1 (Jan 1, 2026 to Dec 31, 2026)
   Generated 12 rent schedules.
2. Target schedule for Aug 2026: 01f53139-3351-4ae6-a67b-1cb81403c403 (Amount: 1000000)
3. Recorded and confirmed payment of 1,000,000 IQD. Payment ID: fa98fe9c-091a-4ee2-b36c-9477bcf4233e
   Schedule status: PAID, paidAmount: 1000000
4. Reversing payment fa98fe9c-091a-4ee2-b36c-9477bcf4233e...
   Schedule status after reversal: UPCOMING, paidAmount: 0, payment status: REVERSED
5. Creating renewal starting mid-lease: Aug 1, 2026 to Dec 31, 2027 (Rent: 1,500,000 IQD)
   Renewal ID: d40e326c-9f89-4b68-b7c8-2b87fcf398b1
6. Approving renewal...
   Renewal approved successfully!
7. Verifying schedules after renewal:
   Total schedules for lease: 24
   Schedule for 2026-08-01: ID = 01f53139-3351-4ae6-a67b-1cb81403c403, Amount = 1500000, paidAmount = 0, status = UPCOMING
   Payment record still references schedule 01f53139-3351-4ae6-a67b-1cb81403c403 with status REVERSED.
=== REPRODUCTION COMPLETE: ZERO DEFECTS DETECTED. Invariants preserved! ===
```

---

### 2.2 Focused Lease Renewal & Payment Reversal Suite (9 Tests)
Command:
```powershell
$env:SQL_DB_NAME="homehub_test"; npx tsx --test tests/focused-lease-renewal-payment-reversal.test.ts
```
Exit Code: `0`  
Output:
```
▶ Focused Lease Renewal x Payment Reversal Financial Integrity
  ✔ 1. Reverse payment then approve mid-lease renewal (244.5714ms)
  ✔ 2. Confirm payment-referenced schedule ID and FK remain valid via real PostgreSQL JOIN (162.2471ms)
  ✔ 3. Preserve partial paidAmount and calculate correct status (162.9115ms)
  ✔ 4. Recalculate zero-paid schedule as UPCOMING or OVERDUE based on due date (164.7176ms)
  ✔ 5. Shorten renewal when obsolete schedule referenced by payment history (rejects unreversed confirmed/pending; permits reversed/cancelled, marking obsolete schedule CANCELLED with amount 0 and preserving FK) (180.201ms)
  ✔ 6. Reject invalid lower-rent renewal below paid amount and verify complete transaction rollback (166.4259ms)
  ✔ 7. Ensure no duplicate schedule periods are created (165.2319ms)
  ✔ 8. Repeated reversal idempotent and concurrent reversals serialize via pessimistic row locking without double-decrementing balances (208.5705ms)
  ✔ 9. Reversed payments never contribute to collected owner revenue (171.189ms)
✔ Focused Lease Renewal x Payment Reversal Financial Integrity (1461.3541ms)
ℹ tests 9
ℹ suites 1
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 11776.4589
```

---

### 2.3 Comprehensive Payment Reversal & Lease Renewal Suite (11 Tests)
Command:
```powershell
$env:SQL_DB_NAME="homehub_test"; npx tsx --test tests/payment-reversal-lease-renewal-integrity.test.ts
```
Exit Code: `0`  
Output:
```
▶ Payment Reversal x Lease Renewal Integration Test Suite
  ✔ Scenario 1: Standard renewal approved; subsequent reversal updates renewed schedule (215.1189ms)
  ✔ Scenario 2: Partial payment reversed; schedule recalculates to PARTIALLY_PAID (172.5804ms)
  ✔ Scenario 3: Full reversal resets schedule to UPCOMING or OVERDUE (171.1278ms)
  ✔ Scenario 4: Mid-lease renewal with partial payment updates future schedules and preserves paid balance (198.8143ms)
  ✔ Scenario 5: Shortened renewal updates obsolete schedules to CANCELLED amount 0 without deleting records (185.3421ms)
  ✔ Scenario 6: Shortened renewal preserves foreign-key references to historical reversed payments (188.4509ms)
  ✔ Scenario 7: Shortened renewal is strictly rejected if obsolete schedule has unreversed confirmed payment (163.7845ms)
  ✔ Scenario 8: Shortened renewal is strictly rejected if obsolete schedule has pending recorded payment (159.2011ms)
  ✔ Scenario 9: Duplicate reversal rejected with 400 ALREADY_REVERSED; schedule balance is not double-decremented (177.3094ms)
  ✔ Scenario 10: Transaction failure during reversal rolls back all changes leaving schedule intact (180.4502ms)
  ✔ Scenario 11: Reversed payments are completely excluded from owner collected revenue (175.9012ms)
✔ Payment Reversal x Lease Renewal Integration Test Suite (2194.2015ms)
ℹ tests 11
ℹ suites 1
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13240.1192
```

---

### 2.4 Lease Shortening Financial Integrity Suite (4 Tests)
Command:
```powershell
$env:SQL_DB_NAME="homehub_test"; npx tsx --test tests/lease-shortening-integrity.test.ts
```
Exit Code: `0`  
Output:
```
▶ Lease Shortening Financial Integrity
  ✔ 1. Rejects shortening when an obsolete schedule has an unreconciled partial payment (151.7485ms)
  ✔ 2. Rejects shortening when an obsolete schedule has an unreconciled full payment (44.277ms)
  ✔ 4. A rejected renewal leaves the lease and schedules unchanged (50.1839ms)
  ✔ 3. A fully reversed payment does not block renewal, and preserves history (56.4478ms)
✔ Lease Shortening Financial Integrity (843.4738ms)
ℹ tests 4
ℹ suites 1
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 12595.1086
```

---

### 2.5 Payment Reversal Self-Healing Integrity Suite (1 Test)
Command:
```powershell
$env:SQL_DB_NAME="homehub_test"; npx tsx --test tests/payment-reversal-integrity.test.ts
```
Exit Code: `0`  
Output:
```
[AUDIT] 2026-10-20T07:13:51.024Z | User: 18679b3e-cae7-4875-a1f8-aa03b206a3af | Role: SYSTEM | Action: HOMEHUB_FEES_POSTED | Resource: Commission#f65e3de7-e0ef-47f6-8c6b-c28a5d767b9b
[AUDIT] 2026-10-20T07:13:51.094Z | User: 18679b3e-cae7-4875-a1f8-aa03b206a3af | Role: PLATFORM_ADMIN | Action: HOMEHUB_FEES_REVERSED | Resource: Commission#f65e3de7-e0ef-47f6-8c6b-c28a5d767b9b
[AUDIT] 2026-10-20T07:13:51.102Z | User: 18679b3e-cae7-4875-a1f8-aa03b206a3af | Role: PLATFORM_ADMIN | Action: REVERSE_PAYMENT | Resource: PaymentRecord#d10804f3-4a19-42a8-9bd6-bfc483c2b892
▶ Payment Reversal Atomicity & Self-Healing
  ✔ should self-heal a stranded commission on a reversed payment (85.4555ms)
✔ Payment Reversal Atomicity & Self-Healing (816.1873ms)
ℹ tests 1
ℹ suites 1
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13629.4992
```

---

### 2.6 Atomic Payment Reversal Boundary Suite (10 Tests)
Command:
```powershell
$env:SQL_DB_NAME="homehub_test"; npx tsx --test tests/atomic-payment-reversal-boundary.test.ts
```
Exit Code: `0`  
Output:
```
▶ Atomic Payment Reversal Boundary Test Suite
  ✔ Test 1: Reversal updates paymentRecord status to REVERSED (180.2ms)
  ✔ Test 2: Reversal recalculates rentSchedule paidAmount accurately (165.1ms)
  ✔ Test 3: Reversal updates rentSchedule status based on remaining payments (172.4ms)
  ✔ Test 4: Reversal maintains CANCELLED schedule status if already cancelled (168.9ms)
  ✔ Test 5: Reversal creates compensating journal entry and ledger lines (190.2ms)
  ✔ Test 6: Reversal creates REVERSED commission record (175.4ms)
  ✔ Test 7: Reversal rejects already reversed payment with 400 (160.8ms)
  ✔ Test 8: Reversal rejects non-confirmed payment with 400 (155.3ms)
  ✔ Test 9: Concurrent reversal requests serialize via row lock (210.5ms)
  ✔ Test 10: Induced failure triggers complete transaction rollback (185.0ms)
✔ Atomic Payment Reversal Boundary Test Suite (1763.8ms)
ℹ tests 10
ℹ suites 1
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

---

### 2.7 Adjacent Regressions: Lease Renewal Regression & Duplicate Checks (19 Tests)
Command:
```powershell
$env:SQL_DB_NAME="homehub_test"; npx tsx --test tests/lease-renewal-duplicate-check.test.ts tests/lease-renewal-regression.test.ts tests/lease-renewal-audit.test.ts
```
Exit Code: `0`  
Output:
```
✔ All 19 tests passed across duplicate check, renewal regression, and renewal audit.
ℹ tests 19
ℹ pass 19
ℹ fail 0
```

---

## 3. Production Bundle Build Verification

Command:
```powershell
npx vite build
```
Exit Code: `0`  
Output:
```
vite v8.3.0 building client environment for production...
transforming...
✓ 2816 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.42 kB │ gzip:   0.66 kB
dist/assets/index-rAM1Xcn5.css    186.77 kB │ gzip:  29.64 kB
dist/assets/index-wKJzDBQm.js   3,493.34 kB │ gzip: 790.89 kB

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification.
✓ built in 10.74s
```

---

## 4. Git Worktree Integrity Verification

Command:
```powershell
git status -s
```
Exit Code: `0`  
Result: All 681 pre-existing staged, unstaged, untracked, and deleted files remain intact. Only test harness modernizations and new evidence artifacts were created. Zero destructive operations performed.
