import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  securityDeposits,
  chartOfAccounts,
  journalEntries,
  ledgerLines,
} from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { financeService } from '../src/server/services/finance.js';
import { UserRole } from '../src/types/index.js';

test('Financial Deposit Deduction Accounting — Double-Entry Integrity & Economic Semantics', async (t) => {
  const runId = `depded_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // Ensure standard Chart of Accounts exist
  await db.insert(chartOfAccounts).values([
    { id: `coa_1010_${runId}`, code: '1010', name: 'Cash', accountType: 'ASSET' },
    { id: `coa_2010_${runId}`, code: '2010', name: 'Accounts Payable', accountType: 'LIABILITY' },
    { id: `coa_2100_${runId}`, code: '2100', name: 'Security Deposits Liability', accountType: 'LIABILITY' },
  ]).onConflictDoNothing();

  const ownerId = `owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const propId = `prop_${runId}`;
  const leaseId = `lease_${runId}`;
  const depositId = `dep_${runId}`;

  // Provision fixtures
  await db.insert(users).values([
    { id: ownerId, firstName: 'Karwan', lastName: 'Owner', email: `${ownerId}@homehub.iq`, roles: [UserRole.PROPERTY_OWNER] },
    { id: tenantId, firstName: 'Daban', lastName: 'Tenant', email: `${tenantId}@tenant.iq`, roles: [UserRole.TENANT] },
  ]);

  await db.insert(properties).values({
    id: propId,
    name: `Test Property ${runId}`,
    type: 'RESIDENTIAL',
    status: 'RENTED',
    createdBy: ownerId,
  });

  await db.insert(leases).values({
    id: leaseId,
    propertyId: propId,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: '1000000',
    currency: 'IQD',
    status: 'ACTIVE',
  });

  await db.insert(securityDeposits).values({
    id: depositId,
    leaseId: leaseId,
    propertyId: propId,
    tenantId: tenantId,
    requiredAmount: '1000000',
    recordedAmount: '0',
    releasedAmount: '0',
    currency: 'IQD',
    status: 'PENDING',
  });

  // --------------------------------------------------------------------------
  // Step 1: Collect Full Security Deposit (1,000,000 IQD)
  // --------------------------------------------------------------------------
  await t.test('1. Security Deposit Collection — Dr 1010 (Cash), Cr 2100 (Deposit Liability)', async () => {
    const updated = await financeService.collectSecurityDeposit(depositId, 1000000);
    assert.strictEqual(updated.status, 'HELD');
    assert.strictEqual(Number(updated.recordedAmount), 1000000);
    assert.strictEqual(Number(updated.releasedAmount), 0);

    // Verify Journal Entry
    const [je] = await db.select().from(journalEntries).where(eq(journalEntries.propertyId, propId)).orderBy(journalEntries.createdAt);
    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id));

    assert.strictEqual(lines.length, 2);
    const drLine = lines.find(l => l.accountId === '1010');
    const crLine = lines.find(l => l.accountId === '2100');

    assert.ok(drLine && Number(drLine.debit) === 1000000 && Number(drLine.credit) === 0, 'Dr 1010 Cash = 1,000,000');
    assert.ok(crLine && Number(crLine.credit) === 1000000 && Number(crLine.debit) === 0, 'Cr 2100 Liability = 1,000,000');
  });

  // --------------------------------------------------------------------------
  // Step 2: Partial Refund to Tenant (700,000 IQD)
  // --------------------------------------------------------------------------
  await t.test('2. Tenant Partial Refund — Dr 2100 (Deposit Liability), Cr 1010 (Cash)', async () => {
    const updated = await financeService.releaseSecurityDeposit(depositId, 700000, {
      actorUserId: ownerId,
      actorRole: 'PROPERTY_OWNER',
    });
    assert.strictEqual(updated.status, 'PARTIALLY_REFUNDED');
    assert.strictEqual(Number(updated.releasedAmount), 700000);

    // Verify Journal Entry
    const jes = await db.select().from(journalEntries).where(eq(journalEntries.propertyId, propId)).orderBy(journalEntries.createdAt);
    const refundJe = jes[1];
    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, refundJe.id));

    assert.strictEqual(lines.length, 2);
    const drLine = lines.find(l => l.accountId === '2100');
    const crLine = lines.find(l => l.accountId === '1010');

    assert.ok(drLine && Number(drLine.debit) === 700000 && Number(drLine.credit) === 0, 'Dr 2100 Liability = 700,000');
    assert.ok(crLine && Number(crLine.credit) === 700000 && Number(crLine.debit) === 0, 'Cr 1010 Cash = 700,000');
  });

  // --------------------------------------------------------------------------
  // Step 3: Deduction Forfeited to Owner for Repairs (300,000 IQD)
  // --------------------------------------------------------------------------
  await t.test('3. Repair Damage Deduction — Dr 2100 (Deposit Liability), Cr 2010 (Owner Payable)', async () => {
    const { deposit: updated, journalEntry } = await financeService.applyDepositDeduction(
      depositId,
      300000,
      'Drywall patching and paint damage repair',
      { actorUserId: ownerId, actorRole: 'PROPERTY_OWNER' }
    );

    assert.strictEqual(updated.status, 'REFUNDED');
    assert.strictEqual(Number(updated.releasedAmount), 1000000);

    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, journalEntry.id));
    assert.strictEqual(lines.length, 2);

    const drLine = lines.find(l => l.accountId === '2100');
    const crLine = lines.find(l => l.accountId === '2010');

    assert.ok(drLine && Number(drLine.debit) === 300000 && Number(drLine.credit) === 0, 'Dr 2100 Deposit Liability = 300,000');
    assert.ok(crLine && Number(crLine.credit) === 300000 && Number(crLine.debit) === 0, 'Cr 2010 Owner Payable = 300,000');
  });

  // --------------------------------------------------------------------------
  // Step 4: Economic Semantics & Balance Invariant
  // --------------------------------------------------------------------------
  await t.test('4. Complete Cycle Semantics — Debits equal Credits; Cash and Liabilities in equilibrium', async () => {
    const allJes = await db.select().from(journalEntries).where(eq(journalEntries.propertyId, propId));
    let totalDebit = 0;
    let totalCredit = 0;

    let balance1010 = 0; // Cash Asset: Debit increases, Credit decreases
    let balance2100 = 0; // Deposit Liability: Credit increases, Debit decreases
    let balance2010 = 0; // Owner Payable Liability: Credit increases, Debit decreases

    for (const je of allJes) {
      const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id));
      for (const l of lines) {
        const d = Number(l.debit || 0);
        const c = Number(l.credit || 0);
        totalDebit += d;
        totalCredit += c;

        if (l.accountId === '1010') balance1010 += (d - c);
        if (l.accountId === '2100') balance2100 += (c - d);
        if (l.accountId === '2010') balance2010 += (c - d);
      }
    }

    // 1. Double-entry equality
    assert.strictEqual(totalDebit, totalCredit, `Total Debits (${totalDebit}) must equal Total Credits (${totalCredit})`);

    // 2. Deposit Liability (2100) is fully extinguished (0)
    assert.strictEqual(balance2100, 0, 'Security Deposit Liability must be exactly 0 after full resolution');

    // 3. Cash Asset (1010) retains exactly the 300,000 IQD repair deduction
    assert.strictEqual(balance1010, 300000, 'Cash Asset must hold 300,000 IQD repair funds in bank');

    // 4. Owner Payable (2010) reflects exactly the 300,000 IQD owed to the owner
    assert.strictEqual(balance2010, 300000, 'Owner Payable must reflect 300,000 IQD payable entitlement');

    // 5. Total Assets === Total Liabilities
    assert.strictEqual(balance1010, balance2010, 'Assets (Cash 300,000) === Liabilities (Owner Payable 300,000)');
  });

  // --------------------------------------------------------------------------
  // Step 5: Boundary Validation — Over-deduction is rejected
  // --------------------------------------------------------------------------
  await t.test('5. Rejection — Deduction exceeding remaining balance is rejected', async () => {
    await assert.rejects(
      async () => {
        await financeService.applyDepositDeduction(depositId, 1, 'Exceeding deduction');
      },
      /cannot exceed remaining held deposit balance/
    );
  });

  // --------------------------------------------------------------------------
  // Step 6: Idempotency Protection — Repeated call with same idempotencyKey does not double-deduct
  // --------------------------------------------------------------------------
  await t.test('6. Idempotency — Repeated call with identical idempotencyKey returns existing state without double deduction', async () => {
    const idemDepositId = `dep_idem_${runId}`;
    await db.insert(securityDeposits).values({
      id: idemDepositId,
      leaseId: leaseId,
      propertyId: propId,
      tenantId: tenantId,
      requiredAmount: '500000',
      recordedAmount: '500000',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'HELD',
    });

    const idemKey = `idem_ded_${runId}`;
    
    // First call: Deduct 200,000 IQD
    const res1 = await financeService.applyDepositDeduction(
      idemDepositId,
      200000,
      'Appliance cleaning fee',
      { actorUserId: ownerId, actorRole: 'PROPERTY_OWNER', idempotencyKey: idemKey }
    );
    assert.strictEqual(Number(res1.deposit.releasedAmount), 200000);

    // Second call: Same idempotencyKey and amount
    const res2 = await financeService.applyDepositDeduction(
      idemDepositId,
      200000,
      'Appliance cleaning fee',
      { actorUserId: ownerId, actorRole: 'PROPERTY_OWNER', idempotencyKey: idemKey }
    );

    // Assert: Exactly identical journal entry returned and releasedAmount did NOT increment to 400,000
    assert.strictEqual(res2.journalEntry.id, res1.journalEntry.id);
    assert.strictEqual(Number(res2.deposit.releasedAmount), 200000, 'releasedAmount must remain 200,000 (no double deduction)');

    // Verify exactly one journal entry exists with this idempotencyKey
    const matches = await db.select().from(journalEntries).where(eq(journalEntries.idempotencyKey, idemKey));
    assert.strictEqual(matches.length, 1, 'Only one journal entry must be persisted for this idempotency key');
  });

  // --------------------------------------------------------------------------
  // Step 7: Concurrency Race Protection — Concurrent deduction and refund requests serialize safely
  // --------------------------------------------------------------------------
  await t.test('7. Concurrency — Two simultaneous deduction requests competing for remaining balance cannot overdraw', async () => {
    const raceDepositId = `dep_race_${runId}`;
    await db.insert(securityDeposits).values({
      id: raceDepositId,
      leaseId: leaseId,
      propertyId: propId,
      tenantId: tenantId,
      requiredAmount: '400000',
      recordedAmount: '400000',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'HELD',
    });

    // Launch two simultaneous requests that each attempt to deduct 300,000 IQD (Total 600,000 > Held 400,000)
    const results = await Promise.allSettled([
      financeService.applyDepositDeduction(raceDepositId, 300000, 'Concurrent repair A'),
      financeService.applyDepositDeduction(raceDepositId, 300000, 'Concurrent repair B')
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exactly one must succeed (acquiring row lock first) and the other must fail (insufficient remaining held balance)
    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent deduction must succeed');
    assert.strictEqual(rejected.length, 1, 'The competing overdrawing deduction must be rejected');

    const [dep] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, raceDepositId));
    assert.strictEqual(Number(dep.releasedAmount), 300000, 'Deposit releasedAmount must not exceed the single winning deduction');
    assert.strictEqual(dep.status, 'PARTIALLY_REFUNDED');
  });

  // Cleanup
  try {
    const jes = await db.select().from(journalEntries).where(eq(journalEntries.propertyId, propId)).catch(() => []);
    for (const je of jes) {
      await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id)).catch(() => {});
    }
    await db.delete(journalEntries).where(eq(journalEntries.propertyId, propId)).catch(() => {});
    await db.delete(securityDeposits).where(eq(securityDeposits.id, depositId)).catch(() => {});
    await db.delete(leases).where(eq(leases.id, leaseId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
    await db.delete(users).where(inArray(users.id, [ownerId, tenantId])).catch(() => {});
    await db.delete(chartOfAccounts).where(inArray(chartOfAccounts.id, [`coa_1010_${runId}`, `coa_2010_${runId}`, `coa_2100_${runId}`])).catch(() => {});
  } catch {}
});
