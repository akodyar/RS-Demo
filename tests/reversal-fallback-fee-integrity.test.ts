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
  organizations,
  commissions,
  journalEntries,
  ledgerLines,
  auditLogs,
  financialPolicies,
} from '../src/db/schema.js';
import { CommissionService, commissionService } from '../src/server/services/commission.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { eq, and } from 'drizzle-orm';

process.env.SQL_HOST = 'localhost';
process.env.SQL_DB_NAME = 'homehub_test';

const TARGET_TEST_DATABASE = 'homehub_test';

test('Reversal Fallback Fee-Allocation Integrity Test Suite (homehub_test)', async (t) => {
  // Hard safety gate
  const connCheck = await (db as any).execute('SELECT current_database() as db_name');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(
    activeDb,
    TARGET_TEST_DATABASE,
    `SAFETY GATE: Must be connected to '${TARGET_TEST_DATABASE}'. Got: '${activeDb}'`
  );

  const runId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ownerId = `owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const adminId = `admin_${runId}`;
  const companyId = `company_${runId}`;

  const createdUserIds: string[] = [ownerId, tenantId, adminId];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdPaymentIds: string[] = [];

  // Seed base actors
  await db.insert(users).values([
    { id: ownerId, firstName: 'Owner', lastName: 'Reversal', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: tenantId, firstName: 'Tenant', lastName: 'Reversal', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    { id: adminId, firstName: 'Admin', lastName: 'Reversal', email: `${adminId}@test.com`, roles: ['PLATFORM_ADMIN'] },
  ]);

  await db.insert(organizations).values({
    id: companyId,
    name: `Company Reversal ${runId}`,
    type: 'MANAGEMENT_COMPANY',
  });

  // Read active platform fee rate from DB financial_policies (typically 0.03 in test DB)
  const [existingPolicy] = await db.select().from(financialPolicies)
    .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
    .limit(1);

  const activePlatformRate = existingPolicy ? parseFloat(existingPolicy.policyValue) : 0.03;

  // Cleanup helper
  t.after(async () => {
    for (const pId of createdPaymentIds) {
      await db.delete(commissions).where(eq(commissions.paymentRecordId, pId)).catch(() => {});
      await db.delete(paymentRecords).where(eq(paymentRecords.id, pId)).catch(() => {});
    }
    for (const lId of createdLeaseIds) {
      await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, lId)).catch(() => {});
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lId)).catch(() => {});
      await db.delete(leases).where(eq(leases.id, lId)).catch(() => {});
    }
    for (const propId of createdPropertyIds) {
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
      await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
    }
    await db.delete(organizations).where(eq(organizations.id, companyId)).catch(() => {});
    for (const uId of createdUserIds) {
      await db.delete(users).where(eq(users.id, uId)).catch(() => {});
    }
  });

  // =========================================================================
  // SCENARIO 1: Normal Reversal Preserves Original Three-Fee Allocation
  // =========================================================================
  await t.test('1. Normal reversal preserves original three-fee allocation (4010, 4011, 4012)', async () => {
    const propId = `p_norm_${runId}`;
    createdPropertyIds.push(propId);

    // FULLY_MANAGED with rentFee = 2%, managementFee = 3%, platformFee = 5%
    await db.insert(properties).values({
      id: propId,
      name: 'Normal Reversal Property',
      type: 'APARTMENT',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.02',
      managementFee: '0.03',
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
    createdLeaseIds.push(lease.id);

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      currency: 'IQD',
      dueDate: '2026-01-05',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    // Record & confirm payment of 1,000,000 IQD
    const payment = await leaseRepository.recordPayment(propId, lease.id, tenantId, schedule.id, 1000000, 'BANK_TRANSFER', `REF-NORM-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepository.confirmPayment(payment.id, adminId);

    // Post commission
    const postRes = await commissionService.postCommissionForPayment(payment.id, adminId, 'PLATFORM_ADMIN');
    assert.strictEqual(postRes.alreadyPosted, false);
    const expPlatform = Math.round(1000000 * activePlatformRate);
    const expRent = 20000; // 2%
    const expMgmt = 30000; // 3%
    const expTotal = expPlatform + expRent + expMgmt;
    const expNet = 1000000 - expTotal;

    assert.strictEqual(postRes.calculation.platformFeeAmount, expPlatform);
    assert.strictEqual(postRes.calculation.rentFeeAmount, expRent);
    assert.strictEqual(postRes.calculation.managementFeeAmount, expMgmt);
    assert.strictEqual(postRes.calculation.totalFeeAmount, expTotal);
    assert.strictEqual(postRes.calculation.ownerNetAmount, expNet);

    // Normal reversal (original ledger lines exist)
    const revRes = await commissionService.reverseCommissionForPayment(payment.id, 'Tenant refund check bounced', adminId, 'PLATFORM_ADMIN');
    assert.strictEqual(revRes.alreadyReversed, false);
    assert.ok(revRes.reversalJournalEntryId, 'Reversal journal entry must be created');

    // Inspect reversal ledger lines
    const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, revRes.reversalJournalEntryId!));
    assert.strictEqual(revLines.length, 5, 'Must have 5 compensating ledger lines');

    const line4000 = revLines.find((l) => l.accountId === '4000');
    const line4010 = revLines.find((l) => l.accountId === '4010');
    const line4011 = revLines.find((l) => l.accountId === '4011');
    const line4012 = revLines.find((l) => l.accountId === '4012');
    const line2010 = revLines.find((l) => l.accountId === '2010');

    assert.ok(line4000 && line4010 && line4011 && line4012 && line2010, 'All 5 accounts must be present in reversal');
    assert.strictEqual(Number(line4000.credit), 1000000, 'Account 4000 credited with 1,000,000');
    assert.strictEqual(Number(line4010.debit), expPlatform, `Account 4010 debited with ${expPlatform} (platform fee)`);
    assert.strictEqual(Number(line4011.debit), expRent, `Account 4011 debited with ${expRent} (rent fee)`);
    assert.strictEqual(Number(line4012.debit), expMgmt, `Account 4012 debited with ${expMgmt} (mgmt fee)`);
    assert.strictEqual(Number(line2010.debit), expNet, `Account 2010 debited with ${expNet} (owner net)`);

    // Verify debits === credits
    const totalDebits = revLines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredits = revLines.reduce((sum, l) => sum + Number(l.credit), 0);
    assert.strictEqual(totalDebits, 1000000);
    assert.strictEqual(totalCredits, 1000000);
    assert.strictEqual(totalDebits, totalCredits, 'Debits and credits must balance exactly');
  });

  // =========================================================================
  // SCENARIO 2: Missing Original Ledger Fallback Recovers Allocation from Audit Log
  // =========================================================================
  await t.test('2. Missing original ledger fallback recovers three-fee allocation from audit log instead of dumping into 4010', async () => {
    const propId = `p_fb_audit_${runId}`;
    createdPropertyIds.push(propId);

    await db.insert(properties).values({
      id: propId,
      name: 'Fallback Audit Property',
      type: 'APARTMENT',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.02',
      managementFee: '0.03',
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
      rentAmount: '2000000',
      currency: 'IQD',
      status: 'ACTIVE',
    }).returning();
    createdLeaseIds.push(lease.id);

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '2000000',
      currency: 'IQD',
      dueDate: '2026-02-05',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(propId, lease.id, tenantId, schedule.id, 2000000, 'BANK_TRANSFER', `REF-FB-AUD-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepository.confirmPayment(payment.id, adminId);

    // Post commission normally (this writes the audit log with fee breakdown)
    await commissionService.postCommissionForPayment(payment.id, adminId, 'PLATFORM_ADMIN');

    // Simulate missing original ledger lines by setting journalEntryId to null on the commission
    const [commRecord] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
    assert.ok(commRecord);
    await db.update(commissions).set({ journalEntryId: null }).where(eq(commissions.id, commRecord.id));

    // Verify journalEntryId is now null (original lines absent from commission link)
    const [detachedComm] = await db.select().from(commissions).where(eq(commissions.id, commRecord.id));
    assert.strictEqual(detachedComm.journalEntryId, null);

    // Execute reversal via fallback path
    const revRes = await commissionService.reverseCommissionForPayment(payment.id, 'Adjustment for lease cancellation', adminId, 'PLATFORM_ADMIN');
    assert.strictEqual(revRes.alreadyReversed, false);
    assert.ok(revRes.reversalJournalEntryId);

    // Inspect reversal ledger lines
    const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, revRes.reversalJournalEntryId!));

    const line4000 = revLines.find((l) => l.accountId === '4000');
    const line4010 = revLines.find((l) => l.accountId === '4010');
    const line4011 = revLines.find((l) => l.accountId === '4011');
    const line4012 = revLines.find((l) => l.accountId === '4012');
    const line2010 = revLines.find((l) => l.accountId === '2010');

    const expPlatform2 = Math.round(2000000 * activePlatformRate);
    const expRent2 = 40000;
    const expMgmt2 = 60000;
    const expTotal2 = expPlatform2 + expRent2 + expMgmt2;
    const expNet2 = 2000000 - expTotal2;

    assert.ok(line4010, 'Account 4010 must be present');
    assert.ok(line4011, 'Account 4011 must be present');
    assert.ok(line4012, 'Account 4012 must be present');

    assert.strictEqual(Number(line4010.debit), expPlatform2, `Account 4010 debited with platform fee ${expPlatform2} (NOT the full ${expTotal2} fee)`);
    assert.strictEqual(Number(line4011.debit), expRent2, `Account 4011 debited with rent fee ${expRent2}`);
    assert.strictEqual(Number(line4012.debit), expMgmt2, `Account 4012 debited with management fee ${expMgmt2}`);
    assert.strictEqual(Number(line2010.debit), expNet2, `Account 2010 debited with owner net ${expNet2}`);
    assert.strictEqual(Number(line4000.credit), 2000000, 'Account 4000 credited with 2,000,000');

    const totalDebits = revLines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredits = revLines.reduce((sum, l) => sum + Number(l.credit), 0);
    assert.strictEqual(totalDebits, 2000000);
    assert.strictEqual(totalCredits, 2000000);
  });

  // =========================================================================
  // SCENARIO 3: AGENT_OPERATED Fallback (Missing Ledger Lines & Missing Audit Log)
  // =========================================================================
  await t.test('3. AGENT_OPERATED fallback allocates 100% of fee to 4010 and zero to 4011 and 4012', async () => {
    const propId = `p_agent_op_${runId}`;
    createdPropertyIds.push(propId);

    await db.insert(properties).values({
      id: propId,
      name: 'Agent Operated Property',
      type: 'APARTMENT',
      currency: 'IQD',
      operatingModel: 'AGENT_OPERATED',
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
    createdLeaseIds.push(lease.id);

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      currency: 'IQD',
      dueDate: '2026-03-05',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(propId, lease.id, tenantId, schedule.id, 1000000, 'BANK_TRANSFER', `REF-AG-OP-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepository.confirmPayment(payment.id, adminId);

    // Insert a legacy commission directly with NO journalEntryId and NO audit log
    const [legacyComm] = await db.insert(commissions).values({
      paymentRecordId: payment.id,
      propertyId: propId,
      leaseId: lease.id,
      tenantId,
      ownerId,
      rate: '0.05',
      baseAmount: '1000000',
      commissionAmount: '50000', // 5%
      currency: 'IQD',
      status: 'POSTED',
      journalEntryId: null,
      idempotencyKey: `COMM_LEGACY_${payment.id}`,
    }).returning();

    // Verify no audit log exists for this commission
    const auditEntries = await db.select().from(auditLogs).where(and(
      eq(auditLogs.resourceType, 'Commission'),
      eq(auditLogs.resourceId, legacyComm.id)
    ));
    assert.strictEqual(auditEntries.length, 0);

    // Execute fallback reversal
    const revRes = await commissionService.reverseCommissionForPayment(payment.id, 'Agent Operated Reversal', adminId, 'PLATFORM_ADMIN');
    assert.strictEqual(revRes.alreadyReversed, false);
    assert.ok(revRes.reversalJournalEntryId);

    const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, revRes.reversalJournalEntryId!));
    assert.strictEqual(revLines.length, 3, 'AGENT_OPERATED should produce 3 lines: 4000, 4010, 2010');

    const line4000 = revLines.find((l) => l.accountId === '4000');
    const line4010 = revLines.find((l) => l.accountId === '4010');
    const line4011 = revLines.find((l) => l.accountId === '4011');
    const line4012 = revLines.find((l) => l.accountId === '4012');
    const line2010 = revLines.find((l) => l.accountId === '2010');

    assert.strictEqual(Number(line4000?.credit), 1000000);
    assert.strictEqual(Number(line4010?.debit), 50000, '100% of fee to 4010');
    assert.strictEqual(Number(line2010?.debit), 950000);
    assert.strictEqual(line4011, undefined, 'Account 4011 must NOT be created');
    assert.strictEqual(line4012, undefined, 'Account 4012 must NOT be created');

    const totalDebits = revLines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredits = revLines.reduce((sum, l) => sum + Number(l.credit), 0);
    assert.strictEqual(totalDebits, 1000000);
    assert.strictEqual(totalCredits, 1000000);
  });

  // =========================================================================
  // SCENARIO 4: AGENT_LISTED_PLATFORM_MANAGED Fallback (Missing Ledger & Audit Log)
  // =========================================================================
  await t.test('4. AGENT_LISTED_PLATFORM_MANAGED fallback allocates platform fee to 4010 and management fee to 4012 (zero to 4011)', async () => {
    const propId = `p_agent_listed_${runId}`;
    createdPropertyIds.push(propId);

    await db.insert(properties).values({
      id: propId,
      name: 'Agent Listed Managed Property',
      type: 'APARTMENT',
      currency: 'IQD',
      operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
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
    createdLeaseIds.push(lease.id);

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      currency: 'IQD',
      dueDate: '2026-04-05',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(propId, lease.id, tenantId, schedule.id, 1000000, 'BANK_TRANSFER', `REF-AG-LST-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepository.confirmPayment(payment.id, adminId);

    // Insert legacy commission with rate = 0.05 (50,000 platform fee) and total commission = 90,000 (meaning 40,000 mgmt fee)
    // No journalEntryId and no audit log
    await db.insert(commissions).values({
      paymentRecordId: payment.id,
      propertyId: propId,
      leaseId: lease.id,
      tenantId,
      ownerId,
      rate: '0.05',
      baseAmount: '1000000',
      commissionAmount: '90000', // 50,000 platform + 40,000 mgmt
      currency: 'IQD',
      status: 'POSTED',
      journalEntryId: null,
      idempotencyKey: `COMM_LEGACY_LST_${payment.id}`,
    });

    const revRes = await commissionService.reverseCommissionForPayment(payment.id, 'Agent Listed Reversal', adminId, 'PLATFORM_ADMIN');
    assert.strictEqual(revRes.alreadyReversed, false);
    assert.ok(revRes.reversalJournalEntryId);

    const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, revRes.reversalJournalEntryId!));
    assert.strictEqual(revLines.length, 4, 'Should have 4 lines: 4000, 4010, 4012, 2010');

    const line4000 = revLines.find((l) => l.accountId === '4000');
    const line4010 = revLines.find((l) => l.accountId === '4010');
    const line4011 = revLines.find((l) => l.accountId === '4011');
    const line4012 = revLines.find((l) => l.accountId === '4012');
    const line2010 = revLines.find((l) => l.accountId === '2010');

    assert.strictEqual(Number(line4000?.credit), 1000000);
    assert.strictEqual(Number(line4010?.debit), 50000, 'Account 4010 gets exactly platform fee 50,000');
    assert.strictEqual(Number(line4012?.debit), 40000, 'Account 4012 gets management fee remainder 40,000');
    assert.strictEqual(Number(line2010?.debit), 910000, 'Account 2010 gets owner net 910,000');
    assert.strictEqual(line4011, undefined, 'Account 4011 must NOT exist for AGENT_LISTED_PLATFORM_MANAGED');

    const totalDebits = revLines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredits = revLines.reduce((sum, l) => sum + Number(l.credit), 0);
    assert.strictEqual(totalDebits, 1000000);
    assert.strictEqual(totalCredits, 1000000);
  });

  // =========================================================================
  // SCENARIO 5: Currency Rounding & USD Precision Integrity
  // =========================================================================
  await t.test('5. Reversal entries balance exactly under USD 2-decimal rounding rules', async () => {
    const propId = `p_usd_${runId}`;
    createdPropertyIds.push(propId);

    await db.insert(properties).values({
      id: propId,
      name: 'USD Currency Property',
      type: 'APARTMENT',
      currency: 'USD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.025', // 2.5%
      managementFee: '0.035', // 3.5%
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
      rentAmount: '1250.50',
      currency: 'USD',
      status: 'ACTIVE',
    }).returning();
    createdLeaseIds.push(lease.id);

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '1250.50',
      currency: 'USD',
      dueDate: '2026-05-05',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(propId, lease.id, tenantId, schedule.id, 1250.50, 'BANK_TRANSFER', `REF-USD-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepository.confirmPayment(payment.id, adminId);

    // Post commission in USD
    const postRes = await commissionService.postCommissionForPayment(payment.id, adminId, 'PLATFORM_ADMIN');
    assert.strictEqual(postRes.calculation.currency, 'USD');

    // Reverse USD payment
    const revRes = await commissionService.reverseCommissionForPayment(payment.id, 'USD Chargeback Reversal', adminId, 'PLATFORM_ADMIN');
    assert.strictEqual(revRes.alreadyReversed, false);

    const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, revRes.reversalJournalEntryId!));
    assert.strictEqual(revLines.length, 5);

    for (const line of revLines) {
      assert.strictEqual(line.currency, 'USD', 'Currency on all ledger lines must be USD');
    }

    const totalDebits = revLines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredits = revLines.reduce((sum, l) => sum + Number(l.credit), 0);
    assert.ok(
      Math.abs(totalDebits - totalCredits) < 0.0001,
      `USD debits (${totalDebits}) and credits (${totalCredits}) must match exactly`
    );
  });

  // =========================================================================
  // SCENARIO 6: Repeated Reversal Attempts Are Idempotent
  // =========================================================================
  await t.test('6. Repeated reversal attempts cannot create duplicate compensating entries', async () => {
    const propId = `p_idemp_${runId}`;
    createdPropertyIds.push(propId);

    await db.insert(properties).values({
      id: propId,
      name: 'Idempotency Test Property',
      type: 'APARTMENT',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.02',
      managementFee: '0.03',
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
    createdLeaseIds.push(lease.id);

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '500000',
      currency: 'IQD',
      dueDate: '2026-06-05',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(propId, lease.id, tenantId, schedule.id, 500000, 'BANK_TRANSFER', `REF-IDEMP-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepository.confirmPayment(payment.id, adminId);
    await commissionService.postCommissionForPayment(payment.id, adminId, 'PLATFORM_ADMIN');

    // First reversal
    const rev1 = await commissionService.reverseCommissionForPayment(payment.id, 'First attempt', adminId, 'PLATFORM_ADMIN');
    assert.strictEqual(rev1.alreadyReversed, false);
    assert.ok(rev1.reversalJournalEntryId);

    // Count compensating journal entries after attempt 1
    const [commRecord] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
    const entriesAfter1 = await db.select().from(journalEntries).where(and(
      eq(journalEntries.referenceType, 'FEE_REVERSAL'),
      eq(journalEntries.referenceId, commRecord.id)
    ));
    assert.strictEqual(entriesAfter1.length, 1, 'Exactly 1 reversal journal entry after attempt 1');

    // Second reversal attempt (identical parameters)
    const rev2 = await commissionService.reverseCommissionForPayment(payment.id, 'Retry attempt', adminId, 'PLATFORM_ADMIN');
    assert.strictEqual(rev2.alreadyReversed, true, 'Second attempt must return alreadyReversed: true');
    assert.strictEqual(rev2.reversalJournalEntryId, undefined);

    // Verify zero additional journal entries created
    const entriesAfter2 = await db.select().from(journalEntries).where(and(
      eq(journalEntries.referenceType, 'FEE_REVERSAL'),
      eq(journalEntries.referenceId, commRecord.id)
    ));
    assert.strictEqual(entriesAfter2.length, 1, 'Still exactly 1 reversal journal entry after attempt 2');
  });

  // =========================================================================
  // SCENARIO 7: Missing or Ambiguous Historical Data Fails Safely
  // =========================================================================
  await t.test('7. FULLY_MANAGED with missing ledger lines and missing audit log fails safely (no fabrication)', async () => {
    const propId = `p_ambig_${runId}`;
    createdPropertyIds.push(propId);

    await db.insert(properties).values({
      id: propId,
      name: 'Ambiguous History Property',
      type: 'APARTMENT',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
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
    createdLeaseIds.push(lease.id);

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: lease.id,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      currency: 'IQD',
      dueDate: '2026-07-05',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      status: 'UPCOMING',
      paidAmount: '0',
    }).returning();

    const payment = await leaseRepository.recordPayment(propId, lease.id, tenantId, schedule.id, 1000000, 'BANK_TRANSFER', `REF-AMBIG-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepository.confirmPayment(payment.id, adminId);

    // Insert legacy commission for FULLY_MANAGED property with rate = 0.05 (50,000 platform fee)
    // but total commissionAmount = 100,000 (meaning 50,000 was split between rentFee and mgmtFee)
    // with NO journalEntryId and NO audit log
    const [legacyComm] = await db.insert(commissions).values({
      paymentRecordId: payment.id,
      propertyId: propId,
      leaseId: lease.id,
      tenantId,
      ownerId,
      rate: '0.05',
      baseAmount: '1000000',
      commissionAmount: '100000',
      currency: 'IQD',
      status: 'POSTED',
      journalEntryId: null,
      idempotencyKey: `COMM_AMBIG_${payment.id}`,
    }).returning();

    // Reversal MUST fail closed instead of silently fabricating current rates or dumping all into 4010
    await assert.rejects(
      async () => {
        await commissionService.reverseCommissionForPayment(payment.id, 'Ambiguous Reversal Attempt', adminId, 'PLATFORM_ADMIN');
      },
      (err: Error) => {
        assert.ok(
          err.message.includes('HISTORICAL_FEE_BREAKDOWN_UNRECOVERABLE'),
          `Expected HISTORICAL_FEE_BREAKDOWN_UNRECOVERABLE error, got: ${err.message}`
        );
        return true;
      }
    );

    // Verify commission remains POSTED and no journal entry was created
    const [commAfter] = await db.select().from(commissions).where(eq(commissions.id, legacyComm.id));
    assert.strictEqual(commAfter.status, 'POSTED', 'Commission must remain POSTED after fail-closed rejection');

    const revEntries = await db.select().from(journalEntries).where(and(
      eq(journalEntries.referenceType, 'FEE_REVERSAL'),
      eq(journalEntries.referenceId, legacyComm.id)
    ));
    assert.strictEqual(revEntries.length, 0, 'Zero journal entries must be created on fail-closed rejection');
  });
});
