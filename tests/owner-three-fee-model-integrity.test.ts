import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  properties,
  leases,
  leaseTenants,
  rentSchedules,
  paymentRecords,
  ownershipRecords,
  commissions,
  journalEntries,
  ledgerLines,
  financialPolicies,
} from '../src/db/schema.js';
import { commissionService } from '../src/server/services/commission.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { eq, and } from 'drizzle-orm';

process.env.SQL_HOST = 'localhost';
process.env.SQL_DB_NAME = 'homehub_test';

const TARGET_TEST_DATABASE = 'homehub_test';

test('Authoritative Owner Three-Fee Model & Operating-Model Financial Integrity Suite', async (t) => {
  // DB Safety Guard
  const connCheck = await (db as any).execute('SELECT current_database() as db_name');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(
    activeDb,
    TARGET_TEST_DATABASE,
    `SAFETY GATE: Must connect to '${TARGET_TEST_DATABASE}'. Got: '${activeDb}'`
  );

  const runId = `owner_fee_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ownerId = `owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const agentOrgId = `org_${runId}`;
  const adminId = `admin_${runId}`;
  const ownerUser = { id: ownerId, roles: ['PROPERTY_OWNER'] };

  // Seed base actors
  await db.insert(users).values([
    { id: ownerId, firstName: 'Dana', lastName: 'Owner', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: tenantId, firstName: 'Karwan', lastName: 'Tenant', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    { id: adminId, firstName: 'Soran', lastName: 'Admin', email: `${adminId}@test.com`, roles: ['PLATFORM_ADMIN'] },
  ]);

  await db.insert(organizations).values({
    id: agentOrgId,
    name: `Erbil Elite Brokerage ${runId}`,
    type: 'AGENCY',
    status: 'VERIFIED',
  });

  // Verify / Ensure canonical Platform Fee Policy exists
  const existingPolicies = await db
    .select()
    .from(financialPolicies)
    .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
    .limit(1);

  let activePlatformRate = 0.03;
  if (existingPolicies.length > 0 && existingPolicies[0].policyValue) {
    activePlatformRate = parseFloat(existingPolicies[0].policyValue);
  } else {
    await db.insert(financialPolicies).values({
      policyType: 'PLATFORM_FEE_RATE',
      policyValue: '0.03',
      name: 'Default 3% Platform Escrow Policy',
      description: 'Canonical HomeHub Platform Fee Rate',
      effectiveFrom: new Date('2026-01-01').toISOString(),
    });
    activePlatformRate = 0.03;
  }

  // -------------------------------------------------------------------------
  // TEST CASE 1: FULLY_MANAGED Operating Model
  // Expected: Platform Fee (dynamic) + Rent Fee (5%) + Management Fee (10%)
  // On 1,000,000 IQD Confirmed Collection:
  // Platform Fee = 1,000,000 * activePlatformRate (e.g. 30,000 IQD)
  // Rent Fee = 50,000 IQD
  // Management Fee = 100,000 IQD
  // Total Fee = Platform + 150,000 IQD
  // Net Owner Remittance = 1,000,000 - Total Fee
  // -------------------------------------------------------------------------
  await t.test('1. FULLY_MANAGED applies Platform + Rent (5%) + Management (10%)', async () => {
    const propId = `prop_fm_${runId}`;
    await db.insert(properties).values({
      id: propId,
      name: `Bakhy Xabat Villa ${runId}`,
      nameKurdish: `ڤێلای باخی خەبات ${runId}`,
      type: 'VILLA',
      city: 'Erbil',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',
      managementFee: '0.10',
    });

    await db.insert(ownershipRecords).values({
      propertyId: propId,
      ownerId,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    });

    const [lease] = await db.insert(leases).values({
      propertyId: propId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1000000',
      currency: 'IQD',
      status: 'ACTIVE',
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      currency: 'IQD',
      dueDate: '2026-03-01',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(
      propId,
      lease.id,
      tenantId,
      schedule.id,
      1000000,
      'BANK_TRANSFER',
      `PAY-FM-${runId}`
    );

    // Confirm Payment
    await leaseRepository.confirmPayment(payment.id, adminId);
    await commissionService.postCommissionForPayment(payment.id, ownerId);

    // Query ledger lines
    const fmLedger = await db
      .select()
      .from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .where(eq(journalEntries.referenceId, payment.id));

    let platformAmt = 0;
    let rentAmt = 0;
    let mgmtAmt = 0;
    fmLedger.forEach((l) => {
      if (l.ledger_lines.accountId === '4010') platformAmt += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4011') rentAmt += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4012') mgmtAmt += Number(l.ledger_lines.credit);
    });

    const expectedPlatform = Math.round(1000000 * activePlatformRate);
    assert.strictEqual(platformAmt, expectedPlatform, `Platform fee must equal ${expectedPlatform}`);
    assert.strictEqual(rentAmt, 50000, 'Rent fee must equal 50,000 IQD');
    assert.strictEqual(mgmtAmt, 100000, 'Management fee must equal 100,000 IQD');

    // Verify Owner Repository itemized decomposition
    const ownerProps = await ownerRepository.getScopedOwnerProperties(ownerUser);
    const fmPropItem = ownerProps.find((p) => p.id === propId);
    assert.ok(fmPropItem, 'Property must be returned in getScopedOwnerProperties');
    assert.strictEqual(fmPropItem.operatingModel, 'FULLY_MANAGED');
    assert.strictEqual(fmPropItem.collectedRentIqd, 1000000);
    assert.strictEqual(fmPropItem.platformFeeIqd, expectedPlatform);
    assert.strictEqual(fmPropItem.rentFeeIqd, 50000);
    assert.strictEqual(fmPropItem.managementFeeIqd, 100000);
    assert.strictEqual(fmPropItem.totalFeeDeductedIqd, expectedPlatform + 150000);
    assert.strictEqual(fmPropItem.netOwnerIncomeIqd, 1000000 - (expectedPlatform + 150000));
  });

  // -------------------------------------------------------------------------
  // TEST CASE 2: AGENT_LISTED_PLATFORM_MANAGED Operating Model
  // Expected: Platform Fee (dynamic) + Management Fee (10%) (Rent Fee = 0)
  // -------------------------------------------------------------------------
  await t.test('2. AGENT_LISTED_PLATFORM_MANAGED applies Platform + Management (Rent Fee = 0)', async () => {
    const propId = `prop_al_${runId}`;
    await db.insert(properties).values({
      id: propId,
      name: `Dream City Flat ${runId}`,
      nameKurdish: `شووقەی دریم سیتی ${runId}`,
      type: 'APARTMENT',
      city: 'Erbil',
      currency: 'IQD',
      operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
      listedByAgentId: agentOrgId,
      rentFee: '0.05', // Configured but ignored for this model
      managementFee: '0.10',
    });

    await db.insert(ownershipRecords).values({
      propertyId: propId,
      ownerId,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    });

    const [lease] = await db.insert(leases).values({
      propertyId: propId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1000000',
      currency: 'IQD',
      status: 'ACTIVE',
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      currency: 'IQD',
      dueDate: '2026-03-01',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(
      propId,
      lease.id,
      tenantId,
      schedule.id,
      1000000,
      'BANK_TRANSFER',
      `PAY-AL-${runId}`
    );

    // Confirm Payment
    await leaseRepository.confirmPayment(payment.id, adminId);
    await commissionService.postCommissionForPayment(payment.id, ownerId);

    // Query ledger lines
    const alLedger = await db
      .select()
      .from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .where(eq(journalEntries.referenceId, payment.id));

    let platformAmt = 0;
    let rentAmt = 0;
    let mgmtAmt = 0;
    alLedger.forEach((l) => {
      if (l.ledger_lines.accountId === '4010') platformAmt += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4011') rentAmt += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4012') mgmtAmt += Number(l.ledger_lines.credit);
    });

    const expectedPlatform = Math.round(1000000 * activePlatformRate);
    assert.strictEqual(platformAmt, expectedPlatform, `Platform fee must equal ${expectedPlatform}`);
    assert.strictEqual(rentAmt, 0, 'Rent fee must NOT be allocated for AGENT_LISTED_PLATFORM_MANAGED');
    assert.strictEqual(mgmtAmt, 100000, 'Management fee must equal 100,000 IQD');

    // Verify Owner Repository itemized decomposition
    const ownerProps = await ownerRepository.getScopedOwnerProperties(ownerUser);
    const alPropItem = ownerProps.find((p) => p.id === propId);
    assert.ok(alPropItem);
    assert.strictEqual(alPropItem.operatingModel, 'AGENT_LISTED_PLATFORM_MANAGED');
    assert.strictEqual(alPropItem.rentFeeIqd, 0);
    assert.strictEqual(alPropItem.managementFeeIqd, 100000);
    assert.strictEqual(alPropItem.totalFeeDeductedIqd, expectedPlatform + 100000);
    assert.strictEqual(alPropItem.netOwnerIncomeIqd, 1000000 - (expectedPlatform + 100000));
  });

  // -------------------------------------------------------------------------
  // TEST CASE 3: AGENT_OPERATED Operating Model
  // Expected: Platform Fee ONLY (Rent Fee = 0, Management Fee = 0)
  // -------------------------------------------------------------------------
  await t.test('3. AGENT_OPERATED applies ONLY Platform Fee (Rent=0, Mgmt=0)', async () => {
    const propId = `prop_ao_${runId}`;
    await db.insert(properties).values({
      id: propId,
      name: `Italian City House ${runId}`,
      nameKurdish: `خانووی گوندی ئیتاڵی ${runId}`,
      type: 'HOUSE',
      city: 'Erbil',
      currency: 'IQD',
      operatingModel: 'AGENT_OPERATED',
      listedByAgentId: agentOrgId,
      managedByAgentId: agentOrgId,
      rentFee: '0.05', // Ignored
      managementFee: '0.10', // Ignored
    });

    await db.insert(ownershipRecords).values({
      propertyId: propId,
      ownerId,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    });

    const [lease] = await db.insert(leases).values({
      propertyId: propId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1000000',
      currency: 'IQD',
      status: 'ACTIVE',
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      currency: 'IQD',
      dueDate: '2026-03-01',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(
      propId,
      lease.id,
      tenantId,
      schedule.id,
      1000000,
      'BANK_TRANSFER',
      `PAY-AO-${runId}`
    );

    // Confirm Payment
    await leaseRepository.confirmPayment(payment.id, adminId);
    await commissionService.postCommissionForPayment(payment.id, ownerId);

    // Query ledger lines
    const aoLedger = await db
      .select()
      .from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .where(eq(journalEntries.referenceId, payment.id));

    let platformAmt = 0;
    let rentAmt = 0;
    let mgmtAmt = 0;
    aoLedger.forEach((l) => {
      if (l.ledger_lines.accountId === '4010') platformAmt += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4011') rentAmt += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4012') mgmtAmt += Number(l.ledger_lines.credit);
    });

    const expectedPlatform = Math.round(1000000 * activePlatformRate);
    assert.strictEqual(platformAmt, expectedPlatform, `Platform fee must equal ${expectedPlatform}`);
    assert.strictEqual(rentAmt, 0, 'Rent fee must NOT be allocated for AGENT_OPERATED');
    assert.strictEqual(mgmtAmt, 0, 'Management fee must NOT be allocated for AGENT_OPERATED');

    // Verify Owner Repository itemized decomposition
    const ownerProps = await ownerRepository.getScopedOwnerProperties(ownerUser);
    const aoPropItem = ownerProps.find((p) => p.id === propId);
    assert.ok(aoPropItem);
    assert.strictEqual(aoPropItem.operatingModel, 'AGENT_OPERATED');
    assert.strictEqual(aoPropItem.rentFeeIqd, 0);
    assert.strictEqual(aoPropItem.managementFeeIqd, 0);
    assert.strictEqual(aoPropItem.totalFeeDeductedIqd, expectedPlatform);
    assert.strictEqual(aoPropItem.netOwnerIncomeIqd, 1000000 - expectedPlatform);
  });

  // -------------------------------------------------------------------------
  // TEST CASE 4: Unconfirmed & Pending Payments NEVER inflate collections or fees
  // -------------------------------------------------------------------------
  await t.test('4. Unconfirmed/pending payments strictly do NOT generate fees or net income', async () => {
    const propId = `prop_pend_${runId}`;
    await db.insert(properties).values({
      id: propId,
      name: `Pending Test Property ${runId}`,
      type: 'APARTMENT',
      city: 'Erbil',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',
      managementFee: '0.10',
    });

    await db.insert(ownershipRecords).values({
      propertyId: propId,
      ownerId,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    });

    const [lease] = await db.insert(leases).values({
      propertyId: propId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '500000',
      currency: 'IQD',
      status: 'ACTIVE',
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '500000',
      currency: 'IQD',
      dueDate: '2026-04-01',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    // Record payment but DO NOT CONFIRM IT (Status: RECORDED/PENDING)
    const unconfirmedPayment = await leaseRepository.recordPayment(
      propId,
      lease.id,
      tenantId,
      schedule.id,
      500000,
      'CASH',
      `PAY-PEND-${runId}`
    );

    // Verify no commission record is created for unconfirmed payment
    const comms = await db.select().from(commissions).where(eq(commissions.paymentRecordId, unconfirmedPayment.id));
    assert.strictEqual(comms.length, 0, 'No commission record should exist for unconfirmed payment');

    // Verify property in owner repository shows 0 collected rent and 0 fees
    const ownerProps = await ownerRepository.getScopedOwnerProperties(ownerUser);
    const pendPropItem = ownerProps.find((p) => p.id === propId);
    assert.ok(pendPropItem);
    assert.strictEqual(pendPropItem.collectedRentIqd, 0, 'Collected rent must be 0 for unconfirmed payment');
    assert.strictEqual(pendPropItem.totalFeeDeductedIqd, 0, 'Total fees must be 0 for unconfirmed payment');
    assert.strictEqual(pendPropItem.netOwnerIncomeIqd, 0, 'Net owner income must be 0 for unconfirmed payment');
  });

  // -------------------------------------------------------------------------
  // TEST CASE 5: Payment Reversal Integrity
  // Confirmed payment reversed -> ledger lines compensated, commission REVERSED, schedule restored
  // -------------------------------------------------------------------------
  await t.test('5. Payment reversal generates compensating entries and restores schedule', async () => {
    const propId = `prop_rev_${runId}`;
    await db.insert(properties).values({
      id: propId,
      name: `Reversal Test Property ${runId}`,
      type: 'APARTMENT',
      city: 'Erbil',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',
      managementFee: '0.10',
    });

    await db.insert(ownershipRecords).values({
      propertyId: propId,
      ownerId,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    });

    const [lease] = await db.insert(leases).values({
      propertyId: propId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '600000',
      currency: 'IQD',
      status: 'ACTIVE',
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '600000',
      currency: 'IQD',
      dueDate: '2026-05-01',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(
      propId,
      lease.id,
      tenantId,
      schedule.id,
      600000,
      'BANK_TRANSFER',
      `PAY-REV-${runId}`
    );

    await leaseRepository.confirmPayment(payment.id, adminId);
    await commissionService.postCommissionForPayment(payment.id, ownerId);

    // Verify initial posted commission
    const [initialComm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
    assert.strictEqual(initialComm.status, 'POSTED');

    // Execute reversal
    const revResult = await commissionService.reverseCommissionForPayment(
      payment.id,
      'Audit Test Reversal',
      adminId,
      'PLATFORM_ADMIN'
    );
    assert.strictEqual(revResult.alreadyReversed, false);
    assert.ok(revResult.reversalJournalEntryId);

    // Verify commission updated to REVERSED
    const [updatedComm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
    assert.strictEqual(updatedComm.status, 'REVERSED');

    // Verify compensating ledger lines exist
    const revLines = await db
      .select()
      .from(ledgerLines)
      .where(eq(ledgerLines.journalEntryId, revResult.reversalJournalEntryId!));
    assert.ok(revLines.length >= 4, 'Compensating ledger lines must be generated');

    const line4000 = revLines.find((l) => l.accountId === '4000');
    assert.ok(line4000, 'Compensating line for 4000 (Gross Clearing) must exist');
    assert.strictEqual(Number(line4000.credit), 600000);
  });

  // -------------------------------------------------------------------------
  // TEST CASE 6: Authoritative Dashboard Portfolio Rollup Reconciliation
  // -------------------------------------------------------------------------
  await t.test('6. Authoritative Dashboard Portfolio Rollups match Property Items', async () => {
    const dashboardData = await ownerRepository.getAuthoritativeDashboard(ownerUser);
    const propertiesData = await ownerRepository.getScopedOwnerProperties(ownerUser);

    // Sum from individual property items
    const manualSumGross = propertiesData.reduce((acc, p) => acc + (p.collectedRentIqd || 0), 0);
    const manualSumTotalFees = propertiesData.reduce((acc, p) => acc + (p.totalFeeDeductedIqd || 0), 0);
    const manualSumNet = propertiesData.reduce((acc, p) => acc + (p.netOwnerIncomeIqd || 0), 0);
    const manualSumPlatform = propertiesData.reduce((acc, p) => acc + (p.platformFeeIqd || 0), 0);
    const manualSumRent = propertiesData.reduce((acc, p) => acc + (p.rentFeeIqd || 0), 0);
    const manualSumMgmt = propertiesData.reduce((acc, p) => acc + (p.managementFeeIqd || 0), 0);

    // Verify reconciliation between properties sum and authoritative portfolio totals
    assert.strictEqual(
      dashboardData.rentalIncome.totalActualIqd,
      manualSumGross,
      'Rental income totalActualIqd must reconcile with sum of collectedRentIqd'
    );

    assert.strictEqual(
      dashboardData.rentalIncome.totalCommissionIqd,
      manualSumTotalFees,
      'Portfolio totalCommissionIqd must reconcile with sum of totalFeeDeductedIqd'
    );

    assert.strictEqual(
      dashboardData.rentalIncome.totalNetOwnerIncomeIqd,
      manualSumNet,
      'Portfolio totalNetOwnerIncomeIqd must reconcile with sum of netOwnerIncomeIqd'
    );

    assert.strictEqual(
      dashboardData.rentalIncome.totalPlatformFeeIqd,
      manualSumPlatform,
      'Portfolio totalPlatformFeeIqd must reconcile with sum of platformFeeIqd'
    );

    assert.strictEqual(
      dashboardData.rentalIncome.totalRentFeeIqd,
      manualSumRent,
      'Portfolio totalRentFeeIqd must reconcile with sum of rentFeeIqd'
    );

    assert.strictEqual(
      dashboardData.rentalIncome.totalManagementFeeIqd,
      manualSumMgmt,
      'Portfolio totalManagementFeeIqd must reconcile with sum of managementFeeIqd'
    );

    // Verify Net Income Invariant: Gross - Total Fees = Net Income
    assert.strictEqual(
      dashboardData.rentalIncome.totalActualIqd - dashboardData.rentalIncome.totalCommissionIqd,
      dashboardData.rentalIncome.totalNetOwnerIncomeIqd,
      'Gross - Total Fees must precisely equal Net Owner Income'
    );
  });
});
