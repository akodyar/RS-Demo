import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import { 
  properties, 
  journalEntries, 
  ledgerLines, 
  chartOfAccounts, 
  accountsPayable, 
  organizations,
  users
} from '../src/db/schema.js';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { financeService } from '../src/server/services/finance.js';
import { ownerRepository } from '../src/server/repositories/owner.js';

test('Vendor Invoice & Operating Expense — Trade Accounts Payable (2000) Accounting Integrity', async (t) => {
  const runId = `tap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const testPropId = `prop_${runId}`;
  const testVendorOrgId = `org_vendor_${runId}`;
  const testOwnerId = `usr_owner_${runId}`;

  // Step 0: Ensure Account 2000 exists in chart_of_accounts
  await db.insert(chartOfAccounts).values({
    id: `coa_2000_${runId}`,
    code: '2000',
    name: 'Trade Accounts Payable',
    description: 'Vendor, contractor, and trade accounts payable',
    accountType: 'LIABILITY',
    currency: 'IQD',
    active: true,
    systemAccount: true,
  }).onConflictDoUpdate({
    target: chartOfAccounts.code,
    set: {
      name: 'Trade Accounts Payable',
      description: 'Vendor, contractor, and trade accounts payable',
      accountType: 'LIABILITY',
      active: true,
      systemAccount: true,
    }
  });

  // Setup test property, vendor org, and owner
  await db.insert(properties).values({
    id: testPropId,
    name: `Test Property ${runId}`,
    type: 'RESIDENTIAL',
    status: 'ACTIVE',
    address: { street: '100 Vendor St', city: 'Erbil', region: 'Kurdistan' }
  }).onConflictDoNothing();

  await db.insert(organizations).values({
    id: testVendorOrgId,
    name: `Vendor Org ${runId}`,
    type: 'MAINTENANCE_COMPANY',
    status: 'VERIFIED',
    email: `vendor_${runId}@homehub.iq`,
  }).onConflictDoNothing();

  await db.insert(users).values({
    id: testOwnerId,
    email: `owner_${runId}@homehub.iq`,
    role: 'OWNER',
    firstName: 'Karwan',
    lastName: 'Owner',
  }).onConflictDoNothing();

  // Test 1: processVendorInvoice creates Dr 5000 / Cr 2000, NOT 2010
  await t.test('1. processVendorInvoice posts Dr 5000 Operating Expenses / Cr 2000 Trade AP', async () => {
    const invoiceId = `INV-PLUMB-${Date.now()}`;
    const invoiceAmount = 250000; // 250,000 IQD

    const ap = await financeService.processVendorInvoice(testPropId, testVendorOrgId, invoiceId, invoiceAmount);
    assert.ok(ap, 'Accounts payable record must be created');
    assert.strictEqual(ap.sourceType, 'VENDOR_INVOICE');
    assert.strictEqual(Number(ap.amount), invoiceAmount);

    // Verify Journal Entry
    const [je] = await db.select()
      .from(journalEntries)
      .where(and(
        eq(journalEntries.referenceType, 'VENDOR_INVOICE'),
        eq(journalEntries.referenceId, invoiceId)
      ));
    assert.ok(je, 'Journal entry for vendor invoice must exist');

    // Verify Ledger Lines
    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id));
    assert.strictEqual(lines.length, 2, 'Must have exactly 2 balanced lines');

    const drExpense = lines.find(l => l.accountId === '5000');
    const crTradeAp = lines.find(l => l.accountId === '2000');
    const crOwnerPayable = lines.find(l => l.accountId === '2010');

    assert.ok(drExpense, 'Must have debit to 5000 Operating Expenses');
    assert.strictEqual(Number(drExpense.debit), invoiceAmount, 'Dr 5000 must equal invoice amount');
    assert.strictEqual(Number(drExpense.credit), 0);

    assert.ok(crTradeAp, 'Must have credit to 2000 Trade Accounts Payable');
    assert.strictEqual(Number(crTradeAp.credit), invoiceAmount, 'Cr 2000 must equal invoice amount');
    assert.strictEqual(Number(crTradeAp.debit), 0);

    // CRITICAL: Account 2010 (Owner Net Entitlement Payable) must NOT be credited
    assert.strictEqual(crOwnerPayable, undefined, 'Account 2010 must NEVER be credited for a vendor invoice');
  });

  // Test 2: Double-Entry balance
  await t.test('2. Vendor invoice journal entry is perfectly balanced', async () => {
    const invoiceId = `INV-ELEC-${Date.now()}`;
    const invoiceAmount = 180000;

    await financeService.processVendorInvoice(testPropId, testVendorOrgId, invoiceId, invoiceAmount);

    const [je] = await db.select()
      .from(journalEntries)
      .where(and(
        eq(journalEntries.referenceType, 'VENDOR_INVOICE'),
        eq(journalEntries.referenceId, invoiceId)
      ));

    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id));
    const totalDebit = lines.reduce((acc, l) => acc + Number(l.debit), 0);
    const totalCredit = lines.reduce((acc, l) => acc + Number(l.credit), 0);

    assert.strictEqual(totalDebit, totalCredit, 'Total Debits must exactly equal Total Credits');
    assert.strictEqual(totalDebit, invoiceAmount);
  });

  // Test 3: Financial Statements Integrity (P&L and Balance Sheet)
  await t.test('3. P&L recognizes expense; Balance Sheet recognizes Trade AP liability; no unmapped accounts', async () => {
    const pnl = await financeService.getProfitAndLoss(testPropId);
    assert.strictEqual(pnl.isComplete, true, 'P&L must be complete');
    assert.strictEqual(pnl.hasUnmappedAccounts, false, 'P&L must not have unmapped accounts');
    assert.ok(pnl.totalExpense > 0, 'Operating expenses must be recognized on P&L');

    const bs = await financeService.getBalanceSheet(testPropId);
    assert.strictEqual(bs.isComplete, true, 'Balance sheet must be complete');
    assert.strictEqual(bs.hasUnmappedAccounts, false, 'Balance sheet must not have unmapped accounts');
    
    // Balance sheet equation: Assets = Liabilities + Equity
    assert.strictEqual(
      bs.totalAssets,
      bs.totalLiabilities + bs.totalEquity,
      'Balance sheet equation Assets = Liabilities + Equity must strictly hold'
    );

    // Trade AP (2000) is included under liabilities
    const apLiability = bs.liabilities.find(l => l.account === '2000');
    assert.ok(apLiability, 'Account 2000 must appear under Balance Sheet liabilities');
    assert.strictEqual(apLiability.name, 'Trade Accounts Payable');
    assert.strictEqual(Math.abs(Number(apLiability.balance)), 430000, 'Trade AP liability balance must equal total invoices (430,000)');
  });

  // Test 4: General Ledger and Trial Balance mapping
  await t.test('4. Trial Balance and General Ledger report Account 2000 with canonical name', async () => {
    const tb = await financeService.getTrialBalance(testPropId);
    const tb2000 = tb.find(a => a.account === '2000');
    assert.ok(tb2000, 'Account 2000 must be present in Trial Balance');
    assert.strictEqual(tb2000.name, 'Trade Accounts Payable');

    const gl = await financeService.getGeneralLedger(testPropId);
    const gl2000 = gl.find(a => a.account === '2000');
    assert.ok(gl2000, 'Account 2000 must be present in General Ledger');
    assert.strictEqual(gl2000.accountName, 'Trade Accounts Payable');
  });

  // Test 5: Owner Net Entitlement Isolation
  await t.test('5. Owner Net Entitlement (Account 2010) is completely unaffected by vendor invoices', async () => {
    // Check all ledger lines for test property
    const allLines = await db.select()
      .from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .where(eq(journalEntries.propertyId, testPropId));

    const lines2010 = allLines.filter(row => row.ledger_lines.accountId === '2010');
    assert.strictEqual(
      lines2010.length, 
      0, 
      'Zero ledger lines should exist for Account 2010 from vendor invoice operations'
    );
  });

  // Test 6: Trade AP Settlement Workflow (Defect M-07 Remediation)
  await t.test('6. settleVendorInvoice posts Dr 2000 Trade AP / Cr 1010 Operating Cash and updates AP status to SETTLED', async () => {
    const settleInvoiceId = `INV-SETTLE-${Date.now()}`;
    const settleAmount = 300000;

    // Create open AP via processVendorInvoice
    const ap = await financeService.processVendorInvoice(testPropId, testVendorOrgId, settleInvoiceId, settleAmount);
    assert.strictEqual(ap.status, 'OPEN');

    // Settle vendor invoice
    const result = await financeService.settleVendorInvoice(settleInvoiceId, { paymentRef: 'PAY-VEND-FIB-992' });
    assert.strictEqual(result.ap.status, 'SETTLED');
    assert.strictEqual(Number(result.ap.settledAmount), settleAmount);
    assert.strictEqual(result.alreadySettled, false);

    // Verify Journal Entry: Dr 2000 (Trade AP) / Cr 1010 (Operating Cash)
    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, result.journalEntry.id));
    assert.strictEqual(lines.length, 2, 'Settlement must have exactly 2 lines');

    const drTradeAp = lines.find(l => l.accountId === '2000');
    const crCash = lines.find(l => l.accountId === '1010');

    assert.ok(drTradeAp, 'Must debit 2000 Trade Accounts Payable to decrease liability');
    assert.strictEqual(Number(drTradeAp.debit), settleAmount);
    assert.strictEqual(Number(drTradeAp.credit), 0);

    assert.ok(crCash, 'Must credit 1010 Operating Cash to decrease cash balance');
    assert.strictEqual(Number(crCash.credit), settleAmount);
    assert.strictEqual(Number(crCash.debit), 0);

    // Repeated settlement call is idempotent
    const repeatResult = await financeService.settleVendorInvoice(settleInvoiceId);
    assert.strictEqual(repeatResult.alreadySettled, true);
  });
});
