import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import { 
  properties, 
  users, 
  journalEntries, 
  ledgerLines, 
  chartOfAccounts 
} from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { financeService } from '../src/server/services/finance.js';

test('Financial Reporting Integrity — Unmapped Ledger Accounts Diagnostic & Fail-Closed Protection', async (t) => {
  const runId = `unmapped_audit_${Date.now()}`;
  const testUserId = `user_${runId}`;
  const testPropId = `prop_${runId}`;
  const unmappedCode = `9999_${runId}`;

  // 1. Setup isolated test property and mapped test accounts
  await db.insert(users).values({
    id: testUserId,
    email: `${testUserId}@homehub.iq`,
    firstName: 'Audit',
    lastName: 'Tester',
    roles: ['OWNER']
  }).onConflictDoNothing();

  await db.insert(properties).values({
    id: testPropId,
    name: `Audit Property ${runId}`,
    type: 'RESIDENTIAL',
    status: 'ACTIVE',
    createdBy: testUserId
  });

  // Ensure baseline mapped accounts exist for testPropId
  await db.insert(chartOfAccounts).values([
    { id: `coa_1010_${runId}`, code: `1010_${runId}`, name: 'Operating Cash', accountType: 'ASSET' },
    { id: `coa_4010_${runId}`, code: `4010_${runId}`, name: 'Platform Revenue', accountType: 'REVENUE' },
    { id: `coa_5000_${runId}`, code: `5000_${runId}`, name: 'Operating Expense', accountType: 'EXPENSE' }
  ]).onConflictDoNothing();

  const jeMappedId = `je_mapped_${runId}`;
  const jeUnmappedId = `je_unmapped_${runId}`;

  try {
    // -----------------------------------------------------------------------
    // TEST CASE 1: Completely mapped ledger lines report complete status
    // -----------------------------------------------------------------------
    await t.test('1. Completely mapped ledger lines report isComplete=true and hasUnmappedAccounts=false', async () => {
      await db.insert(journalEntries).values({
        id: jeMappedId,
        propertyId: testPropId,
        description: 'Mapped Test Transaction',
        date: new Date().toISOString(),
        status: 'POSTED'
      });

      await db.insert(ledgerLines).values([
        {
          journalEntryId: jeMappedId,
          accountId: `1010_${runId}`,
          debit: '50000',
          credit: '0',
          currency: 'IQD'
        },
        {
          journalEntryId: jeMappedId,
          accountId: `4010_${runId}`,
          debit: '0',
          credit: '50000',
          currency: 'IQD'
        }
      ]);

      const pnl = await financeService.getProfitAndLoss(testPropId);
      assert.strictEqual(pnl.isComplete, true, 'P&L should be marked complete when all accounts are mapped');
      assert.strictEqual(pnl.hasUnmappedAccounts, false, 'hasUnmappedAccounts should be false');
      assert.strictEqual(pnl.unmappedAccounts.length, 0, 'unmappedAccounts list should be empty');
      assert.strictEqual(pnl.totalRevenue, 50000, 'Total revenue must reflect mapped credit');
      assert.strictEqual(pnl.netIncome, 50000, 'Net income must equal 50000');

      const bs = await financeService.getBalanceSheet(testPropId);
      assert.strictEqual(bs.isComplete, true, 'Balance Sheet should be complete');
      assert.strictEqual(bs.hasUnmappedAccounts, false);
      assert.strictEqual(bs.totalAssets, 50000);
      assert.strictEqual(bs.totalEquity, 50000);

      const tb = await financeService.getTrialBalance(testPropId);
      assert.strictEqual((tb as any).isComplete, true, 'Trial Balance should be complete');
      assert.strictEqual((tb as any).hasUnmappedAccounts, false);
      assert.strictEqual(tb.length, 2, 'Trial Balance must contain both mapped accounts');
      assert.strictEqual(tb.find(r => r.account === `1010_${runId}`)?.name, 'Operating Cash');
      assert.strictEqual(tb.find(r => r.account === `4010_${runId}`)?.name, 'Platform Revenue');

      const gl = await financeService.getGeneralLedger(testPropId);
      assert.strictEqual((gl as any).isComplete, true, 'General Ledger should be complete');
      assert.strictEqual((gl as any).hasUnmappedAccounts, false);
      assert.strictEqual(gl.length, 2);
    });

    // -----------------------------------------------------------------------
    // TEST CASE 2: Unmapped ledger line is flagged in P&L without silent omission
    // -----------------------------------------------------------------------
    await t.test('2. Unmapped account code in P&L flags isComplete=false with explicit diagnostics', async () => {
      // Post an unmapped transaction (unmappedCode has NO row in chartOfAccounts)
      await db.insert(journalEntries).values({
        id: jeUnmappedId,
        propertyId: testPropId,
        description: 'Unmapped Ledger Transaction',
        date: new Date().toISOString(),
        status: 'POSTED'
      });

      await db.insert(ledgerLines).values([
        {
          journalEntryId: jeUnmappedId,
          accountId: `1010_${runId}`,
          debit: '25000',
          credit: '0',
          currency: 'IQD'
        },
        {
          journalEntryId: jeUnmappedId,
          accountId: unmappedCode, // Unmapped account code
          debit: '0',
          credit: '25000',
          currency: 'IQD'
        }
      ]);

      const pnl = await financeService.getProfitAndLoss(testPropId);
      assert.strictEqual(pnl.isComplete, false, 'P&L must be marked incomplete when unmapped accounts exist');
      assert.strictEqual(pnl.hasUnmappedAccounts, true, 'hasUnmappedAccounts must be true');
      assert.strictEqual(pnl.unmappedAccountCodes.includes(unmappedCode), true, 'Unmapped code must be listed');
      assert.ok(pnl.warning?.includes(unmappedCode), 'Warning message must specify the unmapped account code');

      const unmappedEntry = pnl.unmappedAccounts.find(u => u.accountId === unmappedCode);
      assert.ok(unmappedEntry, 'Unmapped entry diagnostics must exist');
      assert.strictEqual(unmappedEntry.totalCredit, 25000, 'Unmapped entry credit must match ledger');
      assert.strictEqual(unmappedEntry.totalDebit, 0, 'Unmapped entry debit must match ledger');
      assert.strictEqual(unmappedEntry.lineCount, 1, 'Unmapped line count must match ledger');
    });

    // -----------------------------------------------------------------------
    // TEST CASE 3: Fail-closed mode on P&L and Balance Sheet throws explicitly
    // -----------------------------------------------------------------------
    await t.test('3. failClosed=true on getProfitAndLoss & getBalanceSheet throws actionable error', async () => {
      await assert.rejects(
        async () => {
          await financeService.getProfitAndLoss(testPropId, undefined, { failClosed: true });
        },
        (err: any) => {
          assert.match(err.message, /UNMAPPED_LEDGER_ACCOUNTS/);
          assert.match(err.message, new RegExp(unmappedCode));
          return true;
        },
        'P&L in failClosed mode must reject report with explicit unmapped account code'
      );

      await assert.rejects(
        async () => {
          await financeService.getBalanceSheet(testPropId, { failClosed: true });
        },
        (err: any) => {
          assert.match(err.message, /UNMAPPED_LEDGER_ACCOUNTS/);
          assert.match(err.message, new RegExp(unmappedCode));
          return true;
        },
        'Balance Sheet in failClosed mode must reject report with explicit unmapped account code'
      );
    });

    // -----------------------------------------------------------------------
    // TEST CASE 4: Trial Balance and General Ledger retain unmapped lines
    // -----------------------------------------------------------------------
    await t.test('4. Trial Balance and General Ledger retain unmapped accounts with name=null and diagnostic metadata', async () => {
      const tb = await financeService.getTrialBalance(testPropId);
      assert.strictEqual((tb as any).isComplete, false, 'Trial balance must flag incomplete mapping');
      assert.strictEqual((tb as any).hasUnmappedAccounts, true);
      assert.strictEqual((tb as any).unmappedAccountCodes.includes(unmappedCode), true);

      // Verify unmapped account row is retained in the Trial Balance array
      const unmappedRow = tb.find(r => r.account === unmappedCode);
      assert.ok(unmappedRow, 'Trial Balance must retain unmapped account rather than silently omitting it');
      assert.strictEqual(unmappedRow.name, null, 'Unmapped account name must be null (no fabrication)');
      assert.strictEqual(Number(unmappedRow.credit), 25000, 'Unmapped line credit must be preserved');

      // Fundamental accounting equation: Debits == Credits across the entire trial balance
      const totalDebits = tb.reduce((sum, r) => sum + Number(r.debit), 0);
      const totalCredits = tb.reduce((sum, r) => sum + Number(r.credit), 0);
      assert.strictEqual(totalDebits, totalCredits, `Trial Balance debits (${totalDebits}) must equal credits (${totalCredits})`);

      // General Ledger retains unmapped lines
      const gl = await financeService.getGeneralLedger(testPropId);
      assert.strictEqual((gl as any).isComplete, false);
      assert.strictEqual((gl as any).hasUnmappedAccounts, true);
      const glUnmappedLine = gl.find(r => r.account === unmappedCode);
      assert.ok(glUnmappedLine, 'General ledger must retain unmapped transaction');
      assert.strictEqual(glUnmappedLine.accountName, null, 'General ledger accountName must be null for unmapped code');
    });

    // -----------------------------------------------------------------------
    // TEST CASE 5: Trial Balance and General Ledger failClosed mode throws
    // -----------------------------------------------------------------------
    await t.test('5. failClosed=true on Trial Balance & General Ledger throws actionable error', async () => {
      await assert.rejects(
        async () => {
          await financeService.getTrialBalance(testPropId, { failClosed: true });
        },
        /UNMAPPED_LEDGER_ACCOUNTS/,
        'Trial Balance in failClosed mode must throw UNMAPPED_LEDGER_ACCOUNTS'
      );

      await assert.rejects(
        async () => {
          await financeService.getGeneralLedger(testPropId, { failClosed: true });
        },
        /UNMAPPED_LEDGER_ACCOUNTS/,
        'General Ledger in failClosed mode must throw UNMAPPED_LEDGER_ACCOUNTS'
      );
    });

    // -----------------------------------------------------------------------
    // TEST CASE 6: Scope isolation: unmapped lines on an outside property
    // do NOT pollute scoped report diagnostics or trigger false failClosed rejections,
    // particularly when getProfitAndLoss receives both propertyId and companyId
    // -----------------------------------------------------------------------
    await t.test('6. Unmapped line outside report scope does not pollute diagnostics or trigger false failClosed rejection', async () => {
      const propAId = `prop_scope_a_${runId}`;
      const propBId = `prop_scope_b_${runId}`;
      const unmappedCodeA = `9991_inside_${runId}`;
      const unmappedCodeB = `9992_outside_${runId}`;
      const jePropA_Mapped = `je_prop_a_mapped_${runId}`;
      const jePropA_Unmapped = `je_prop_a_unmapped_${runId}`;
      const jePropB_Unmapped = `je_prop_b_unmapped_${runId}`;
      const testCompanyId = `org_company_scope_${runId}`;

      try {
        // Setup Property A (Target property inside report scope)
        await db.insert(properties).values({
          id: propAId,
          name: `Scope Test Property A ${runId}`,
          type: 'RESIDENTIAL',
          status: 'ACTIVE',
          createdBy: testUserId
        });

        // Setup Property B (Separate property outside report scope)
        await db.insert(properties).values({
          id: propBId,
          name: `Scope Test Property B ${runId}`,
          type: 'RESIDENTIAL',
          status: 'ACTIVE',
          createdBy: testUserId
        });

        // 1. Post completely mapped transaction to Property A
        await db.insert(journalEntries).values({
          id: jePropA_Mapped,
          propertyId: propAId,
          description: 'Property A Clean Mapped Transaction',
          date: new Date().toISOString(),
          status: 'POSTED'
        });
        await db.insert(ledgerLines).values([
          { journalEntryId: jePropA_Mapped, accountId: `1010_${runId}`, debit: '80000', credit: '0', currency: 'IQD' },
          { journalEntryId: jePropA_Mapped, accountId: `4010_${runId}`, debit: '0', credit: '80000', currency: 'IQD' }
        ]);

        // 2. Post UNMAPPED transaction to Property B (outside report scope)
        await db.insert(journalEntries).values({
          id: jePropB_Unmapped,
          propertyId: propBId,
          description: 'Property B Unmapped Transaction (Outside Scope)',
          date: new Date().toISOString(),
          status: 'POSTED'
        });
        await db.insert(ledgerLines).values([
          { journalEntryId: jePropB_Unmapped, accountId: `1010_${runId}`, debit: '45000', credit: '0', currency: 'IQD' },
          { journalEntryId: jePropB_Unmapped, accountId: unmappedCodeB, debit: '0', credit: '45000', currency: 'IQD' }
        ]);

        // --- SUBTEST A: Direct diagnostic scoping ---
        const unmappedForPropA = await financeService.getUnmappedLedgerAccounts(propAId);
        assert.strictEqual(unmappedForPropA.length, 0, 'getUnmappedLedgerAccounts(propAId) must return empty when Property A has no unmapped lines');

        const unmappedForPropB = await financeService.getUnmappedLedgerAccounts(propBId);
        assert.strictEqual(unmappedForPropB.length, 1, 'getUnmappedLedgerAccounts(propBId) must detect unmapped line on Property B');
        assert.strictEqual(unmappedForPropB[0].accountId, unmappedCodeB);

        // --- SUBTEST B: P&L with BOTH propertyId and companyId ---
        // Verifies Property B unmapped line does NOT cause false warning or failClosed rejection on Property A
        const pnlPropA = await financeService.getProfitAndLoss(propAId, testCompanyId, { failClosed: true });
        assert.strictEqual(pnlPropA.isComplete, true, 'Property A P&L must be complete even though Property B has unmapped lines');
        assert.strictEqual(pnlPropA.hasUnmappedAccounts, false, 'Property A hasUnmappedAccounts must be false');
        assert.strictEqual(pnlPropA.unmappedAccounts.length, 0, 'Property A unmappedAccounts must be empty');
        assert.strictEqual(pnlPropA.totalRevenue, 80000, 'Property A revenue must accurately reflect Property A only');
        assert.strictEqual(pnlPropA.warning, undefined, 'No warning should be set for Property A');

        // --- SUBTEST C: Balance Sheet, Trial Balance, General Ledger on Property A ---
        const bsPropA = await financeService.getBalanceSheet(propAId, { failClosed: true });
        assert.strictEqual(bsPropA.isComplete, true);
        assert.strictEqual(bsPropA.hasUnmappedAccounts, false);

        const tbPropA = await financeService.getTrialBalance(propAId, { failClosed: true });
        assert.strictEqual((tbPropA as any).isComplete, true);
        assert.strictEqual((tbPropA as any).hasUnmappedAccounts, false);
        assert.strictEqual(tbPropA.find(r => r.account === unmappedCodeB), undefined, 'Property A Trial Balance must not contain Property B unmapped code');

        const glPropA = await financeService.getGeneralLedger(propAId, { failClosed: true });
        assert.strictEqual((glPropA as any).isComplete, true);
        assert.strictEqual((glPropA as any).hasUnmappedAccounts, false);
        assert.strictEqual(glPropA.find(r => r.account === unmappedCodeB), undefined, 'Property A General Ledger must not contain Property B unmapped code');

        // --- SUBTEST D: Post UNMAPPED transaction to Property A (inside scope) ---
        await db.insert(journalEntries).values({
          id: jePropA_Unmapped,
          propertyId: propAId,
          description: 'Property A Unmapped Transaction (Inside Scope)',
          date: new Date().toISOString(),
          status: 'POSTED'
        });
        await db.insert(ledgerLines).values([
          { journalEntryId: jePropA_Unmapped, accountId: `1010_${runId}`, debit: '15000', credit: '0', currency: 'IQD' },
          { journalEntryId: jePropA_Unmapped, accountId: unmappedCodeA, debit: '0', credit: '15000', currency: 'IQD' }
        ]);

        // Now Property A has an unmapped line inside its scope
        const pnlPropA_Incomplete = await financeService.getProfitAndLoss(propAId, testCompanyId);
        assert.strictEqual(pnlPropA_Incomplete.isComplete, false, 'Property A P&L must now be marked incomplete');
        assert.strictEqual(pnlPropA_Incomplete.hasUnmappedAccounts, true);
        assert.deepStrictEqual(pnlPropA_Incomplete.unmappedAccountCodes, [unmappedCodeA], 'Unmapped codes for Property A must contain unmappedCodeA only');
        assert.strictEqual(pnlPropA_Incomplete.unmappedAccountCodes.includes(unmappedCodeB), false, 'Property A must NOT include Property B unmappedCodeB');

        // Fail-closed rejection on Property A must cite unmappedCodeA and NOT unmappedCodeB
        await assert.rejects(
          async () => {
            await financeService.getProfitAndLoss(propAId, testCompanyId, { failClosed: true });
          },
          (err: any) => {
            assert.match(err.message, /UNMAPPED_LEDGER_ACCOUNTS/);
            assert.match(err.message, new RegExp(unmappedCodeA));
            assert.doesNotMatch(err.message, new RegExp(unmappedCodeB));
            return true;
          },
          'P&L failClosed must reject due to in-scope unmapped account only'
        );

      } finally {
        // Safe cleanup for scope test fixtures
        await db.delete(ledgerLines).where(inArray(ledgerLines.journalEntryId, [jePropA_Mapped, jePropA_Unmapped, jePropB_Unmapped])).catch(() => {});
        await db.delete(journalEntries).where(inArray(journalEntries.id, [jePropA_Mapped, jePropA_Unmapped, jePropB_Unmapped])).catch(() => {});
        await db.delete(properties).where(inArray(properties.id, [propAId, propBId])).catch(() => {});
      }
    });

  } finally {
    // Clean up test fixtures safely
    await db.delete(ledgerLines).where(inArray(ledgerLines.journalEntryId, [jeMappedId, jeUnmappedId])).catch(() => {});
    await db.delete(journalEntries).where(inArray(journalEntries.id, [jeMappedId, jeUnmappedId])).catch(() => {});
    await db.delete(chartOfAccounts).where(inArray(chartOfAccounts.code, [`1010_${runId}`, `4010_${runId}`, `5000_${runId}`])).catch(() => {});
    await db.delete(properties).where(eq(properties.id, testPropId)).catch(() => {});
    await db.delete(users).where(eq(users.id, testUserId)).catch(() => {});
  }
});
