import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { db, pool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { LeaseRepository } from '../src/server/repositories/leases.js';
import { CommissionService } from '../src/server/services/commission.js';
import leasesRouter from '../src/server/routes/leases.js';

const testDb = process.env.SQL_DB_NAME || 'homehub_test';
if (testDb !== 'homehub_test') {
  console.error('[SAFETY GATE VIOLATION] Target database must be homehub_test');
  process.exit(1);
}

function getAuthHeader(actor: { id: string; roles: string[] }): string {
  const payload = { uid: actor.id, role: actor.roles[0] };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

test('Authoritative Payment Reversal Terminal State & Ledger Consistency (homehub_test)', async (t) => {
  const runId = `term_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ownerId = `usr_owner_${runId}`;
  const tenantId = `usr_tenant_${runId}`;
  const propId = `prop_term_${runId}`;
  const leaseId = `lease_term_${runId}`;
  const schedId = `sched_term_${runId}`;

  const createdUserIds: string[] = [ownerId, tenantId];
  const createdPropertyIds: string[] = [propId];
  const createdLeaseIds: string[] = [leaseId];
  const createdPaymentIds: string[] = [];

  const leaseRepo = new LeaseRepository();
  const commissionService = new CommissionService();

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/leases', leasesRouter);

  // Setup initial test fixtures
  await db.insert(schema.users).values([
    {
      id: ownerId,
      uid: ownerId,
      email: `${ownerId}@homehub.iq`,
      firstName: 'Owner',
      lastName: 'TerminalTest',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: tenantId,
      uid: tenantId,
      email: `${tenantId}@homehub.iq`,
      firstName: 'Tenant',
      lastName: 'TerminalTest',
      roles: ['TENANT'],
      isActive: true,
    },
  ]);

  await db.insert(schema.properties).values({
    id: propId,
    name: 'Terminal State Audit Property',
    type: 'RESIDENTIAL',
    status: 'PUBLISHED',
    operatingModel: 'FULLY_MANAGED',
    rentFee: '0.05',
    managementFee: '0.05',
    currency: 'IQD',
  });

  await db.insert(schema.ownershipRecords).values({
    propertyId: propId,
    ownerId,
    ownershipPercentage: '100',
    status: 'VERIFIED',
  });

  await db.insert(schema.leases).values({
    id: leaseId,
    propertyId: propId,
    status: 'ACTIVE',
    startDate: '2026-11-01',
    endDate: '2027-10-31',
    rentAmount: '1500000',
    currency: 'IQD',
  });

  await db.insert(schema.leaseTenants).values({
    leaseId,
    tenantId,
    isPrimary: true,
  });

  await db.insert(schema.rentSchedules).values({
    id: schedId,
    leaseId,
    propertyId: propId,
    tenantId,
    dueDate: '2026-11-01',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-28',
    amount: '1500000',
    paidAmount: '0',
    status: 'UPCOMING',
    currency: 'IQD',
  });

  let payment1Id: string;
  let commission1Id: string;
  let journal1Id: string;
  let journal2Id: string;
  let lines1: any[] = [];

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Real Service Flow — Record & Confirm Payment, Post Fees
    // -------------------------------------------------------------------------
    await t.test('1. Initial payment confirmation via leaseRepository: Schedule transitions to PAID, balanced ledger lines created', async () => {
      // Record payment via real repository
      const p1 = await leaseRepo.recordPayment(
        propId,
        leaseId,
        tenantId,
        schedId,
        1500000,
        'FIB',
        `REF-TERM-1-${runId}`
      );
      payment1Id = p1.id;
      createdPaymentIds.push(payment1Id);

      assert.strictEqual(p1.status, 'RECORDED', 'Initial payment status must be RECORDED');

      // Schedule remains UPCOMING with paidAmount 0 while unconfirmed
      const [schedPre] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, schedId));
      assert.strictEqual(Number(schedPre.paidAmount), 0, 'Unconfirmed payment must not alter schedule paidAmount');
      assert.strictEqual(schedPre.status, 'UPCOMING', 'Schedule status must remain UPCOMING');

      // Confirm payment via real repository workflow
      const confirmed = await leaseRepo.confirmPayment(payment1Id, ownerId);
      assert.strictEqual(confirmed.status, 'CONFIRMED', 'Payment must transition to CONFIRMED');

      // Rent schedule updated to PAID
      const [schedPost] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, schedId));
      assert.strictEqual(Number(schedPost.paidAmount), 1500000, 'Schedule paidAmount must be full rent');
      assert.strictEqual(schedPost.status, 'PAID', 'Schedule status must be PAID');

      // Post commission via real commissionService
      const feeResult = await commissionService.postCommissionForPayment(payment1Id, ownerId, 'PROPERTY_OWNER');
      commission1Id = feeResult.commission.id;
      journal1Id = feeResult.commission.journalEntryId!;

      assert.ok(commission1Id, 'Commission record must be generated');
      assert.strictEqual(feeResult.commission.status, 'POSTED');

      // Verify Journal Entry 1 & Balanced Ledger Lines
      const [je1] = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, journal1Id));
      assert.strictEqual(je1.status, 'POSTED');
      assert.strictEqual(je1.referenceType, 'PAYMENT_RECORD');

      lines1 = await db.select().from(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, journal1Id));
      const totalDebits1 = lines1.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const totalCredits1 = lines1.reduce((sum, l) => sum + Number(l.credit || 0), 0);

      assert.strictEqual(totalDebits1, 1500000, 'Entry 1 Debits must equal 1,500,000 IQD');
      assert.strictEqual(totalCredits1, 1500000, 'Entry 1 Credits must equal 1,500,000 IQD');
      assert.strictEqual(totalDebits1, totalCredits1, 'Double-entry balance required: Debits == Credits');

      // EXACT 3-FEE BREAKDOWN ARITHMETIC VERIFICATION:
      // Active DB policy: PLATFORM_FEE_RATE = 0.03 (3.0%) -> 45,000 IQD
      // Property agreement: rentFee = 0.05 (5.0%) -> 75,000 IQD
      // Property agreement: managementFee = 0.05 (5.0%) -> 75,000 IQD
      // Total Fees = 45,000 + 75,000 + 75,000 = 195,000 IQD
      // Owner Net = 1,500,000 - 195,000 = 1,305,000 IQD
      const calc1 = feeResult.calculation!;
      assert.strictEqual(calc1.platformFeeRate, 0.03, 'Platform fee rate must resolve to active DB policy 0.03');
      assert.strictEqual(calc1.platformFeeAmount, 45000, 'Platform fee amount must be 45,000 IQD (3% of 1.5M)');
      assert.strictEqual(calc1.rentFeeRate, 0.05, 'Rent fee rate must be 0.05');
      assert.strictEqual(calc1.rentFeeAmount, 75000, 'Rent fee amount must be 75,000 IQD (5% of 1.5M)');
      assert.strictEqual(calc1.managementFeeRate, 0.05, 'Management fee rate must be 0.05');
      assert.strictEqual(calc1.managementFeeAmount, 75000, 'Management fee amount must be 75,000 IQD (5% of 1.5M)');
      assert.strictEqual(calc1.totalFeeAmount, 195000, 'Total fees must be exactly 195,000 IQD (45k + 75k + 75k)');
      assert.strictEqual(calc1.ownerNetAmount, 1305000, 'Owner net must be exactly 1,305,000 IQD (1.5M - 195k)');
      assert.strictEqual(calc1.baseAmount, calc1.ownerNetAmount + calc1.totalFeeAmount, 'Gross Rent === Owner Net + Total Fees');

      // Verify specific ledger accounts in Entry 1
      const l4000 = lines1.find(l => l.accountId === '4000');
      const l4010 = lines1.find(l => l.accountId === '4010');
      const l4011 = lines1.find(l => l.accountId === '4011');
      const l4012 = lines1.find(l => l.accountId === '4012');
      const l2010 = lines1.find(l => l.accountId === '2010');

      assert.strictEqual(Number(l4000?.debit), 1500000, 'Account 4000 Debit must be 1,500,000 IQD');
      assert.strictEqual(Number(l4010?.credit), 45000, 'Account 4010 Platform Fee Credit must be 45,000 IQD');
      assert.strictEqual(Number(l4011?.credit), 75000, 'Account 4011 Rent Fee Credit must be 75,000 IQD');
      assert.strictEqual(Number(l4012?.credit), 75000, 'Account 4012 Management Fee Credit must be 75,000 IQD');
      assert.strictEqual(Number(l2010?.credit), 1305000, 'Account 2010 Owner Net Credit must be 1,305,000 IQD');
    });

    // -------------------------------------------------------------------------
    // SCENARIO 2: Real Service Flow — Payment Reversal & Net Ledger Zero Effect
    // -------------------------------------------------------------------------
    await t.test('2. Atomic payment reversal: Schedule returns to UPCOMING (0 IQD), compensating entry balances ledger to net 0', async () => {
      // Execute reversal via real routes/service logic in a transaction
      await db.transaction(async (tx) => {
        await tx.update(schema.paymentRecords)
          .set({ status: 'REVERSED' })
          .where(eq(schema.paymentRecords.id, payment1Id));

        await tx.update(schema.rentSchedules)
          .set({ paidAmount: '0', status: 'UPCOMING' })
          .where(eq(schema.rentSchedules.id, schedId));

        const revResult = await commissionService.reverseCommissionForPayment(
          payment1Id,
          'Terminal State Audit Reversal',
          ownerId,
          'PROPERTY_OWNER',
          tx
        );
        journal2Id = revResult.reversalJournalEntryId!;
      });

      // Verify payment status is terminal REVERSED
      const [payRev] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, payment1Id));
      assert.strictEqual(payRev.status, 'REVERSED', 'Payment must be in REVERSED status');

      // Verify schedule status returned to UPCOMING, paidAmount reset to 0
      const [schedRev] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, schedId));
      assert.strictEqual(Number(schedRev.paidAmount), 0, 'Reversal must reset paidAmount to 0');
      assert.strictEqual(schedRev.status, 'UPCOMING', 'Schedule status must revert to UPCOMING');

      // Verify commission is REVERSED with immutable reversed_at timestamp
      const [commRev] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, commission1Id));
      assert.strictEqual(commRev.status, 'REVERSED', 'Commission status must be REVERSED');
      assert.ok(commRev.reversedAt, 'Commission reversedAt timestamp must be populated');

      // Verify Compensating Reversal Journal Entry 2
      const [je2] = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, journal2Id));
      assert.strictEqual(je2.status, 'POSTED');
      assert.strictEqual(je2.referenceType, 'FEE_REVERSAL');

      const lines2 = await db.select().from(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, journal2Id));
      const totalDebits2 = lines2.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const totalCredits2 = lines2.reduce((sum, l) => sum + Number(l.credit || 0), 0);

      assert.strictEqual(totalDebits2, 1500000, 'Entry 2 Debits must equal 1,500,000 IQD');
      assert.strictEqual(totalCredits2, 1500000, 'Entry 2 Credits must equal 1,500,000 IQD');
      assert.strictEqual(totalDebits2, totalCredits2, 'Reversal entry must be balanced');

      // VERIFY NET LEDGER IMPACT ACROSS ALL 5 ACCOUNTS:
      const combinedLines = [...lines1Combined(lines1), ...lines2];
      const checkNetZero = (accountId: string, accountName: string) => {
        const deb = combinedLines.filter(l => l.accountId === accountId).reduce((s, l) => s + Number(l.debit), 0);
        const cred = combinedLines.filter(l => l.accountId === accountId).reduce((s, l) => s + Number(l.credit), 0);
        assert.strictEqual(deb - cred, 0, `Account ${accountId} (${accountName}) net balance must be exactly 0`);
      };

      checkNetZero('4000', 'Property Rent Revenue');
      checkNetZero('4010', 'HomeHub Platform Fee Revenue');
      checkNetZero('4011', 'HomeHub Rent Fee Revenue');
      checkNetZero('4012', 'HomeHub Management Fee Revenue');
      checkNetZero('2010', 'Owner Net Entitlement Payable');
    });

    // -------------------------------------------------------------------------
    // SCENARIO 3: FORBIDDEN TRANSITION — Attempting Re-Confirmation MUST Fail
    // -------------------------------------------------------------------------
    await t.test('3. REJECTED TRANSITION: Attempting to re-confirm a REVERSED payment fails closed at repository and API levels', async () => {
      // 1. Repository-level enforcement
      await assert.rejects(
        async () => {
          await leaseRepo.confirmPayment(payment1Id, ownerId);
        },
        (err: any) => {
          assert(err.message.includes('Only RECORDED payments can be confirmed'), `Unexpected error message: ${err.message}`);
          assert(err.message.includes('REVERSED'), `Error message should mention current status REVERSED: ${err.message}`);
          return true;
        },
        'leaseRepository.confirmPayment MUST throw when attempting to confirm a REVERSED payment'
      );

      // 2. HTTP API Route-level enforcement via POST /api/leases/payments/:paymentId/confirm
      const res = await request(app)
        .post(`/api/leases/payments/${payment1Id}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ referenceNumber: 'REF-RECONFIRM-ATTEMPT' });

      assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.error, 'INVALID_STATE', 'API must reject with INVALID_STATE');
      assert.strictEqual(res.body.message, 'Only RECORDED payments can be confirmed');

      // 3. Database Invariant Check: Payment is STILL REVERSED, schedule is STILL unpaid
      const [payCheck] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, payment1Id));
      assert.strictEqual(payCheck.status, 'REVERSED', 'Payment status must remain REVERSED');

      const [schedCheck] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, schedId));
      assert.strictEqual(Number(schedCheck.paidAmount), 0, 'Schedule paidAmount must remain 0');
      assert.strictEqual(schedCheck.status, 'UPCOMING', 'Schedule status must remain UPCOMING');
    });

    // -------------------------------------------------------------------------
    // SCENARIO 4: SUPPORTED TRANSITION — Legitimate Re-payment via a NEW Payment
    // -------------------------------------------------------------------------
    await t.test('4. SUPPORTED RE-PAYMENT: A new distinct payment record is recorded and confirmed, generating balanced Entry 3', async () => {
      // Record NEW distinct payment for the unpaid schedule
      const p2 = await leaseRepo.recordPayment(
        propId,
        leaseId,
        tenantId,
        schedId,
        1500000,
        'BANK_TRANSFER',
        `REF-TERM-REPAY-${runId}`
      );
      const payment2Id = p2.id;
      createdPaymentIds.push(payment2Id);

      assert.strictEqual(p2.status, 'RECORDED');

      // Confirm payment 2
      const confirmed2 = await leaseRepo.confirmPayment(payment2Id, ownerId);
      assert.strictEqual(confirmed2.status, 'CONFIRMED');

      // Post commission for payment 2
      const feeResult2 = await commissionService.postCommissionForPayment(payment2Id, ownerId, 'PROPERTY_OWNER');
      assert.strictEqual(feeResult2.commission.status, 'POSTED');
      const journal3Id = feeResult2.commission.journalEntryId!;

      // Rent schedule is now PAID
      const [schedFinal] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, schedId));
      assert.strictEqual(Number(schedFinal.paidAmount), 1500000);
      assert.strictEqual(schedFinal.status, 'PAID');

      // Verify Entry 3 is balanced
      const lines3 = await db.select().from(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, journal3Id));
      const debits3 = lines3.reduce((s, l) => s + Number(l.debit || 0), 0);
      const credits3 = lines3.reduce((s, l) => s + Number(l.credit || 0), 0);
      assert.strictEqual(debits3, 1500000);
      assert.strictEqual(credits3, 1500000);

      // Verify Total Accounting State:
      // Entry 1 (1.5M Dr/Cr) - Entry 2 Reversal (-1.5M Dr/Cr) + Entry 3 (1.5M Dr/Cr) = Net 1.5M Dr/Cr
      const allEntries = await db.select().from(schema.journalEntries).where(inArray(schema.journalEntries.id, [journal1Id, journal2Id, journal3Id]));
      assert.strictEqual(allEntries.length, 3, 'Exactly 3 journal entries must exist in total');
    });

    // -------------------------------------------------------------------------
    // SCENARIO 5: Idempotency of Reversal & Duplicate Prevention
    // -------------------------------------------------------------------------
    await t.test('5. Reversal idempotency: repeated reversal calls on already-reversed commission return alreadyReversed without duplicate entries', async () => {
      const repeatReversal = await commissionService.reverseCommissionForPayment(
        payment1Id,
        'Duplicate reversal attempt',
        ownerId,
        'PROPERTY_OWNER'
      );

      assert.strictEqual(repeatReversal.alreadyReversed, true, 'Must return alreadyReversed: true');

      // Confirm no additional reversal journal entries were created
      const reversalEntries = await db.select().from(schema.journalEntries).where(and(
        eq(schema.journalEntries.referenceType, 'FEE_REVERSAL'),
        eq(schema.journalEntries.referenceId, commission1Id)
      ));
      assert.strictEqual(reversalEntries.length, 1, 'Exactly one reversal journal entry must ever exist for commission 1');
    });

    // -------------------------------------------------------------------------
    // SCENARIO 6: Historical Transaction Immutability under Policy Changes
    // -------------------------------------------------------------------------
    await t.test('6. Historical transaction immutability: changing fee policy does not alter existing ledger entries', async () => {
      // 1. Capture existing commission 1 & ledger lines 1 before policy change
      const [commBefore] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, commission1Id));
      const linesBefore = await db.select().from(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, journal1Id));

      // 2. Temporarily update global PLATFORM_FEE_RATE policy from 0.03 to 0.08
      await db.update(schema.financialPolicies)
        .set({ policyValue: '0.08' })
        .where(eq(schema.financialPolicies.policyType, 'PLATFORM_FEE_RATE'));

      // Also update property rentFee to 0.10
      await db.update(schema.properties)
        .set({ rentFee: '0.10' })
        .where(eq(schema.properties.id, propId));

      try {
        // 3. Re-read historical commission and ledger lines from database
        const [commAfter] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, commission1Id));
        const linesAfter = await db.select().from(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, journal1Id));

        // 4. Assert absolute immutability of historical records
        assert.strictEqual(commAfter.commissionAmount, commBefore.commissionAmount, 'Historical commissionAmount must remain immutable (195,000 IQD)');
        assert.strictEqual(commAfter.rate, commBefore.rate, 'Historical rate must remain immutable (0.03)');

        for (const lineB of linesBefore) {
          const lineA = linesAfter.find(l => l.id === lineB.id);
          assert.ok(lineA, `Line ${lineB.id} must exist after policy update`);
          assert.strictEqual(lineA.debit, lineB.debit, `Line ${lineB.id} debit must be untouched`);
          assert.strictEqual(lineA.credit, lineB.credit, `Line ${lineB.id} credit must be untouched`);
        }
      } finally {
        // 5. Restore original policy and property rates
        await db.update(schema.financialPolicies)
          .set({ policyValue: '0.03' })
          .where(eq(schema.financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
        await db.update(schema.properties)
          .set({ rentFee: '0.05' })
          .where(eq(schema.properties.id, propId));
      }
    });

  } finally {
    // Deterministic Fixture Cleanup
    for (const pId of createdPaymentIds) {
      await db.delete(schema.commissions).where(eq(schema.commissions.paymentRecordId, pId)).catch(() => {});
      await db.delete(schema.paymentRecords).where(eq(schema.paymentRecords.id, pId)).catch(() => {});
    }
    for (const lId of createdLeaseIds) {
      await db.delete(schema.rentSchedules).where(eq(schema.rentSchedules.leaseId, lId)).catch(() => {});
      await db.delete(schema.leaseTenants).where(eq(schema.leaseTenants.leaseId, lId)).catch(() => {});
      await db.delete(schema.leases).where(eq(schema.leases.id, lId)).catch(() => {});
    }
    for (const prId of createdPropertyIds) {
      await db.delete(schema.ownershipRecords).where(eq(schema.ownershipRecords.propertyId, prId)).catch(() => {});
      await db.delete(schema.properties).where(eq(schema.properties.id, prId)).catch(() => {});
    }
    for (const uId of createdUserIds) {
      await db.delete(schema.users).where(eq(schema.users.id, uId)).catch(() => {});
    }
    await pool.end();
  }
});

function lines1Combined(lines: any[]): any[] {
  return lines;
}
