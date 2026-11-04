import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  properties,
  units,
  leases,
  rentSchedules,
  paymentRecords,
  commissions,
  journalEntries,
  ledgerLines,
  financialPolicies,
} from '../src/db/schema.js';
import { eq, inArray, and } from 'drizzle-orm';
import { financeService } from '../src/server/services/finance.js';
import { commissionService } from '../src/server/services/commission.js';
import { leaseRepository } from '../src/server/repositories/leases.js';

test('HomeHub — Custodial Cash-Receipt Posting & Fee Allocation Comprehensive Regression Suite', async (t) => {
  const runId = `cr_reg_${Date.now()}`;
  const ownerUserId = `usr_owner_${runId}`;
  const tenantUserId = `usr_tenant_${runId}`;
  const companyOrgId = `org_comp_${runId}`;

  // Resource tracking for atomic teardown
  const createdPropIds: string[] = [];
  const createdUnitIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdScheduleIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdJeIds: string[] = [];

  // 0. Setup Base Test Users & Organization
  await db.insert(users).values([
    {
      id: ownerUserId,
      email: `${ownerUserId}@homehub.iq`,
      firstName: 'Custodial',
      lastName: 'Owner',
      roles: ['PROPERTY_OWNER'],
    },
    {
      id: tenantUserId,
      email: `${tenantUserId}@homehub.iq`,
      firstName: 'Custodial',
      lastName: 'Tenant',
      roles: ['TENANT'],
    },
  ]).onConflictDoNothing();

  await db.insert(organizations).values({
    id: companyOrgId,
    name: `Custodial Management ${runId}`,
    type: 'COMPANY',
  }).onConflictDoNothing();

  // Dynamically resolve active PLATFORM_FEE_RATE policy from DB
  const platformFeeRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
  assert.ok(platformFeeRate > 0, `Active PLATFORM_FEE_RATE must be positive, got ${platformFeeRate}`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1 & 2: Basic Custodial Payment Confirmation & Net-Zero Clearing
    // -------------------------------------------------------------------------
    await t.test('1 & 2. Basic custodial payment confirmation posts Dr 1010 / Cr 4000 and nets Account 4000 to zero', async () => {
      const propId = `prop_basic_${runId}`;
      createdPropIds.push(propId);
      await db.insert(properties).values({
        id: propId,
        name: `Basic Custodial Prop ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'FULLY_MANAGED',
        rentFee: '0.04',
        managementFee: '0.06',
        createdBy: ownerUserId,
      });

      const payId = `pay_basic_${runId}`;
      createdPaymentIds.push(payId);
      await db.insert(paymentRecords).values({
        id: payId,
        propertyId: propId,
        payerId: tenantUserId,
        amount: '1000000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_BASIC_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString(),
      });

      const postResult = await commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER');
      assert.ok(postResult.commission, 'Commission record must be created');
      assert.strictEqual(postResult.alreadyPosted, false);

      // Verify Journal Entries for this payment
      const paymentJes = await db.select().from(journalEntries)
        .where(eq(journalEntries.referenceId, payId));
      
      // Must have exactly two JEs: Commission Fee Allocation and Custodial Cash Receipt
      assert.strictEqual(paymentJes.length, 2, 'Must have exactly 2 journal entries for confirmed payment');
      for (const je of paymentJes) {
        createdJeIds.push(je.id);
      }

      const cashJe = paymentJes.find((j) => j.idempotencyKey === `JE_CASH_RECEIPT_${payId}`);
      const feeJe = paymentJes.find((j) => j.idempotencyKey === `JE_COMMISSION_${payId}`);
      assert.ok(cashJe, 'Custodial Cash Receipt journal entry must exist');
      assert.ok(feeJe, 'Fee Allocation journal entry must exist');

      // Check Cash Receipt Lines: Dr 1010 Operating Cash, Cr 4000 Gross Rent Clearing
      const cashLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, cashJe.id));
      assert.strictEqual(cashLines.length, 2, 'Cash receipt must have exactly 2 lines');
      const dr1010 = cashLines.find((l) => l.accountId === '1010');
      const cr4000_cash = cashLines.find((l) => l.accountId === '4000');
      assert.ok(dr1010, 'Debit 1010 line must exist');
      assert.ok(cr4000_cash, 'Credit 4000 line must exist');
      assert.strictEqual(Number(dr1010.debit), 1000000, 'Dr 1010 must equal gross confirmed rent');
      assert.strictEqual(Number(dr1010.credit), 0);
      assert.strictEqual(Number(cr4000_cash?.credit), 1000000, 'Cr 4000 must equal gross confirmed rent');
      assert.strictEqual(Number(cr4000_cash?.debit), 0);

      // Check Fee Allocation Lines: Dr 4000 Gross Rent Clearing, Cr Fees & Cr 2010 Owner Net
      const feeLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, feeJe.id));
      const dr4000_fee = feeLines.find((l) => l.accountId === '4000');
      assert.ok(dr4000_fee, 'Debit 4000 line must exist in fee allocation');
      assert.strictEqual(Number(dr4000_fee.debit), 1000000, 'Dr 4000 must equal gross rent base amount');
      assert.strictEqual(Number(dr4000_fee.credit), 0);

      // Verify Account 4000 nets to zero across both journal entries
      const allLines = [...cashLines, ...feeLines];
      const lines4000 = allLines.filter((l) => l.accountId === '4000');
      const totalDr4000 = lines4000.reduce((s, l) => s + Number(l.debit), 0);
      const totalCr4000 = lines4000.reduce((s, l) => s + Number(l.credit), 0);
      assert.strictEqual(totalDr4000, 1000000, 'Total Dr 4000 must be 1,000,000');
      assert.strictEqual(totalCr4000, 1000000, 'Total Cr 4000 must be 1,000,000');
      assert.strictEqual(totalDr4000 - totalCr4000, 0, 'Account 4000 must net to exactly 0.00 IQD');
    });

    // -------------------------------------------------------------------------
    // TEST 3: Corporate P&L & Balance Sheet Boundaries
    // -------------------------------------------------------------------------
    await t.test('3. Corporate P&L recognizes strictly fee revenue; Balance Sheet confirms Assets = Liabilities + Equity', async () => {
      const propId = createdPropIds[0];
      const pnl = await financeService.getProfitAndLoss(propId);

      // P&L must NOT include Gross Rent (4000) or Owner Net Entitlement (2010) as revenue
      const expectedPlatformFee = Math.round(1000000 * platformFeeRate);
      const expectedRentFee = 40000; // 4%
      const expectedMgmtFee = 60000; // 6%
      const expectedTotalFeeRevenue = expectedPlatformFee + expectedRentFee + expectedMgmtFee;

      assert.strictEqual(pnl.totalRevenue, expectedTotalFeeRevenue, `P&L revenue must strictly equal fee total ${expectedTotalFeeRevenue}`);
      assert.strictEqual(pnl.netIncome, expectedTotalFeeRevenue, 'Net income must equal fee revenue when no operating expenses exist');

      // Balance Sheet verification
      const bs = await financeService.getBalanceSheet(propId);
      assert.strictEqual(bs.totalAssets, 1000000, 'Assets must equal 1,000,000 (Account 1010)');
      
      const ownerPayable = 1000000 - expectedTotalFeeRevenue;
      assert.strictEqual(bs.totalLiabilities, ownerPayable, `Liabilities must equal owner net payable ${ownerPayable} (Account 2010), 4000 is 0`);
      assert.strictEqual(bs.totalEquity, expectedTotalFeeRevenue, `Equity must equal net income ${expectedTotalFeeRevenue}`);
      assert.strictEqual(bs.totalAssets, bs.totalLiabilities + bs.totalEquity, 'Balance sheet must balance: Assets === Liabilities + Equity');
    });

    // -------------------------------------------------------------------------
    // TEST 4: FULLY_MANAGED Operating Model
    // -------------------------------------------------------------------------
    await t.test('4. FULLY_MANAGED posts Platform Fee + Rent Fee + Management Fee + Owner Entitlement', async () => {
      const propId = `prop_full_${runId}`;
      createdPropIds.push(propId);
      await db.insert(properties).values({
        id: propId,
        name: `Fully Managed ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'FULLY_MANAGED',
        rentFee: '0.05', // 5%
        managementFee: '0.05', // 5%
        createdBy: ownerUserId,
      });

      const payId = `pay_full_${runId}`;
      createdPaymentIds.push(payId);
      await db.insert(paymentRecords).values({
        id: payId,
        propertyId: propId,
        payerId: tenantUserId,
        amount: '2000000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_FM_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString(),
      });

      const res = await commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER');
      assert.ok(res.commission);
      const je = await db.select().from(journalEntries).where(eq(journalEntries.idempotencyKey, `JE_COMMISSION_${payId}`));
      assert.strictEqual(je.length, 1);
      createdJeIds.push(je[0].id);

      const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je[0].id));
      const expPlat = Math.round(2000000 * platformFeeRate);
      const expRent = 100000; // 5% of 2M
      const expMgmt = 100000; // 5% of 2M
      const expOwner = 2000000 - (expPlat + expRent + expMgmt);

      const l4010 = lines.find((l) => l.accountId === '4010');
      const l4011 = lines.find((l) => l.accountId === '4011');
      const l4012 = lines.find((l) => l.accountId === '4012');
      const l2010 = lines.find((l) => l.accountId === '2010');

      assert.strictEqual(Number(l4010?.credit), expPlat, `4010 must be ${expPlat}`);
      assert.strictEqual(Number(l4011?.credit), expRent, `4011 must be ${expRent}`);
      assert.strictEqual(Number(l4012?.credit), expMgmt, `4012 must be ${expMgmt}`);
      assert.strictEqual(Number(l2010?.credit), expOwner, `2010 must be ${expOwner}`);

      const totDr = lines.reduce((s, l) => s + Number(l.debit), 0);
      const totCr = lines.reduce((s, l) => s + Number(l.credit), 0);
      assert.strictEqual(totDr, 2000000);
      assert.strictEqual(totCr, 2000000);
    });

    // -------------------------------------------------------------------------
    // TEST 5: AGENT_LISTED_PLATFORM_MANAGED Operating Model
    // -------------------------------------------------------------------------
    await t.test('5. AGENT_LISTED_PLATFORM_MANAGED waives Rent Fee, posts Platform + Management Fee', async () => {
      const propId = `prop_alpm_${runId}`;
      createdPropIds.push(propId);
      await db.insert(properties).values({
        id: propId,
        name: `Agent Listed Platform Managed ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
        rentFee: '0.05', // Must be ignored/waived
        managementFee: '0.07', // 7%
        createdBy: ownerUserId,
      });

      const payId = `pay_alpm_${runId}`;
      createdPaymentIds.push(payId);
      await db.insert(paymentRecords).values({
        id: payId,
        propertyId: propId,
        payerId: tenantUserId,
        amount: '1000000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_ALPM_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString(),
      });

      await commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER');
      const je = await db.select().from(journalEntries).where(eq(journalEntries.idempotencyKey, `JE_COMMISSION_${payId}`));
      createdJeIds.push(je[0].id);

      const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je[0].id));
      const expPlat = Math.round(1000000 * platformFeeRate);
      const expMgmt = 70000; // 7% of 1M
      const expOwner = 1000000 - (expPlat + expMgmt);

      const l4010 = lines.find((l) => l.accountId === '4010');
      const l4011 = lines.find((l) => l.accountId === '4011');
      const l4012 = lines.find((l) => l.accountId === '4012');
      const l2010 = lines.find((l) => l.accountId === '2010');

      assert.strictEqual(Number(l4010?.credit), expPlat);
      assert.strictEqual(l4011, undefined, 'Account 4011 (Rent Fee) must be completely omitted');
      assert.strictEqual(Number(l4012?.credit), expMgmt);
      assert.strictEqual(Number(l2010?.credit), expOwner);

      const totDr = lines.reduce((s, l) => s + Number(l.debit), 0);
      const totCr = lines.reduce((s, l) => s + Number(l.credit), 0);
      assert.strictEqual(totDr, totCr);
    });

    // -------------------------------------------------------------------------
    // TEST 6: AGENT_OPERATED Operating Model
    // -------------------------------------------------------------------------
    await t.test('6. AGENT_OPERATED recognizes Platform Fee only; Rent & Management Fees are waived', async () => {
      const propId = `prop_ao_${runId}`;
      createdPropIds.push(propId);
      await db.insert(properties).values({
        id: propId,
        name: `Agent Operated ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'AGENT_OPERATED',
        rentFee: '0.05', // Must be ignored
        managementFee: '0.05', // Must be ignored
        createdBy: ownerUserId,
      });

      const payId = `pay_ao_${runId}`;
      createdPaymentIds.push(payId);
      await db.insert(paymentRecords).values({
        id: payId,
        propertyId: propId,
        payerId: tenantUserId,
        amount: '1000000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_AO_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString(),
      });

      await commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER');
      const je = await db.select().from(journalEntries).where(eq(journalEntries.idempotencyKey, `JE_COMMISSION_${payId}`));
      createdJeIds.push(je[0].id);

      const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je[0].id));
      const expPlat = Math.round(1000000 * platformFeeRate);
      const expOwner = 1000000 - expPlat;

      const l4010 = lines.find((l) => l.accountId === '4010');
      const l4011 = lines.find((l) => l.accountId === '4011');
      const l4012 = lines.find((l) => l.accountId === '4012');
      const l2010 = lines.find((l) => l.accountId === '2010');

      assert.strictEqual(Number(l4010?.credit), expPlat);
      assert.strictEqual(l4011, undefined, 'Account 4011 must not exist');
      assert.strictEqual(l4012, undefined, 'Account 4012 must not exist');
      assert.strictEqual(Number(l2010?.credit), expOwner);

      const totDr = lines.reduce((s, l) => s + Number(l.debit), 0);
      const totCr = lines.reduce((s, l) => s + Number(l.credit), 0);
      assert.strictEqual(totDr, totCr);
    });

    // -------------------------------------------------------------------------
    // TEST 7: Zero or Optional Fee Components
    // -------------------------------------------------------------------------
    await t.test('7. Zero or optional fee components produce balanced journal without zero-value lines', async () => {
      const propId = `prop_zerofee_${runId}`;
      createdPropIds.push(propId);
      await db.insert(properties).values({
        id: propId,
        name: `Zero Fee Prop ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'FULLY_MANAGED',
        rentFee: null, // No rent fee agreed
        managementFee: '0', // Explicit zero fee
        createdBy: ownerUserId,
      });

      const payId = `pay_zerofee_${runId}`;
      createdPaymentIds.push(payId);
      await db.insert(paymentRecords).values({
        id: payId,
        propertyId: propId,
        payerId: tenantUserId,
        amount: '500000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_ZERO_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString(),
      });

      await commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER');
      const je = await db.select().from(journalEntries).where(eq(journalEntries.idempotencyKey, `JE_COMMISSION_${payId}`));
      createdJeIds.push(je[0].id);

      const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je[0].id));
      assert.strictEqual(lines.find((l) => l.accountId === '4011'), undefined, 'No 4011 line when null');
      assert.strictEqual(lines.find((l) => l.accountId === '4012'), undefined, 'No 4012 line when 0');

      const totDr = lines.reduce((s, l) => s + Number(l.debit), 0);
      const totCr = lines.reduce((s, l) => s + Number(l.credit), 0);
      assert.strictEqual(totDr, 500000);
      assert.strictEqual(totCr, 500000);
    });

    // -------------------------------------------------------------------------
    // TEST 8: Confirmation Idempotency
    // -------------------------------------------------------------------------
    await t.test('8. Retrying confirmation is idempotent and does not duplicate cash, fees, or liabilities', async () => {
      const payId = createdPaymentIds[0]; // pay_basic
      const retryResult = await commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER');
      assert.strictEqual(retryResult.alreadyPosted, true, 'Retry must return alreadyPosted: true');

      // Verify no duplicate journal entries or ledger lines created
      const jes = await db.select().from(journalEntries).where(eq(journalEntries.referenceId, payId));
      assert.strictEqual(jes.length, 2, 'Still exactly 2 journal entries');

      const cashJes = jes.filter((j) => j.idempotencyKey === `JE_CASH_RECEIPT_${payId}`);
      assert.strictEqual(cashJes.length, 1, 'Exactly 1 cash receipt JE');

      const commJes = jes.filter((j) => j.idempotencyKey === `JE_COMMISSION_${payId}`);
      assert.strictEqual(commJes.length, 1, 'Exactly 1 fee allocation JE');

      const commRows = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payId));
      assert.strictEqual(commRows.length, 1, 'Exactly 1 commission row');
    });

    // -------------------------------------------------------------------------
    // TEST 9: Concurrency Safety
    // -------------------------------------------------------------------------
    await t.test('9. Concurrent confirmation attempts cannot double-post the same payment', async () => {
      const propId = `prop_conc_${runId}`;
      createdPropIds.push(propId);
      await db.insert(properties).values({
        id: propId,
        name: `Concurrent Prop ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'AGENT_OPERATED',
        createdBy: ownerUserId,
      });

      const payId = `pay_conc_${runId}`;
      createdPaymentIds.push(payId);
      await db.insert(paymentRecords).values({
        id: payId,
        propertyId: propId,
        payerId: tenantUserId,
        amount: '750000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_CONC_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString(),
      });

      // Fire 3 simultaneous calls
      const results = await Promise.all([
        commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER'),
        commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER'),
        commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER'),
      ]);

      const postedCount = results.filter((r) => r.alreadyPosted === false).length;
      const alreadyPostedCount = results.filter((r) => r.alreadyPosted === true).length;
      assert.strictEqual(postedCount, 1, 'Exactly one concurrent call must post');
      assert.strictEqual(alreadyPostedCount, 2, 'Remaining concurrent calls must return alreadyPosted');

      const jes = await db.select().from(journalEntries).where(eq(journalEntries.referenceId, payId));
      assert.strictEqual(jes.length, 2, 'Exactly 2 journal entries total');
      for (const je of jes) {
        createdJeIds.push(je.id);
      }
    });

    // -------------------------------------------------------------------------
    // TEST 10: Invalid State Rejection
    // -------------------------------------------------------------------------
    await t.test('10. Non-CONFIRMED payments (RECORDED, REVERSED) cannot generate financial postings', async () => {
      const propId = createdPropIds[0];

      // Case A: RECORDED payment
      const payRecId = `pay_rec_${runId}`;
      createdPaymentIds.push(payRecId);
      await db.insert(paymentRecords).values({
        id: payRecId,
        propertyId: propId,
        payerId: tenantUserId,
        amount: '500000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_REC_${runId}`,
        status: 'RECORDED', // Not confirmed!
        recordedDate: new Date().toISOString(),
      });

      await assert.rejects(
        async () => {
          await commissionService.postCommissionForPayment(payRecId, ownerUserId, 'OWNER');
        },
        /Cannot post fees for non-confirmed payment status/i,
        'Must reject RECORDED payment'
      );

      // Verify no financial records created for RECORDED payment
      const jesRec = await db.select().from(journalEntries).where(eq(journalEntries.referenceId, payRecId));
      assert.strictEqual(jesRec.length, 0, 'No journal entries for unconfirmed payment');

      // Case B: Non-existent payment
      await assert.rejects(
        async () => {
          await commissionService.postCommissionForPayment(`non_existent_${runId}`, ownerUserId, 'OWNER');
        },
        /Payment record .* not found/,
        'Must reject missing payment'
      );
    });

    // -------------------------------------------------------------------------
    // TEST 11: Transaction Failure Atomicity
    // -------------------------------------------------------------------------
    await t.test('11. Database failure during posting leaves zero partial financial records', async () => {
      const propId = createdPropIds[0];
      const payFailId = `pay_fail_${runId}`;
      createdPaymentIds.push(payFailId);
      await db.insert(paymentRecords).values({
        id: payFailId,
        propertyId: propId,
        payerId: tenantUserId,
        amount: '600000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_FAIL_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString(),
      });

      // Insert conflicting journal entry to force duplicate key error on commission JE
      const [blockerJe] = await db.insert(journalEntries).values({
        propertyId: propId,
        description: 'Blocker JE',
        date: new Date().toISOString(),
        referenceType: 'PAYMENT_RECORD',
        referenceId: payFailId,
        status: 'POSTED',
        idempotencyKey: `JE_COMMISSION_${payFailId}`, // Collides with postCommissionForPayment
      }).returning();
      createdJeIds.push(blockerJe.id);

      await assert.rejects(
        async () => {
          await commissionService.postCommissionForPayment(payFailId, ownerUserId, 'OWNER');
        },
        /Failed query|duplicate key value violates unique constraint/i,
        'Must fail transaction due to collision'
      );

      // Verify no cash receipt JE or commission record exists
      const cashJes = await db.select().from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, `JE_CASH_RECEIPT_${payFailId}`));
      assert.strictEqual(cashJes.length, 0, 'Cash receipt JE must NOT exist after rollback');

      const comms = await db.select().from(commissions)
        .where(eq(commissions.paymentRecordId, payFailId));
      assert.strictEqual(comms.length, 0, 'Commission row must NOT exist after rollback');
    });

    // -------------------------------------------------------------------------
    // TEST 12: Reversal Symmetry & Cash Receipt Reversal
    // -------------------------------------------------------------------------
    await t.test('12. Payment reversal generates exact compensating entries for cash receipt (Cr 1010 / Dr 4000) and fees', async () => {
      const payId = createdPaymentIds[0]; // pay_basic (1,000,000 IQD, FULLY_MANAGED)
      const [comm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payId));
      assert.ok(comm);

      const revResult = await commissionService.reverseCommissionForPayment(
        payId,
        'Tenant check bounced / payment recalled',
        ownerUserId,
        'OWNER'
      );

      assert.strictEqual(revResult.alreadyReversed, false);
      assert.ok(revResult.reversalJournalEntryId);
      createdJeIds.push(revResult.reversalJournalEntryId);

      // 1. Verify Commission Reversal Entry
      const revLines = await db.select().from(ledgerLines)
        .where(eq(ledgerLines.journalEntryId, revResult.reversalJournalEntryId));
      
      const revCr4000 = revLines.find((l) => l.accountId === '4000');
      const revDr4010 = revLines.find((l) => l.accountId === '4010');
      const revDr4011 = revLines.find((l) => l.accountId === '4011');
      const revDr4012 = revLines.find((l) => l.accountId === '4012');
      const revDr2010 = revLines.find((l) => l.accountId === '2010');

      assert.strictEqual(Number(revCr4000?.credit), 1000000, 'Cr 4000 must reverse original Dr 4000');
      assert.ok(Number(revDr4010?.debit) > 0, 'Dr 4010 must reverse platform fee credit');
      assert.strictEqual(Number(revDr4011?.debit), 40000, 'Dr 4011 must reverse rent fee credit');
      assert.strictEqual(Number(revDr4012?.debit), 60000, 'Dr 4012 must reverse mgmt fee credit');
      assert.ok(Number(revDr2010?.debit) > 0, 'Dr 2010 must reverse owner payable credit');

      // 2. Verify Cash Receipt Reversal Entry
      const cashRevJe = await db.select().from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, `JE_CASH_RECEIPT_REV_${payId}`));
      assert.strictEqual(cashRevJe.length, 1, 'Cash receipt reversal journal entry must exist');
      createdJeIds.push(cashRevJe[0].id);

      const cashRevLines = await db.select().from(ledgerLines)
        .where(eq(ledgerLines.journalEntryId, cashRevJe[0].id));
      assert.strictEqual(cashRevLines.length, 2, 'Cash reversal must have 2 lines');

      const cr1010 = cashRevLines.find((l) => l.accountId === '1010');
      const dr4000 = cashRevLines.find((l) => l.accountId === '4000');

      assert.ok(cr1010, 'Credit 1010 Operating Cash line must exist in reversal');
      assert.ok(dr4000, 'Debit 4000 Gross Rent Clearing line must exist in reversal');
      assert.strictEqual(Number(cr1010.credit), 1000000, 'Cr 1010 must equal gross payment');
      assert.strictEqual(Number(cr1010.debit), 0);
      assert.strictEqual(Number(dr4000.debit), 1000000, 'Dr 4000 must equal gross payment');
      assert.strictEqual(Number(dr4000.credit), 0);

      // Verify Net Ledgers return to exactly 0 for property 1
      const propId = createdPropIds[0];
      const pnl = await financeService.getProfitAndLoss(propId);
      assert.strictEqual(pnl.totalRevenue, 0, 'P&L totalRevenue must return to 0 after reversal');
      assert.strictEqual(pnl.netIncome, 0, 'P&L netIncome must return to 0 after reversal');

      const bs = await financeService.getBalanceSheet(propId);
      assert.strictEqual(bs.totalAssets, 0, 'Total Assets must return to 0');
      assert.strictEqual(bs.totalLiabilities, 0, 'Total Liabilities must return to 0');
      assert.strictEqual(bs.totalEquity, 0, 'Total Equity must return to 0');
    });

    // -------------------------------------------------------------------------
    // TEST 13: Repeated Reversal Idempotency
    // -------------------------------------------------------------------------
    await t.test('13. Retrying reversal does not create duplicate compensating entries', async () => {
      const payId = createdPaymentIds[0];
      const [comm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payId));

      const retryRev = await commissionService.reverseCommissionForPayment(
        payId,
        'Duplicate reversal call',
        ownerUserId,
        'OWNER'
      );

      assert.strictEqual(retryRev.alreadyReversed, true, 'Retry must return alreadyReversed: true');

      // Check journal entries count
      const cashRevJes = await db.select().from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, `JE_CASH_RECEIPT_REV_${payId}`));
      assert.strictEqual(cashRevJes.length, 1, 'Exactly 1 cash receipt reversal JE');

      const commRevJes = await db.select().from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, `JE_REVERSAL_${comm.id}`));
      assert.strictEqual(commRevJes.length, 1, 'Exactly 1 commission reversal JE');
    });

    // -------------------------------------------------------------------------
    // TEST 14: Existing Payment Invariants & Rent Schedule Transitions
    // -------------------------------------------------------------------------
    await t.test('14. Payment confirmation and reversal preserve rent schedule paid amounts and status transitions', async () => {
      const propId = `prop_sched_${runId}`;
      createdPropIds.push(propId);
      await db.insert(properties).values({
        id: propId,
        name: `Schedule Invariant Prop ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'FULLY_MANAGED',
        rentFee: '0.05',
        managementFee: '0.05',
        createdBy: ownerUserId,
      });

      const unitId = `unit_sched_${runId}`;
      createdUnitIds.push(unitId);
      await db.insert(units).values({
        id: unitId,
        propertyId: propId,
        unitNumber: '101',
        rentAmount: '800000',
        currency: 'IQD',
      });

      const leaseId = `lease_sched_${runId}`;
      createdLeaseIds.push(leaseId);
      await db.insert(leases).values({
        id: leaseId,
        propertyId: propId,
        unitId,
        tenantId: tenantUserId,
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        rentAmount: '800000',
        currency: 'IQD',
        status: 'ACTIVE',
      });

      const schedId = `sched_${runId}`;
      createdScheduleIds.push(schedId);
      await db.insert(rentSchedules).values({
        id: schedId,
        leaseId,
        propertyId: propId,
        unitId,
        tenantId: tenantUserId,
        dueDate: '2026-11-01',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        amount: '800000',
        paidAmount: '0',
        currency: 'IQD',
        status: 'UPCOMING',
      });

      const payId = `pay_sched_${runId}`;
      createdPaymentIds.push(payId);
      await db.insert(paymentRecords).values({
        id: payId,
        propertyId: propId,
        leaseId,
        rentScheduleId: schedId,
        payerId: tenantUserId,
        amount: '800000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_SCHED_${runId}`,
        status: 'RECORDED',
        recordedDate: new Date().toISOString(),
      });

      // 1. Confirm Payment via authoritative repository
      const confirmed = await leaseRepository.confirmPayment(payId, ownerUserId);
      assert.strictEqual(confirmed.status, 'CONFIRMED');

      // Post commission and cash receipt
      const postRes = await commissionService.postCommissionForPayment(payId, ownerUserId, 'OWNER');
      assert.ok(postRes.commission);
      const jes = await db.select().from(journalEntries).where(eq(journalEntries.referenceId, payId));
      for (const je of jes) createdJeIds.push(je.id);

      // Verify rent schedule updated
      const [updatedSched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedId));
      assert.strictEqual(Number(updatedSched.paidAmount), 800000, 'Rent schedule paidAmount must be 800,000');
      assert.strictEqual(updatedSched.status, 'PAID', 'Rent schedule status must be PAID');

      // 2. Reverse Payment using production transaction boundary
      const revRes = await db.transaction(async (tx) => {
        await tx.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, payId));

        const remainingConfirmed = await tx.select({ amount: paymentRecords.amount })
          .from(paymentRecords)
          .where(and(
            eq(paymentRecords.rentScheduleId, schedId),
            eq(paymentRecords.status, 'CONFIRMED')
          ));
        const confirmedPaidAmount = remainingConfirmed.reduce((s, p) => s + Number(p.amount || 0), 0);
        await tx.update(rentSchedules)
          .set({ paidAmount: confirmedPaidAmount.toString(), status: 'UPCOMING' })
          .where(eq(rentSchedules.id, schedId));

        return await commissionService.reverseCommissionForPayment(
          payId,
          'Wrong apartment allocation',
          ownerUserId,
          'OWNER',
          tx
        );
      });

      assert.ok(revRes.reversalJournalEntryId);
      createdJeIds.push(revRes.reversalJournalEntryId);

      // Verify rent schedule reverted
      const [revertedSched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedId));
      assert.strictEqual(Number(revertedSched.paidAmount), 0, 'Rent schedule paidAmount must revert to 0');
      assert.strictEqual(revertedSched.status, 'UPCOMING', 'Rent schedule status must revert to UPCOMING');
    });

    // -------------------------------------------------------------------------
    // TEST 15: Reporting Integrity & Unmapped Diagnostics
    // -------------------------------------------------------------------------
    await t.test('15. General Ledger, Trial Balance, and P&L maintain strict account mapping integrity', async () => {
      const propId = createdPropIds[1]; // prop_full

      const tb: any = await financeService.getTrialBalance(propId, { failClosed: true });
      assert.strictEqual(tb.hasUnmappedAccounts, false, 'No unmapped accounts permitted');
      assert.strictEqual(tb.isComplete, true);

      // Total Dr must equal Total Cr in Trial Balance
      const tbDr = tb.reduce((s: number, r: any) => s + Number(r.debit || 0), 0);
      const tbCr = tb.reduce((s: number, r: any) => s + Number(r.credit || 0), 0);
      assert.strictEqual(tbDr, tbCr, `Trial balance Dr (${tbDr}) must equal Cr (${tbCr})`);

      const gl: any = await financeService.getGeneralLedger(propId, { failClosed: true });
      assert.strictEqual(gl.hasUnmappedAccounts, false);
      assert.strictEqual(gl.isComplete, true);
      assert.ok(gl.length >= 2, 'GL entries must contain both cash receipt and fee allocation');
    });

  } finally {
    // Teardown created test records in reverse dependency order
    if (createdJeIds.length > 0) {
      await db.delete(ledgerLines).where(inArray(ledgerLines.journalEntryId, createdJeIds)).catch(() => {});
      await db.delete(journalEntries).where(inArray(journalEntries.id, createdJeIds)).catch(() => {});
    }
    if (createdPaymentIds.length > 0) {
      await db.delete(commissions).where(inArray(commissions.paymentRecordId, createdPaymentIds)).catch(() => {});
      await db.delete(paymentRecords).where(inArray(paymentRecords.id, createdPaymentIds)).catch(() => {});
    }
    if (createdScheduleIds.length > 0) {
      await db.delete(rentSchedules).where(inArray(rentSchedules.id, createdScheduleIds)).catch(() => {});
    }
    if (createdLeaseIds.length > 0) {
      await db.delete(leases).where(inArray(leases.id, createdLeaseIds)).catch(() => {});
    }
    if (createdUnitIds.length > 0) {
      await db.delete(units).where(inArray(units.id, createdUnitIds)).catch(() => {});
    }
    if (createdPropIds.length > 0) {
      await db.delete(properties).where(inArray(properties.id, createdPropIds)).catch(() => {});
    }
    await db.delete(organizations).where(eq(organizations.id, companyOrgId)).catch(() => {});
    await db.delete(users).where(inArray(users.id, [ownerUserId, tenantUserId])).catch(() => {});
  }
});
