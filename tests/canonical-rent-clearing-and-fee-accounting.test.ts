/**
 * HOMEHUB — CANONICAL RENT CLEARING AND FEE-REVENUE ACCOUNTING TEST SUITE
 * 
 * Verifies:
 * 1. Canonical Chart of Accounts definitions & idempotent migration/seeding.
 * 2. All three operating models and applicable fee allocations.
 * 3. Corporate P&L revenue totals strictly including fee revenue (4010, 4011, 4012)
 *    and strictly excluding Gross Rent Clearing (4000) and Owner Net Payable (2010).
 * 4. Double-entry debit/credit equality across all journal entries and Trial Balance.
 * 5. Clearing-account lifecycle reconciliation and balance-sheet visibility.
 * 6. Missing/unmapped account diagnostics and fail-closed protection.
 * 7. Payment reversal preserving immutable historical three-fee allocation.
 * 8. Prevention of duplicate posting when the same lifecycle operation is retried.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import { 
  properties, 
  users, 
  journalEntries, 
  ledgerLines, 
  chartOfAccounts, 
  paymentRecords,
  commissions,
  leases,
  units,
  organizations,
  financialPolicies,
  managementAgreements
} from '../src/db/schema.js';
import { eq, inArray, and } from 'drizzle-orm';
import { financeService } from '../src/server/services/finance.js';
import { commissionService } from '../src/server/services/commission.js';

test('HomeHub — Canonical Rent Clearing and Fee-Revenue Accounting Suite', async (t) => {
  const runId = `canon_${Date.now()}`;
  const ownerUserId = `usr_owner_${runId}`;
  const tenantUserId = `usr_tenant_${runId}`;
  const companyOrgId = `org_comp_${runId}`;

  // Helper cleanup tracking
  const createdPropIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdJeIds: string[] = [];

  // Setup Base Test Users & Organization
  await db.insert(users).values([
    {
      id: ownerUserId,
      email: `${ownerUserId}@homehub.iq`,
      firstName: 'Canonical',
      lastName: 'Owner',
      roles: ['PROPERTY_OWNER']
    },
    {
      id: tenantUserId,
      email: `${tenantUserId}@homehub.iq`,
      firstName: 'Canonical',
      lastName: 'Tenant',
      roles: ['TENANT']
    }
  ]).onConflictDoNothing();

  await db.insert(organizations).values({
    id: companyOrgId,
    name: `Canonical Management ${runId}`,
    type: 'COMPANY'
  }).onConflictDoNothing();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Canonical Account Definitions and Repeatable Migration/Seed Behavior
    // -------------------------------------------------------------------------
    await t.test('1. Canonical Chart of Accounts definitions exist and are repeatable', async () => {
      const coaRows = await db.select().from(chartOfAccounts).orderBy(chartOfAccounts.code);
      const coaMap = new Map(coaRows.map(r => [r.code, r]));

      // Verify all 8 core accounts plus 5000 expense
      const requiredAccounts = [
        { code: '1010', type: 'ASSET', name: 'Operating Cash' },
        { code: '1200', type: 'ASSET', name: 'Tenant Accounts Receivable' },
        { code: '2010', type: 'LIABILITY', name: 'Owner Net Entitlement Payable' },
        { code: '2100', type: 'LIABILITY', name: 'Security Deposits Liability' },
        { code: '4000', type: 'LIABILITY', name: 'Gross Rent Clearing' },
        { code: '4010', type: 'REVENUE', name: 'Platform Fee Revenue' },
        { code: '4011', type: 'REVENUE', name: 'Rent Fee Revenue' },
        { code: '4012', type: 'REVENUE', name: 'Management Fee Revenue' },
        { code: '5000', type: 'EXPENSE', name: 'Operating Expenses' }
      ];

      for (const req of requiredAccounts) {
        const found = coaMap.get(req.code);
        assert.ok(found, `Canonical account ${req.code} must exist in chartOfAccounts`);
        assert.strictEqual(found.accountType, req.type, `Account ${req.code} must have type ${req.type}`);
        assert.strictEqual(found.active, true, `Account ${req.code} must be active`);
      }

      // Re-run upsert to ensure idempotency and repeatable migration behavior
      await db.insert(chartOfAccounts).values([
        { id: 'coa_4000', code: '4000', name: 'Gross Rent Clearing', accountType: 'LIABILITY', currency: 'IQD', active: true, systemAccount: true }
      ]).onConflictDoUpdate({
        target: chartOfAccounts.code,
        set: { updatedAt: new Date() }
      });

      const updated4000 = await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.code, '4000')).limit(1);
      assert.strictEqual(updated4000[0].accountType, 'LIABILITY', 'Account 4000 must remain LIABILITY after repeat execution');
    });

    // -------------------------------------------------------------------------
    // TEST 2: All Three Operating Models & Fee Allocation Postings
    // -------------------------------------------------------------------------
    await t.test('2. Fee allocations for all 3 operating models post balanced double-entry ledger lines', async () => {
      // Model 1: FULLY_MANAGED (Platform 2%, Rent 3%, Management 5%)
      const prop1Id = `prop_full_${runId}`;
      createdPropIds.push(prop1Id);
      await db.insert(properties).values({
        id: prop1Id,
        name: `Fully Managed Prop ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'FULLY_MANAGED',
        rentFee: '0.03',
        managementFee: '0.05',
        createdBy: ownerUserId
      });

      const pay1Id = `pay_full_${runId}`;
      createdPaymentIds.push(pay1Id);
      await db.insert(paymentRecords).values({
        id: pay1Id,
        propertyId: prop1Id,
        payerId: tenantUserId,
        amount: '1000000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_FULL_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString()
      });

      const comm1 = await commissionService.postCommissionForPayment(pay1Id, ownerUserId, 'OWNER');
      assert.ok(comm1.commission, 'Commission 1 must be posted');
      assert.strictEqual(comm1.alreadyPosted, false);

      const [je1] = await db.select().from(journalEntries).where(eq(journalEntries.referenceId, pay1Id));
      assert.ok(je1, 'Journal entry for Payment 1 must exist');
      createdJeIds.push(je1.id);

      const lines1 = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je1.id));
      
      // Verify FULLY_MANAGED lines:
      // Dr 4000: 1,000,000
      // Cr 4010: 20,000 (2% platform)
      // Cr 4011: 30,000 (3% rent fee)
      // Cr 4012: 50,000 (5% management fee)
      // Cr 2010: 900,000 (owner net)
      const dr4000_1 = lines1.find(l => l.accountId === '4000');
      const cr4010_1 = lines1.find(l => l.accountId === '4010');
      const cr4011_1 = lines1.find(l => l.accountId === '4011');
      const cr4012_1 = lines1.find(l => l.accountId === '4012');
      const cr2010_1 = lines1.find(l => l.accountId === '2010');

      assert.strictEqual(Number(dr4000_1?.debit), 1000000, 'Dr 4000 must equal gross rent base amount');
      assert.strictEqual(Number(dr4000_1?.credit), 0);
      assert.strictEqual(Number(cr4010_1?.credit), 20000, 'Cr 4010 Platform Fee must be 20,000 IQD');
      assert.strictEqual(Number(cr4011_1?.credit), 30000, 'Cr 4011 Rent Fee must be 30,000 IQD');
      assert.strictEqual(Number(cr4012_1?.credit), 50000, 'Cr 4012 Management Fee must be 50,000 IQD');
      assert.strictEqual(Number(cr2010_1?.credit), 900000, 'Cr 2010 Owner Net must be 900,000 IQD');

      // Double-entry balancing invariant
      const totDr1 = lines1.reduce((sum, l) => sum + Number(l.debit), 0);
      const totCr1 = lines1.reduce((sum, l) => sum + Number(l.credit), 0);
      assert.strictEqual(totDr1, totCr1, `Total Debits (${totDr1}) must equal Total Credits (${totCr1})`);

      // Model 2: AGENT_LISTED_PLATFORM_MANAGED (Platform 2%, Management 5%, Rent Fee waived)
      const prop2Id = `prop_agent_listed_${runId}`;
      createdPropIds.push(prop2Id);
      await db.insert(properties).values({
        id: prop2Id,
        name: `Agent Listed Prop ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
        rentFee: '0.03', // Should be ignored/waived under AGENT_LISTED_PLATFORM_MANAGED
        managementFee: '0.05',
        createdBy: ownerUserId
      });

      const pay2Id = `pay_agent_listed_${runId}`;
      createdPaymentIds.push(pay2Id);
      await db.insert(paymentRecords).values({
        id: pay2Id,
        propertyId: prop2Id,
        payerId: tenantUserId,
        amount: '1000000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_AL_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString()
      });

      const comm2 = await commissionService.postCommissionForPayment(pay2Id, ownerUserId, 'OWNER');
      assert.ok(comm2.commission);

      const [je2] = await db.select().from(journalEntries).where(eq(journalEntries.referenceId, pay2Id));
      createdJeIds.push(je2.id);
      const lines2 = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je2.id));

      const cr4010_2 = lines2.find(l => l.accountId === '4010');
      const cr4011_2 = lines2.find(l => l.accountId === '4011');
      const cr4012_2 = lines2.find(l => l.accountId === '4012');
      const cr2010_2 = lines2.find(l => l.accountId === '2010');

      assert.strictEqual(Number(cr4010_2?.credit), 20000, 'Cr 4010 Platform Fee must be 20,000 IQD');
      assert.strictEqual(cr4011_2, undefined, 'Cr 4011 Rent Fee must be completely absent');
      assert.strictEqual(Number(cr4012_2?.credit), 50000, 'Cr 4012 Management Fee must be 50,000 IQD');
      assert.strictEqual(Number(cr2010_2?.credit), 930000, 'Cr 2010 Owner Net must be 930,000 IQD');

      const totDr2 = lines2.reduce((sum, l) => sum + Number(l.debit), 0);
      const totCr2 = lines2.reduce((sum, l) => sum + Number(l.credit), 0);
      assert.strictEqual(totDr2, totCr2);

      // Model 3: AGENT_OPERATED (Platform Fee only)
      const prop3Id = `prop_agent_op_${runId}`;
      createdPropIds.push(prop3Id);
      await db.insert(properties).values({
        id: prop3Id,
        name: `Agent Operated Prop ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        operatingModel: 'AGENT_OPERATED',
        createdBy: ownerUserId
      });

      const pay3Id = `pay_agent_op_${runId}`;
      createdPaymentIds.push(pay3Id);
      await db.insert(paymentRecords).values({
        id: pay3Id,
        propertyId: prop3Id,
        payerId: tenantUserId,
        amount: '1000000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `REF_AO_${runId}`,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString()
      });

      const comm3 = await commissionService.postCommissionForPayment(pay3Id, ownerUserId, 'OWNER');
      assert.ok(comm3.commission);

      const [je3] = await db.select().from(journalEntries).where(eq(journalEntries.referenceId, pay3Id));
      createdJeIds.push(je3.id);
      const lines3 = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je3.id));

      const cr4010_3 = lines3.find(l => l.accountId === '4010');
      const cr4011_3 = lines3.find(l => l.accountId === '4011');
      const cr4012_3 = lines3.find(l => l.accountId === '4012');
      const cr2010_3 = lines3.find(l => l.accountId === '2010');

      assert.strictEqual(Number(cr4010_3?.credit), 20000, 'Cr 4010 Platform Fee must be 20,000 IQD');
      assert.strictEqual(cr4011_3, undefined, 'Cr 4011 Rent Fee must be absent');
      assert.strictEqual(cr4012_3, undefined, 'Cr 4012 Management Fee must be absent');
      assert.strictEqual(Number(cr2010_3?.credit), 980000, 'Cr 2010 Owner Net must be 980,000 IQD');

      const totDr3 = lines3.reduce((sum, l) => sum + Number(l.debit), 0);
      const totCr3 = lines3.reduce((sum, l) => sum + Number(l.credit), 0);
      assert.strictEqual(totDr3, totCr3);
    });

    // -------------------------------------------------------------------------
    // TEST 3: P&L Revenue Totals Exclude Account 4000 & Owner Payable 2010
    // -------------------------------------------------------------------------
    await t.test('3. Profit & Loss reports strictly fee revenue (4010/4011/4012), never Gross Rent (4000) or Owner Net (2010)', async () => {
      const prop1Id = createdPropIds[0]; // Property with FULLY_MANAGED 100k fees
      const pnl = await financeService.getProfitAndLoss(prop1Id);

      assert.strictEqual(pnl.isComplete, true, 'P&L must be marked complete');
      assert.strictEqual(pnl.hasUnmappedAccounts, false, 'hasUnmappedAccounts must be false');
      assert.strictEqual(pnl.unmappedAccountCodes.length, 0);

      // Total revenue must equal exactly sum of fees: 20k + 30k + 50k = 100,000 IQD
      assert.strictEqual(pnl.totalRevenue, 100000, 'P&L totalRevenue must be 100,000 IQD (fee revenue only)');
      assert.strictEqual(pnl.totalExpense, 0);
      assert.strictEqual(pnl.netIncome, 100000);

      // Verify individual revenue accounts
      const rev4010 = pnl.revenue.find(r => r.account === '4010');
      const rev4011 = pnl.revenue.find(r => r.account === '4011');
      const rev4012 = pnl.revenue.find(r => r.account === '4012');
      assert.strictEqual(Number(rev4010?.balance), 20000);
      assert.strictEqual(Number(rev4011?.balance), 30000);
      assert.strictEqual(Number(rev4012?.balance), 50000);

      // CRITICAL INVARIANT: 4000 and 2010 MUST NOT be present in revenue or expenses
      const pnlAccts = [...pnl.revenue.map(r => r.account), ...pnl.expenses.map(e => e.account)];
      assert.strictEqual(pnlAccts.includes('4000'), false, 'Account 4000 MUST NEVER be included in P&L');
      assert.strictEqual(pnlAccts.includes('2010'), false, 'Account 2010 MUST NEVER be included in P&L');
    });

    // -------------------------------------------------------------------------
    // TEST 4: Clearing-Account Reconciliation & Balance Sheet Visibility
    // -------------------------------------------------------------------------
    await t.test('4. Balance Sheet and Trial Balance reflect clearing entries without unmapped errors', async () => {
      const prop1Id = createdPropIds[0];

      const bs = await financeService.getBalanceSheet(prop1Id);
      assert.strictEqual(bs.isComplete, true);
      assert.strictEqual(bs.hasUnmappedAccounts, false);

      // Under liabilities, Account 4000 (clearing) and 2010 (owner payable) are properly classified
      const liab4000 = bs.liabilities.find(l => l.account === '4000');
      const liab2010 = bs.liabilities.find(l => l.account === '2010');
      assert.ok(liab4000, 'Account 4000 must appear under liabilities as clearing transit');
      assert.ok(liab2010, 'Account 2010 must appear under liabilities as owner payable');

      const tb = await financeService.getTrialBalance(prop1Id);
      assert.strictEqual((tb as any).isComplete, true);
      assert.strictEqual((tb as any).hasUnmappedAccounts, false);

      const totalDebits = tb.reduce((sum, r) => sum + Number(r.debit), 0);
      const totalCredits = tb.reduce((sum, r) => sum + Number(r.credit), 0);
      assert.strictEqual(totalDebits, totalCredits, `Trial Balance Debits (${totalDebits}) must equal Credits (${totalCredits})`);
    });

    // -------------------------------------------------------------------------
    // TEST 5: Missing / Unmapped Account Diagnostics
    // -------------------------------------------------------------------------
    await t.test('5. Unmapped accounts trigger isComplete=false and failClosed mode throws', async () => {
      const propDiagId = `prop_diag_${runId}`;
      createdPropIds.push(propDiagId);
      await db.insert(properties).values({
        id: propDiagId,
        name: `Diagnostic Prop ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        createdBy: ownerUserId
      });

      const jeDiagId = `je_diag_${runId}`;
      createdJeIds.push(jeDiagId);
      await db.insert(journalEntries).values({
        id: jeDiagId,
        propertyId: propDiagId,
        description: 'Diagnostic Unmapped Entry',
        date: new Date().toISOString(),
        status: 'POSTED'
      });

      const unmappedCode = `9876_${runId}`;
      await db.insert(ledgerLines).values([
        { journalEntryId: jeDiagId, accountId: '1010', debit: '50000', credit: '0', currency: 'IQD' },
        { journalEntryId: jeDiagId, accountId: unmappedCode, debit: '0', credit: '50000', currency: 'IQD' }
      ]);

      const pnl = await financeService.getProfitAndLoss(propDiagId);
      assert.strictEqual(pnl.isComplete, false);
      assert.strictEqual(pnl.hasUnmappedAccounts, true);
      assert.ok(pnl.unmappedAccountCodes.includes(unmappedCode));

      await assert.rejects(
        async () => {
          await financeService.getProfitAndLoss(propDiagId, undefined, { failClosed: true });
        },
        /UNMAPPED_LEDGER_ACCOUNTS/,
        'failClosed mode must reject report with unmapped accounts'
      );
    });

    // -------------------------------------------------------------------------
    // TEST 6: Payment Reversal Preserves Historical 3-Fee Allocation
    // -------------------------------------------------------------------------
    await t.test('6. Payment reversal posts exact compensating entries preserving historical fee amounts', async () => {
      const pay1Id = createdPaymentIds[0]; // FULLY_MANAGED payment
      const [origComm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, pay1Id));
      assert.ok(origComm);

      // Reversal
      const revResult = await commissionService.reverseCommissionForPayment(
        pay1Id,
        origComm.id,
        ownerUserId,
        'OWNER'
      );
      assert.ok(revResult.reversalJournalEntryId);
      createdJeIds.push(revResult.reversalJournalEntryId);

      // Fetch reversal ledger lines
      const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, revResult.reversalJournalEntryId));
      
      // Reversal must be:
      // Cr 4000: 1,000,000 (reversing clearing debit)
      // Dr 4010: 20,000 (reversing platform fee credit)
      // Dr 4011: 30,000 (reversing rent fee credit)
      // Dr 4012: 50,000 (reversing management fee credit)
      // Dr 2010: 900,000 (reversing owner payable credit)
      const cr4000 = revLines.find(l => l.accountId === '4000');
      const dr4010 = revLines.find(l => l.accountId === '4010');
      const dr4011 = revLines.find(l => l.accountId === '4011');
      const dr4012 = revLines.find(l => l.accountId === '4012');
      const dr2010 = revLines.find(l => l.accountId === '2010');

      assert.strictEqual(Number(cr4000?.credit), 1000000, 'Cr 4000 must reverse 1,000,000');
      assert.strictEqual(Number(dr4010?.debit), 20000, 'Dr 4010 must reverse 20,000');
      assert.strictEqual(Number(dr4011?.debit), 30000, 'Dr 4011 must reverse 30,000');
      assert.strictEqual(Number(dr4012?.debit), 50000, 'Dr 4012 must reverse 50,000');
      assert.strictEqual(Number(dr2010?.debit), 900000, 'Dr 2010 must reverse 900,000');

      const revTotDr = revLines.reduce((sum, l) => sum + Number(l.debit), 0);
      const revTotCr = revLines.reduce((sum, l) => sum + Number(l.credit), 0);
      assert.strictEqual(revTotDr, revTotCr, 'Reversal entry must balance');

      // Net P&L for Property 1 after reversal should return to 0
      const prop1Id = createdPropIds[0];
      const pnlAfterRev = await financeService.getProfitAndLoss(prop1Id);
      assert.strictEqual(pnlAfterRev.totalRevenue, 0, 'Net revenue after reversal must be 0 IQD');
      assert.strictEqual(pnlAfterRev.netIncome, 0);
    });

    // -------------------------------------------------------------------------
    // TEST 7: Prevention of Duplicate Postings on Retry
    // -------------------------------------------------------------------------
    await t.test('7. Retrying fee allocation and reversal operations prevents duplicate postings', async () => {
      const pay2Id = createdPaymentIds[1]; // pay2 is posted
      const retryPost = await commissionService.postCommissionForPayment(pay2Id, ownerUserId, 'OWNER');
      assert.strictEqual(retryPost.alreadyPosted, true, 'Retry of postCommissionForPayment must return alreadyPosted: true');

      const pay1Id = createdPaymentIds[0]; // pay1 is reversed
      const [origComm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, pay1Id));
      const retryRev = await commissionService.reverseCommissionForPayment(pay1Id, origComm.id, ownerUserId, 'OWNER');
      assert.strictEqual(retryRev.alreadyReversed, true, 'Retry of reverseCommissionForPayment must return alreadyReversed: true');
    });

  } finally {
    // Teardown created test data
    if (createdJeIds.length > 0) {
      await db.delete(ledgerLines).where(inArray(ledgerLines.journalEntryId, createdJeIds)).catch(() => {});
      await db.delete(journalEntries).where(inArray(journalEntries.id, createdJeIds)).catch(() => {});
    }
    if (createdPaymentIds.length > 0) {
      await db.delete(commissions).where(inArray(commissions.paymentRecordId, createdPaymentIds)).catch(() => {});
      await db.delete(paymentRecords).where(inArray(paymentRecords.id, createdPaymentIds)).catch(() => {});
    }
    if (createdPropIds.length > 0) {
      await db.delete(properties).where(inArray(properties.id, createdPropIds)).catch(() => {});
    }
    await db.delete(organizations).where(eq(organizations.id, companyOrgId)).catch(() => {});
    await db.delete(users).where(inArray(users.id, [ownerUserId, tenantUserId])).catch(() => {});
  }
});
