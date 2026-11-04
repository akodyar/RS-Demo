import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { 
  users, 
  properties, 
  leases, 
  leaseTenants, 
  rentSchedules, 
  paymentRecords, 
  ownershipRecords, 
  managementAgreements, 
  organizations, 
  commissions, 
  journalEntries, 
  ledgerLines, 
  financialPolicies,
  maintenanceRequests,
  maintenanceQuotes
} from '../src/db/schema.js';
import { companyRepository } from '../src/server/repositories/company.js';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { commissionService, CommissionService } from '../src/server/services/commission.js';
import { financeService } from '../src/server/services/finance.js';
import { eq, and, asc, sql } from 'drizzle-orm';

process.env.SQL_HOST = 'localhost';

test('Company Financial Overview & Owner Historical Fee Integrity Test Suite', async (t) => {
  const runId = Date.now().toString(36) + Math.floor(Math.random() * 1000);

  // Common IDs
  const oId = `owner-${runId}`;
  const tId = `tenant-${runId}`;
  const adminId = `admin-${runId}`;
  const companyAId = `co-a-${runId}`;
  const companyBId = `co-b-${runId}`;

  // Pre-seed users
  await db.insert(users).values([
    { id: oId, firstName: 'Owner', lastName: 'Finance', email: `${oId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: tId, firstName: 'Tenant', lastName: 'Finance', email: `${tId}@test.com`, roles: ['TENANT'] },
    { id: adminId, firstName: 'Admin', lastName: 'Finance', email: `${adminId}@test.com`, roles: ['PLATFORM_ADMIN'] }
  ]);

  // Pre-seed companies
  await db.insert(organizations).values([
    { id: companyAId, name: 'Company Alpha', type: 'MANAGEMENT_COMPANY' },
    { id: companyBId, name: 'Company Beta', type: 'MANAGEMENT_COMPANY' }
  ]);

  // Ensure default platform fee is 0.03 and exchange rate is 1310
  const origPolicy = await db.select().from(financialPolicies).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE')).limit(1);
  if (origPolicy.length === 0) {
    await db.insert(financialPolicies).values({
      policyType: 'PLATFORM_FEE_RATE',
      policyValue: '0.03',
      description: 'Platform fee rate 3%',
      active: true,
    });
  } else {
    await db.update(financialPolicies).set({ policyValue: '0.03', active: true }).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
  }

  // =========================================================================
  // TEST 1: All Three Operating Models with Distinct Fee Rates
  // =========================================================================
  await t.test('1. Three Operating Models: Proper Management Fee (NOT scalar rate added) and ledger breakdown', async () => {
    // 1A. FULLY_MANAGED
    const pFullId = `p-full-${runId}`;
    await db.insert(properties).values({
      id: pFullId,
      name: 'Full Managed Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.04',          // 4% Rent Fee
      managementFee: '0.08',    // 8% Management Fee
      currency: 'IQD'
    });
    await db.insert(ownershipRecords).values({ propertyId: pFullId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    await db.insert(managementAgreements).values({ propertyId: pFullId, ownerId: oId, companyId: companyAId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    // 1B. AGENT_LISTED_PLATFORM_MANAGED
    const pAgentMgmtId = `p-alpm-${runId}`;
    await db.insert(properties).values({
      id: pAgentMgmtId,
      name: 'Agent Listed Platform Managed Property',
      type: 'RESIDENTIAL',
      address: { city: 'Sulaymaniyah' },
      operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
      rentFee: '0.05',          // ignored by operating model
      managementFee: '0.10',    // 10% Management Fee
      currency: 'IQD'
    });
    await db.insert(ownershipRecords).values({ propertyId: pAgentMgmtId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    await db.insert(managementAgreements).values({ propertyId: pAgentMgmtId, ownerId: oId, companyId: companyAId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    // 1C. AGENT_OPERATED
    const pAgentOpId = `p-aop-${runId}`;
    await db.insert(properties).values({
      id: pAgentOpId,
      name: 'Agent Operated Property',
      type: 'RESIDENTIAL',
      address: { city: 'Duhok' },
      operatingModel: 'AGENT_OPERATED',
      rentFee: '0.05',          // ignored
      managementFee: '0.10',    // ignored
      currency: 'IQD'
    });
    await db.insert(ownershipRecords).values({ propertyId: pAgentOpId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    await db.insert(managementAgreements).values({ propertyId: pAgentOpId, ownerId: oId, companyId: companyAId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    // Insert Leases and Confirmed Payments
    // Payment 1 for FULLY_MANAGED: 1,000,000 IQD
    const [l1] = await db.insert(leases).values({ propertyId: pFullId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();
    const [pay1] = await db.insert(paymentRecords).values({ propertyId: pFullId, leaseId: l1.id, payerId: tId, amount: '1000000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'BANK_TRANSFER', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(pay1.id, adminId);

    // Payment 2 for AGENT_LISTED_PLATFORM_MANAGED: 1,000,000 IQD
    const [l2] = await db.insert(leases).values({ propertyId: pAgentMgmtId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();
    const [pay2] = await db.insert(paymentRecords).values({ propertyId: pAgentMgmtId, leaseId: l2.id, payerId: tId, amount: '1000000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'BANK_TRANSFER', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(pay2.id, adminId);

    // Payment 3 for AGENT_OPERATED: 1,000,000 IQD
    const [l3] = await db.insert(leases).values({ propertyId: pAgentOpId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();
    const [pay3] = await db.insert(paymentRecords).values({ propertyId: pAgentOpId, leaseId: l3.id, payerId: tId, amount: '1000000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'BANK_TRANSFER', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(pay3.id, adminId);

    // Verify persisted commission and ledger lines in database
    const comm1 = await db.select().from(commissions).where(eq(commissions.paymentRecordId, pay1.id)).limit(1);
    const lines1 = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, comm1[0].journalEntryId!));
    const line4012_1 = lines1.find(l => l.accountId === '4012');
    assert.strictEqual(Number(line4012_1?.credit), 80000, 'Ledger line 4012 for FULLY_MANAGED must be 80,000 IQD (8% of 1,000,000)');

    const comm2 = await db.select().from(commissions).where(eq(commissions.paymentRecordId, pay2.id)).limit(1);
    const lines2 = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, comm2[0].journalEntryId!));
    const line4012_2 = lines2.find(l => l.accountId === '4012');
    assert.strictEqual(Number(line4012_2?.credit), 100000, 'Ledger line 4012 for AGENT_LISTED_PLATFORM_MANAGED must be 100,000 IQD (10% of 1,000,000)');

    const comm3 = await db.select().from(commissions).where(eq(commissions.paymentRecordId, pay3.id)).limit(1);
    const lines3 = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, comm3[0].journalEntryId!));
    const line4012_3 = lines3.find(l => l.accountId === '4012');
    assert.strictEqual(line4012_3, undefined, 'Ledger line 4012 for AGENT_OPERATED must NOT exist (0 management fee)');

    // Fetch company financials for Company Alpha across all 3 properties
    const financials = await companyRepository.getFinancials(companyAId);

    // Total collected rent: 3 * 1,000,000 = 3,000,000 IQD
    assert.strictEqual(financials.collectedRentIqd, 3000000, 'Collected rent must be exactly 3,000,000 IQD');
    
    // Expected management fees earned by company:
    // p1 (80,000) + p2 (100,000) + p3 (0) = 180,000 IQD
    assert.strictEqual(financials.commissionsEarnedIqd, 180000, 'Company earned commissions must be exactly 180,000 IQD (NOT 0 IQD from scalar bug)');

    // Platform commissions: 3 * 30,000 = 90,000 IQD
    assert.strictEqual(financials.platformCommissionIqd, 90000, 'Platform commissions must be 90,000 IQD');

    // Rent Fee: p1 (40,000) + p2 (0) + p3 (0) = 40,000 IQD
    assert.strictEqual(financials.rentFeeIqd, 40000, 'Rent fee must be exactly 40,000 IQD (4% of 1,000,000 on FULLY_MANAGED, 0 on ALPM/AOP)');

    // Owner Net Settlement:
    // p1 net: 1,000,000 - 30,000 - 40,000 - 80,000 = 850,000
    // p2 net: 1,000,000 - 30,000 - 0 - 100,000 = 870,000
    // p3 net: 1,000,000 - 30,000 - 0 - 0 = 970,000
    // Total owner net: 850,000 + 870,000 + 970,000 = 2,690,000 IQD
    assert.strictEqual(financials.ownerSettlementPayableIqd, 2690000, 'Owner settlement payable must be 2,690,000 IQD (not overstated by missing management fees)');

    // Strict mathematical reconciliation: Collected = Platform Fee + Rent Fee + Mgmt Fee + Owner Net
    const componentsSum = (financials.platformCommissionIqd || 0) + (financials.rentFeeIqd || 0) + (financials.commissionsEarnedIqd || 0) + (financials.ownerSettlementPayableIqd || 0);
    assert.strictEqual(componentsSum, financials.collectedRentIqd, 'Sum of 3 fees + Owner Net must strictly reconcile to Collected Rent');

    // Source of truth & balanced ledger status
    assert.strictEqual(financials.sourceOfTruth, 'POSTGRESQL_DOUBLE_ENTRY_LEDGER');
    assert.strictEqual(financials.reconciliationStatus, 'BALANCED');
  });

  // =========================================================================
  // TEST 2: Multiple Confirmed Payments & Partial Payments
  // =========================================================================
  await t.test('2. Multiple and partial confirmed payments accumulate accurately', async () => {
    const pPartId = `p-part-${runId}`;
    await db.insert(properties).values({
      id: pPartId,
      name: 'Partial Payment Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',
      managementFee: '0.10',
      currency: 'IQD'
    });
    await db.insert(ownershipRecords).values({ propertyId: pPartId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    const cPartId = `co-part-${runId}`;
    await db.insert(organizations).values({ id: cPartId, name: 'Part Company', type: 'MANAGEMENT_COMPANY' });
    await db.insert(managementAgreements).values({ propertyId: pPartId, ownerId: oId, companyId: cPartId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    const [lPart] = await db.insert(leases).values({ propertyId: pPartId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();

    // Partial payment 1: 400,000 IQD
    const [payA] = await db.insert(paymentRecords).values({ propertyId: pPartId, leaseId: lPart.id, payerId: tId, amount: '400000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'CASH', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(payA.id, adminId);

    // Partial payment 2: 600,000 IQD
    const [payB] = await db.insert(paymentRecords).values({ propertyId: pPartId, leaseId: lPart.id, payerId: tId, amount: '600000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'CASH', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(payB.id, adminId);

    const financials = await companyRepository.getFinancials(cPartId);
    assert.strictEqual(financials.collectedRentIqd, 1000000, 'Collected rent should equal sum of partial payments (1,000,000)');
    // 10% management fee on 400k (40,000) + 10% on 600k (60,000) = 100,000
    assert.strictEqual(financials.commissionsEarnedIqd, 100000, 'Management fees should correctly sum partial payments (100,000)');
    assert.strictEqual(financials.platformCommissionIqd, 30000, 'Platform fee should be 30,000');
    // Owner net: 1,000,000 - 30k (platform) - 50k (rent) - 100k (mgmt) = 820,000
    assert.strictEqual(financials.ownerSettlementPayableIqd, 820000, 'Owner settlement should be 820,000');
  });

  // =========================================================================
  // TEST 3: RECORDED but Unconfirmed Payments are Strictly Excluded
  // =========================================================================
  await t.test('3. RECORDED but unconfirmed payments are excluded from company financials and fees', async () => {
    const pRecId = `p-rec-${runId}`;
    await db.insert(properties).values({
      id: pRecId,
      name: 'Recorded Unconfirmed Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      managementFee: '0.10',
      currency: 'IQD'
    });
    await db.insert(ownershipRecords).values({ propertyId: pRecId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    const cRecId = `co-rec-${runId}`;
    await db.insert(organizations).values({ id: cRecId, name: 'Rec Company', type: 'MANAGEMENT_COMPANY' });
    await db.insert(managementAgreements).values({ propertyId: pRecId, ownerId: oId, companyId: cRecId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    const [lRec] = await db.insert(leases).values({ propertyId: pRecId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();

    // Payment inserted with RECORDED status (not CONFIRMED)
    await db.insert(paymentRecords).values({ propertyId: pRecId, leaseId: lRec.id, payerId: tId, amount: '1000000', currency: 'IQD', status: 'RECORDED', paymentMethod: 'CASH', recordedDate: new Date().toISOString() });

    const financials = await companyRepository.getFinancials(cRecId);
    assert.strictEqual(financials.collectedRentIqd, 0, 'Unconfirmed RECORDED payment must NOT count as collected rent');
    assert.strictEqual(financials.commissionsEarnedIqd, 0, 'Unconfirmed payment must NOT earn company commission');
    assert.strictEqual(financials.platformCommissionIqd, 0, 'Unconfirmed payment must NOT incur platform fee');
    assert.strictEqual(financials.ownerSettlementPayableIqd, 0, 'Unconfirmed payment must NOT yield owner payable');
  });

  // =========================================================================
  // TEST 4: Approved Maintenance Expenses Deducted from Owner Payable
  // =========================================================================
  await t.test('4. Approved maintenance expenses deduct from owner payable and prevent overstatement', async () => {
    const pMaintId = `p-maint-${runId}`;
    await db.insert(properties).values({
      id: pMaintId,
      name: 'Maintenance Expense Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      managementFee: '0.10',
      currency: 'IQD'
    });
    await db.insert(ownershipRecords).values({ propertyId: pMaintId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    const cMaintId = `co-maint-${runId}`;
    await db.insert(organizations).values({ id: cMaintId, name: 'Maint Company', type: 'MANAGEMENT_COMPANY' });
    await db.insert(managementAgreements).values({ propertyId: pMaintId, ownerId: oId, companyId: cMaintId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    const [lMaint] = await db.insert(leases).values({ propertyId: pMaintId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();
    const [pPay] = await db.insert(paymentRecords).values({ propertyId: pMaintId, leaseId: lMaint.id, payerId: tId, amount: '1000000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'BANK_TRANSFER', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(pPay.id, adminId);

    // Add approved maintenance quote of 200,000 IQD
    const [mReq] = await db.insert(maintenanceRequests).values({
      propertyId: pMaintId,
      reporterUserId: tId,
      category: 'PLUMBING',
      title: 'Plumbing Repair',
      description: 'Leak in bathroom',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS'
    }).returning();

    await db.insert(maintenanceQuotes).values({
      maintenanceRequestId: mReq.id,
      propertyId: pMaintId,
      vendorOrganizationId: cMaintId,
      totalAmount: '200000',
      currency: 'IQD',
      status: 'APPROVED'
    });

    const financials = await companyRepository.getFinancials(cMaintId);
    assert.strictEqual(financials.expensesApprovedIqd, 200000, 'Approved expenses must be 200,000 IQD');
    // Rent: 1,000,000; Platform (3%): 30,000; Mgmt (10%): 100,000. Owner Net Entitlement before expenses = 870,000 IQD.
    // After 200,000 approved expenses: 870,000 - 200,000 = 670,000 IQD.
    assert.strictEqual(financials.ownerSettlementPayableIqd, 670000, 'Owner settlement payable must deduct approved maintenance expenses');
  });

  // =========================================================================
  // TEST 5: IQD and USD Currency Handling
  // =========================================================================
  await t.test('5. USD payments are correctly converted to IQD using exchange rate', async () => {
    const pUsdId = `p-usd-${runId}`;
    await db.insert(properties).values({
      id: pUsdId,
      name: 'USD Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      managementFee: '0.10',
      currency: 'USD'
    });
    await db.insert(ownershipRecords).values({ propertyId: pUsdId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    const cUsdId = `co-usd-${runId}`;
    await db.insert(organizations).values({ id: cUsdId, name: 'USD Company', type: 'MANAGEMENT_COMPANY' });
    await db.insert(managementAgreements).values({ propertyId: pUsdId, ownerId: oId, companyId: cUsdId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    const [lUsd] = await db.insert(leases).values({ propertyId: pUsdId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000', currency: 'USD', status: 'ACTIVE' }).returning();
    const [pPayUsd] = await db.insert(paymentRecords).values({ propertyId: pUsdId, leaseId: lUsd.id, payerId: tId, amount: '1000', currency: 'USD', status: 'CONFIRMED', paymentMethod: 'BANK_TRANSFER', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(pPayUsd.id, adminId);

    const financials = await companyRepository.getFinancials(cUsdId);
    // 1000 USD * 1310 = 1,310,000 IQD
    assert.strictEqual(financials.collectedRentIqd, 1310000, 'USD rent collected must convert to 1,310,000 IQD');
    // Mgmt fee: 100 USD * 1310 = 131,000 IQD
    assert.strictEqual(financials.commissionsEarnedIqd, 131000, 'USD mgmt fee must convert to 131,000 IQD');
    // Platform fee: 30 USD * 1310 = 39,300 IQD
    assert.strictEqual(financials.platformCommissionIqd, 39300, 'USD platform fee must convert to 39,300 IQD');
    // Owner net: 870 USD * 1310 = 1,139,700 IQD
    assert.strictEqual(financials.ownerSettlementPayableIqd, 1139700, 'USD owner net must convert to 1,139,700 IQD');
  });

  // =========================================================================
  // TEST 6: Payment Reversal Impact on Company Financials
  // =========================================================================
  await t.test('6. Payment reversal reduces collected rent, company commissions, and owner payable', async () => {
    const pRevId = `p-rev-${runId}`;
    await db.insert(properties).values({
      id: pRevId,
      name: 'Reversal Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      managementFee: '0.10',
      currency: 'IQD'
    });
    await db.insert(ownershipRecords).values({ propertyId: pRevId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    const cRevId = `co-rev-${runId}`;
    await db.insert(organizations).values({ id: cRevId, name: 'Rev Company', type: 'MANAGEMENT_COMPANY' });
    await db.insert(managementAgreements).values({ propertyId: pRevId, ownerId: oId, companyId: cRevId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    const [lRev] = await db.insert(leases).values({ propertyId: pRevId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();
    const [pPayRev] = await db.insert(paymentRecords).values({ propertyId: pRevId, leaseId: lRev.id, payerId: tId, amount: '1000000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'BANK_TRANSFER', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(pPayRev.id, adminId);

    // Initial financials before reversal
    let fin = await companyRepository.getFinancials(cRevId);
    assert.strictEqual(fin.collectedRentIqd, 1000000);
    assert.strictEqual(fin.commissionsEarnedIqd, 100000);

    // Reverse payment
    await commissionService.reverseCommissionForPayment(pPayRev.id, 'Fraudulent check', adminId);
    await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, pPayRev.id));

    // Post-reversal financials
    fin = await companyRepository.getFinancials(cRevId);
    assert.strictEqual(fin.collectedRentIqd, 0, 'Reversed payment must be excluded from collected rent');
    assert.strictEqual(fin.commissionsEarnedIqd, 0, 'Reversed payment must not earn commission');
    assert.strictEqual(fin.platformCommissionIqd, 0, 'Reversed payment platform fee must drop to 0');
    assert.strictEqual(fin.ownerSettlementPayableIqd, 0, 'Reversed payment owner payable must drop to 0');
  });

  // =========================================================================
  // TEST 7: Historical Owner Portfolio Integrity When Current Policy Rates Change
  // =========================================================================
  await t.test('7. Historical owner portfolio values remain unchanged when current platform fee rate or property fees change', async () => {
    const pHistId = `p-hist-${runId}`;
    await db.insert(properties).values({
      id: pHistId,
      name: 'Historical Integrity Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.04',
      managementFee: '0.08',
      currency: 'IQD'
    });
    await db.insert(ownershipRecords).values({ propertyId: pHistId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });

    const [lHist] = await db.insert(leases).values({ propertyId: pHistId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();
    const [pPayHist] = await db.insert(paymentRecords).values({ propertyId: pHistId, leaseId: lHist.id, payerId: tId, amount: '1000000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'BANK_TRANSFER', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(pPayHist.id, adminId);

    // Get owner portfolio at current rate (3% platform + 4% rent + 8% mgmt = 15% total = 150,000 IQD)
    const portfolioBefore = await ownerRepository.getPortfolio({ id: oId, roles: ['PROPERTY_OWNER'] });
    const targetBefore = portfolioBefore.find(p => p.id === pHistId);
    assert.ok(targetBefore);
    assert.strictEqual(targetBefore.collectedRentIqd, 1000000);
    assert.strictEqual(targetBefore.totalFeeDeductedIqd, 150000, 'Initial total fee must be 150,000 IQD');
    assert.strictEqual(targetBefore.netOwnerIncomeIqd, 850000, 'Initial net income must be 850,000 IQD');

    // NOW: Change the global PLATFORM_FEE_RATE policy from 0.03 to 0.10 (10%)
    await db.update(financialPolicies).set({ policyValue: '0.10' }).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));

    // AND: Change the property managementFee from 0.08 to 0.20 (20%)
    await db.update(properties).set({ managementFee: '0.20', rentFee: '0.10' }).where(eq(properties.id, pHistId));

    // Re-fetch owner portfolio
    const portfolioAfter = await ownerRepository.getPortfolio({ id: oId, roles: ['PROPERTY_OWNER'] });
    const targetAfter = portfolioAfter.find(p => p.id === pHistId);
    assert.ok(targetAfter);

    // CRITICAL ASSERTION: The historical fee deduction and net owner income MUST NOT change!
    assert.strictEqual(targetAfter.totalFeeDeductedIqd, 150000, 'Historical fees must PRESERVE original posted 150,000 IQD despite rate change');
    assert.strictEqual(targetAfter.netOwnerIncomeIqd, 850000, 'Historical net income must PRESERVE original posted 850,000 IQD despite rate change');

    // Restore policy back to 0.03
    await db.update(financialPolicies).set({ policyValue: '0.03' }).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
  });

  // =========================================================================
  // TEST 8: Company Authorization Isolation
  // =========================================================================
  await t.test('8. Company financial authorization isolation: no cross-company leakage', async () => {
    // companyAId has properties created earlier.
    // companyBId has no properties yet.
    const finB = await companyRepository.getFinancials(companyBId);
    assert.strictEqual(finB.propertiesCount, 0);
    assert.strictEqual(finB.collectedRentIqd, 0);
    assert.strictEqual(finB.commissionsEarnedIqd, 0);
    assert.strictEqual(finB.ownerSettlementPayableIqd, 0);
  });

  // =========================================================================
  // TEST 9: Reading Financials Creates No Duplicate Postings or Ledger Lines
  // =========================================================================
  await t.test('9. Reading financial overview is strictly idempotent and creates 0 new ledger or commission records', async () => {
    const [cCountBefore] = await db.select({ count: sql<number>`count(*)` }).from(commissions);
    const [jCountBefore] = await db.select({ count: sql<number>`count(*)` }).from(journalEntries);
    const [lCountBefore] = await db.select({ count: sql<number>`count(*)` }).from(ledgerLines);

    // Perform multiple read operations
    await companyRepository.getFinancials(companyAId);
    await companyRepository.getFinancials(companyBId);
    await ownerRepository.getPortfolio({ id: oId, roles: ['PROPERTY_OWNER'] });
    await companyRepository.getFinancials(companyAId);

    const [cCountAfter] = await db.select({ count: sql<number>`count(*)` }).from(commissions);
    const [jCountAfter] = await db.select({ count: sql<number>`count(*)` }).from(journalEntries);
    const [lCountAfter] = await db.select({ count: sql<number>`count(*)` }).from(ledgerLines);

    assert.strictEqual(Number(cCountAfter.count), Number(cCountBefore.count), 'No new commissions must be created on read');
    assert.strictEqual(Number(jCountAfter.count), Number(jCountBefore.count), 'No new journal entries must be created on read');
    assert.strictEqual(Number(lCountAfter.count), Number(lCountBefore.count), 'No new ledger lines must be created on read');
  });

  // =========================================================================
  // TEST 10: Rent Fee (4011) Integrity, Fallback Calculations & UI Presentation
  // =========================================================================
  await t.test('10. Rent Fee integrity: Account 4011 captured across operating models, fallback, and UI', async () => {
    // 10A. Company with zero properties returns rentFeeIqd: 0
    const companyEmptyId = `co-empty-${runId}`;
    await db.insert(organizations).values({ id: companyEmptyId, name: 'Company Empty', type: 'MANAGEMENT_COMPANY' });
    const emptyFin = await companyRepository.getFinancials(companyEmptyId);
    assert.strictEqual(emptyFin.rentFeeIqd, 0, 'Empty portfolio must return rentFeeIqd = 0');

    // 10B. Dedicated company with FULLY_MANAGED fallback calculation (no posted commission yet)
    const companyFallbackId = `co-fallback-${runId}`;
    await db.insert(organizations).values({ id: companyFallbackId, name: 'Company Fallback', type: 'MANAGEMENT_COMPANY' });

    const pFbId = `p-fb-${runId}`;
    await db.insert(properties).values({
      id: pFbId,
      name: 'Fallback Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',       // 5% Rent Fee
      managementFee: '0.07', // 7% Mgmt Fee
      currency: 'IQD',
    });
    await db.insert(ownershipRecords).values({ propertyId: pFbId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    await db.insert(managementAgreements).values({ propertyId: pFbId, ownerId: oId, companyId: companyFallbackId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    const [lFb] = await db.insert(leases).values({ propertyId: pFbId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '2000000', currency: 'IQD', status: 'ACTIVE' }).returning();
    // Confirmed payment WITHOUT posted commission (triggers fallback calculation in getFinancials)
    await db.insert(paymentRecords).values({ propertyId: pFbId, leaseId: lFb.id, payerId: tId, amount: '2000000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'CASH', recordedDate: new Date().toISOString() });

    const fbFin = await companyRepository.getFinancials(companyFallbackId);
    assert.strictEqual(fbFin.collectedRentIqd, 2000000, 'Collected rent must be 2,000,000 IQD');
    // Platform fee: 3% of 2,000,000 = 60,000 IQD
    assert.strictEqual(fbFin.platformCommissionIqd, 60000, 'Fallback platform fee must be 60,000 IQD');
    // Rent fee: 5% of 2,000,000 = 100,000 IQD
    assert.strictEqual(fbFin.rentFeeIqd, 100000, 'Fallback rent fee must be 100,000 IQD (5% of 2,000,000)');
    // Management fee: 7% of 2,000,000 = 140,000 IQD
    assert.strictEqual(fbFin.commissionsEarnedIqd, 140000, 'Fallback management fee must be 140,000 IQD (7% of 2,000,000)');
    // Owner net: 2,000,000 - 60,000 - 100,000 - 140,000 = 1,700,000 IQD
    assert.strictEqual(fbFin.ownerSettlementPayableIqd, 1700000, 'Fallback owner net must be 1,700,000 IQD');

    // Strict reconciliation
    const fbSum = (fbFin.platformCommissionIqd || 0) + (fbFin.rentFeeIqd || 0) + (fbFin.commissionsEarnedIqd || 0) + (fbFin.ownerSettlementPayableIqd || 0);
    assert.strictEqual(fbSum, fbFin.collectedRentIqd, 'Fallback calculation must reconcile completely');
    assert.strictEqual(fbFin.reconciliationStatus, 'PENDING_RECONCILIATION', 'Fallback calculation without ledger posting must report PENDING_RECONCILIATION');

    // 10C. Static verification of CompanyWorkspace.tsx rendering
    const fs = await import('node:fs');
    const path = await import('node:path');
    const companyWorkspaceContent = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'CompanyWorkspace.tsx'), 'utf-8');

    assert.ok(companyWorkspaceContent.includes('data-testid="card-company-rent-fee"'), 'CompanyWorkspace must render Rent Fee card testid');
    assert.ok(companyWorkspaceContent.includes('dashboardData?.financialSummary.rentFeeIqd'), 'CompanyWorkspace must bind financialSummary.rentFeeIqd');
    assert.ok(companyWorkspaceContent.includes('company.rent_fee'), 'CompanyWorkspace must use localized company.rent_fee key');
    assert.ok(companyWorkspaceContent.includes('company.fully_managed_only'), 'CompanyWorkspace must use localized company.fully_managed_only key');
  });

  // =========================================================================
  // TEST 11: Authoritative Reconciliation Status Across All Financial States
  // =========================================================================
  await t.test('11. Authoritative reconciliation status distinguishes BALANCED, PENDING_RECONCILIATION, UNRECONCILED, and NO_DATA', async () => {
    // 11A. NO_DATA: Company with properties but 0 payments
    const coZeroPayId = `co-zeropay-${runId}`;
    await db.insert(organizations).values({ id: coZeroPayId, name: 'Zero Pay Co', type: 'MANAGEMENT_COMPANY' });
    const pZeroPayId = `p-zeropay-${runId}`;
    await db.insert(properties).values({
      id: pZeroPayId,
      name: 'Zero Pay Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.04',
      managementFee: '0.08',
      currency: 'IQD',
    });
    await db.insert(ownershipRecords).values({ propertyId: pZeroPayId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    await db.insert(managementAgreements).values({ propertyId: pZeroPayId, ownerId: oId, companyId: coZeroPayId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    const zeroFin = await companyRepository.getFinancials(coZeroPayId);
    assert.strictEqual(zeroFin.reconciliationStatus, 'NO_DATA', 'Portfolio with 0 payments must report NO_DATA (never false BALANCED)');

    // 11B. BALANCED: Fully posted and balanced double-entry ledger lines
    // Checked earlier on companyAId in Test 1
    const balFin = await companyRepository.getFinancials(companyAId);
    assert.strictEqual(balFin.reconciliationStatus, 'BALANCED', 'Fully posted balanced portfolio must report BALANCED');

    // 11C. PENDING_RECONCILIATION: Unposted payments in fallback mode
    const coPendId = `co-pend-${runId}`;
    await db.insert(organizations).values({ id: coPendId, name: 'Pending Co', type: 'MANAGEMENT_COMPANY' });
    const pPendId = `p-pend-${runId}`;
    await db.insert(properties).values({
      id: pPendId,
      name: 'Pending Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.04',
      managementFee: '0.08',
      currency: 'IQD',
    });
    await db.insert(ownershipRecords).values({ propertyId: pPendId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    await db.insert(managementAgreements).values({ propertyId: pPendId, ownerId: oId, companyId: coPendId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    const [lPend] = await db.insert(leases).values({ propertyId: pPendId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();
    // Confirmed payment WITHOUT posted commission (fallback calculation)
    await db.insert(paymentRecords).values({ propertyId: pPendId, leaseId: lPend.id, payerId: tId, amount: '1000000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'CASH', recordedDate: new Date().toISOString() });

    const pendFin = await companyRepository.getFinancials(coPendId);
    assert.strictEqual(pendFin.reconciliationStatus, 'PENDING_RECONCILIATION', 'Portfolio with unposted payments must report PENDING_RECONCILIATION');

    // 11D. UNRECONCILED: Unbalanced double-entry journal entry (debit != credit)
    const coUnrecId = `co-unrec-${runId}`;
    await db.insert(organizations).values({ id: coUnrecId, name: 'Unreconciled Co', type: 'MANAGEMENT_COMPANY' });
    const pUnrecId = `p-unrec-${runId}`;
    await db.insert(properties).values({
      id: pUnrecId,
      name: 'Unreconciled Property',
      type: 'RESIDENTIAL',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',
      managementFee: '0.10',
      currency: 'IQD',
    });
    await db.insert(ownershipRecords).values({ propertyId: pUnrecId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
    await db.insert(managementAgreements).values({ propertyId: pUnrecId, ownerId: oId, companyId: coUnrecId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: [] });

    const [lUnrec] = await db.insert(leases).values({ propertyId: pUnrecId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000000', currency: 'IQD', status: 'ACTIVE' }).returning();
    const [payUnrec] = await db.insert(paymentRecords).values({ propertyId: pUnrecId, leaseId: lUnrec.id, payerId: tId, amount: '1000000', currency: 'IQD', status: 'CONFIRMED', paymentMethod: 'BANK_TRANSFER', recordedDate: new Date().toISOString() }).returning();
    await commissionService.postCommissionForPayment(payUnrec.id, adminId);

    // Corrupt one ledger line so debit != credit (create an intentional 10,000 IQD discrepancy)
    const commUnrec = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payUnrec.id)).limit(1);
    const jeId = commUnrec[0]?.journalEntryId;
    assert.ok(jeId, 'Journal entry must exist for posted commission');

    // Corrupt credit of platform fee line
    await db.update(ledgerLines)
      .set({ credit: '20000' }) // was 30000, now 20000 -> unbalanced by 10,000 IQD
      .where(and(eq(ledgerLines.journalEntryId, jeId), eq(ledgerLines.accountId, '4010')));

    const unrecFin = await companyRepository.getFinancials(coUnrecId);
    assert.strictEqual(unrecFin.reconciliationStatus, 'UNRECONCILED', 'Corrupted / unbalanced journal entry must report UNRECONCILED');
  });

  // =========================================================================
  // TEST 12: UI Reconciliation Badge Binding & State Truthfulness
  // =========================================================================
  await t.test('12. CompanyWorkspace UI dynamically binds reconciliation status badge with explicit loading and error handling', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const companyWorkspaceContent = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'CompanyWorkspace.tsx'), 'utf-8');

    // 12A. Badge testid and dynamic helper binding
    assert.ok(companyWorkspaceContent.includes('renderReconciliationBadge()'), 'CompanyWorkspace must call renderReconciliationBadge()');
    assert.ok(companyWorkspaceContent.includes('data-testid="badge-reconciliation-status"'), 'Badge must render data-testid="badge-reconciliation-status"');

    // 12B. Hardcoded green badge must NOT exist
    assert.ok(
      !companyWorkspaceContent.includes('<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">\n                <CheckCircle2 className="w-3.5 h-3.5" />\n                <span>{t(\'company.ledger_balanced\''),
      'Hardcoded static green Double-Entry Balanced badge must be removed'
    );

    // 12C. All 6 explicit states represented
    assert.ok(companyWorkspaceContent.includes('data-status="LOADING"'), 'Badge must support LOADING state');
    assert.ok(companyWorkspaceContent.includes('data-status="UNAVAILABLE"'), 'Badge must support UNAVAILABLE state for dbUnavailable or error');
    assert.ok(companyWorkspaceContent.includes('data-status="BALANCED"'), 'Badge must support BALANCED state');
    assert.ok(companyWorkspaceContent.includes('data-status="PENDING_RECONCILIATION"'), 'Badge must support PENDING_RECONCILIATION state');
    assert.ok(companyWorkspaceContent.includes('data-status="UNRECONCILED"'), 'Badge must support UNRECONCILED state');
    assert.ok(companyWorkspaceContent.includes('data-status="NO_DATA"'), 'Badge must support NO_DATA state');

    // 12D. Accessibility compliance
    assert.ok(companyWorkspaceContent.includes('role="status"'), 'Reconciliation badge must include role="status"');
    assert.ok(companyWorkspaceContent.includes('aria-label='), 'Reconciliation badge must include accessible aria-label');

    // 12E. Localization keys verified in I18nProvider
    const i18nContent = fs.readFileSync(path.join(process.cwd(), 'src', 'i18n', 'I18nProvider.tsx'), 'utf-8');
    assert.ok(i18nContent.includes("'company.status_loading'"), 'I18nProvider must include company.status_loading');
    assert.ok(i18nContent.includes("'company.status_error'"), 'I18nProvider must include company.status_error');
    assert.ok(i18nContent.includes("'company.status_pending'"), 'I18nProvider must include company.status_pending');
    assert.ok(i18nContent.includes("'company.status_unreconciled'"), 'I18nProvider must include company.status_unreconciled');
    assert.ok(i18nContent.includes("'company.status_no_data'"), 'I18nProvider must include company.status_no_data');
  });
});
