import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translations } from '../src/i18n/I18nProvider.js';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, ownershipRecords, managementAgreements, organizations, commissions, journalEntries, ledgerLines, financialPolicies } from '../src/db/schema.js';
import { propertyRepository } from '../src/server/repositories/properties.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { commissionService, CommissionService } from '../src/server/services/commission.js';
import { financeService } from '../src/server/services/finance.js';
import { eq, and, asc } from 'drizzle-orm';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { Permission, UserRole } from '../src/types/index.js';

process.env.SQL_HOST = 'localhost';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandCenterPath = path.join(__dirname, '../src/pages/PropertyCommandCenter.tsx');

test('PropertyCommandCenter Financial Authority & Regression Test Suite', async (t) => {
  const commandCenterSource = fs.readFileSync(commandCenterPath, 'utf-8');

  // =========================================================================
  // SECTION 1: STATIC SOURCE CODE AUDIT
  // =========================================================================

  await t.test('1. Static source audit: No hardcoded September 2026 or fabricated amounts', () => {
    assert.strictEqual(commandCenterSource.includes('September 2026 Rent'), false, 'Must not contain hardcoded September 2026 Rent');
    assert.strictEqual(commandCenterSource.includes('1,000,000 IQD'), false, 'Must not contain hardcoded 1,000,000 IQD');
    assert.strictEqual(commandCenterSource.includes('- 50,000 IQD'), false, 'Must not contain obsolete hardcoded - 50,000 IQD');
    assert.strictEqual(commandCenterSource.includes('950,000 IQD'), false, 'Must not contain hardcoded 950,000 IQD');
    assert.strictEqual(commandCenterSource.includes('Sep 1, 2026'), false, 'Must not contain hardcoded Sep 1, 2026 due/paid date');
    assert.strictEqual(commandCenterSource.includes('Sep 2, 2026'), false, 'Must not contain hardcoded Sep 2, 2026 transfer date');
    assert.strictEqual(commandCenterSource.includes('is scheduled for payout'), false, 'Must not contain fake scheduled payout text');
  });

  await t.test('2. Static source audit: Removed hardcoded platformFeeRate = 0.02 and schedule.paidAmount assumption', () => {
    assert.strictEqual(commandCenterSource.includes('platformFeeRate = 0.02'), false, 'Must NOT hardcode platformFeeRate = 0.02');
    assert.ok(commandCenterSource.includes('/api/properties/${id}/financial-summary'), 'Must fetch authoritative financial summary from backend');
    assert.ok(commandCenterSource.includes('financialSummary.confirmedCollectedRent'), 'Must use backend confirmedCollectedRent as collected income truth');
    assert.ok(commandCenterSource.includes('financialSummary.platformFeeRate'), 'Must consume authoritative platform fee rate from server');
  });

  await t.test('3. Statement and receipt button actions: Honest handling without fake downloads', () => {
    assert.ok(commandCenterSource.includes('handleViewStatement'), 'handleViewStatement handler must exist');
    assert.ok(commandCenterSource.includes('handleDownloadReceipt'), 'handleDownloadReceipt handler must exist');
    assert.strictEqual(commandCenterSource.includes('document.createElement(\'a\')'), false, 'Must not create fake download anchor element');
    assert.strictEqual(commandCenterSource.includes('URL.createObjectURL'), false, 'Must not create fake blob download URL');
    assert.ok(commandCenterSource.includes('pending banking/accounting export service integration'), 'Must inform user that PDF generation is pending integration');
  });

  await t.test('4. Localization: English, Arabic, and Kurdish translations exist for all financial keys', () => {
    const requiredKeys = [
      'property.rent_amount',
      'property.due_date',
      'property.paid_date',
      'property.collection_breakdown',
      'property.total_collected',
      'property.total_fees',
      'property.owner_net',
      'property.view_statement',
      'property.download_receipt',
      'property.no_active_lease',
      'property.financial_error',
      'payout.gateway_notice',
      'payout.none_awaiting',
    ];

    for (const key of requiredKeys) {
      assert.ok(translations['en'][key], `English translation must exist for ${key}`);
      assert.ok(translations['ar'][key], `Arabic translation must exist for ${key}`);
      assert.ok(translations['ku'][key], `Kurdish translation must exist for ${key}`);
    }
  });

  // =========================================================================
  // SECTION 2: REAL REPOSITORY & SERVICE INTEGRATION TESTS
  // =========================================================================

  const runId = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const tId = `t-cc-${runId}`;
  const pId = `p-cc-${runId}`;
  const oId = `o-cc-${runId}`;
  const cId = `c-cc-${runId}`;
  const adminId = `admin-cc-${runId}`;

  // Pre-seed test entities in PostgreSQL
  await db.insert(users).values([
    { id: tId, firstName: 'Tenant', lastName: 'CC', email: `${tId}@test.com`, roles: ['TENANT'] },
    { id: oId, firstName: 'Owner', lastName: 'CC', email: `${oId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: adminId, firstName: 'Admin', lastName: 'CC', email: `${adminId}@test.com`, roles: ['PLATFORM_ADMIN'] }
  ]);

  await db.insert(organizations).values({ id: cId, name: 'Mgmt Co CC', type: 'MANAGEMENT_COMPANY' });
  await db.insert(properties).values({
    id: pId,
    name: 'Command Center Test Property',
    type: 'APARTMENT',
    address: { city: 'Erbil', street: 'Gulan' },
    operatingModel: 'FULLY_MANAGED',
    rentFee: '0.05',
    managementFee: '0.10',
    currency: 'IQD'
  });

  await db.insert(ownershipRecords).values({
    propertyId: pId,
    ownerId: oId,
    ownershipPercentage: '100',
    status: 'VERIFIED'
  });

  await db.insert(managementAgreements).values({
    propertyId: pId,
    ownerId: oId,
    companyId: cId,
    startDate: '2026-01-01',
    status: 'ACTIVE',
    grantedPermissions: ['VIEW_FINANCIALS', 'COLLECT_RENT']
  });

  const [lease] = await db.insert(leases).values({
    propertyId: pId,
    startDate: '2026-11-01',
    endDate: '2027-11-01',
    rentAmount: '1000000',
    currency: 'IQD',
    status: 'ACTIVE'
  }).returning();

  await db.insert(leaseTenants).values({
    leaseId: lease.id,
    tenantId: tId,
    isPrimary: true
  });

  await db.transaction(async (tx) => {
    await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-11-01', '2027-11-01', 1000000);
  });

  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id)).orderBy(asc(rentSchedules.dueDate));
  const currentSched = schedules[0];

  await t.test('5. Requirement 1: A RECORDED but unconfirmed payment does NOT increase confirmed collected income', async () => {
    // Record payment via tenant repository (sets status = 'RECORDED' and increments schedule.paidAmount)
    const recResult = await tenantRepository.recordRentPayment(tId, {
      propertyId: pId,
      leaseId: lease.id,
      scheduleId: currentSched.id,
      amount: 1000000,
      currency: 'IQD',
      paymentMethod: 'CASH',
    });

    // Verify database schedule.paidAmount is NOT incremented upon unconfirmed recording
    const [schedInDb] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, currentSched.id));
    assert.strictEqual(Number(schedInDb.paidAmount), 0, 'Schedule paidAmount must NOT be prematurely incremented by unconfirmed recording');
    assert.strictEqual(schedInDb.status, 'UPCOMING', 'Schedule status must remain UPCOMING until payment is confirmed');

    // Authoritative summary MUST strictly report 0 confirmed collected income
    const summary = await propertyRepository.getAuthoritativeFinancialSummary(pId, currentSched.id);
    assert.strictEqual(summary.confirmedCollectedRent, 0, 'RECORDED payment must NOT increase confirmed collected rent');
    assert.strictEqual(summary.platformFeeAmount, 0, 'No fees may be calculated on unconfirmed payment');
    assert.strictEqual(summary.totalFeeAmount, 0, 'Total fees must be 0 for unconfirmed payment');
    assert.strictEqual(summary.ownerNetAmount, 0, 'Owner net must be 0 for unconfirmed payment');
    assert.strictEqual(summary.payoutStatus, 'NONE', 'Payout status must be NONE when no confirmed collections');

    // Clean up unconfirmed payment record for next step
    await db.delete(paymentRecords).where(eq(paymentRecords.id, recResult.payment.id));
    await db.update(rentSchedules).set({ paidAmount: '0', status: 'UPCOMING' }).where(eq(rentSchedules.id, currentSched.id));
  });

  await t.test('6. Requirement 2: A confirmed payment is counted exactly once', async () => {
    // Record and confirm payment
    const [pmt] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: currentSched.id,
      payerId: tId,
      amount: '1000000',
      currency: 'IQD',
      paymentMethod: 'CASH',
      status: 'CONFIRMED',
      recordedDate: '2026-10-02',
      receiptNumber: `RCP-${runId}-1`,
      idempotencyKey: `pay_${runId}_1`
    }).returning();

    const summary = await propertyRepository.getAuthoritativeFinancialSummary(pId, currentSched.id);
    assert.strictEqual(summary.confirmedCollectedRent, 1000000, 'Confirmed payment must be included');
    assert.strictEqual(summary.confirmedPaymentCount, 1, 'Payment counted exactly once');
    assert.strictEqual(summary.latestConfirmedPayment?.receiptNumber, `RCP-${runId}-1`, 'Latest receipt matches confirmed payment');

    // Clean up payment for following test
    await db.delete(paymentRecords).where(eq(paymentRecords.id, pmt.id));
  });

  await t.test('7. Requirement 3: Partial confirmed payment reports correct collected amount and fees', async () => {
    // Insert a partial payment of 400,000 IQD out of 1,000,000 IQD
    const [partialPmt] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: currentSched.id,
      payerId: tId,
      amount: '400000',
      currency: 'IQD',
      paymentMethod: 'CASH',
      status: 'CONFIRMED',
      recordedDate: '2026-10-03',
      receiptNumber: `RCP-${runId}-partial`,
      idempotencyKey: `pay_${runId}_partial`
    }).returning();

    const summary = await propertyRepository.getAuthoritativeFinancialSummary(pId, currentSched.id);
    assert.strictEqual(summary.confirmedCollectedRent, 400000, 'Partial payment of 400,000 must be reported');
    assert.strictEqual(summary.scheduledRentAmount, 1000000, 'Scheduled amount remains 1,000,000');
    // Platform fee from authoritative policy
    const expectedPlatformFee = Math.round(400000 * summary.platformFeeRate);
    assert.strictEqual(summary.platformFeeAmount, expectedPlatformFee, 'Platform fee calculated against partial collection');
    // Rent fee 5% of 400,000 = 20,000
    assert.strictEqual(summary.rentFeeAmount, 20000, 'Rent fee calculated against partial collection');
    // Mgmt fee 10% of 400,000 = 40,000
    assert.strictEqual(summary.managementFeeAmount, 40000, 'Management fee calculated against partial collection');
    // Total fees & Owner Net
    const expectedTotalFees = expectedPlatformFee + 20000 + 40000;
    assert.strictEqual(summary.totalFeeAmount, expectedTotalFees, 'Total fees sum correctly for partial payment');
    assert.strictEqual(summary.ownerNetAmount, 400000 - expectedTotalFees, 'Owner net calculated correctly for partial payment');

    // Clean up partial payment
    await db.delete(paymentRecords).where(eq(paymentRecords.id, partialPmt.id));
  });

  await t.test('8. Requirement 4: A reversed payment is excluded from net confirmed collections', async () => {
    const [revPmt] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: currentSched.id,
      payerId: tId,
      amount: '1000000',
      currency: 'IQD',
      paymentMethod: 'CASH',
      status: 'REVERSED', // Marked REVERSED
      recordedDate: '2026-10-04',
      idempotencyKey: `pay_${runId}_rev`
    }).returning();

    const summary = await propertyRepository.getAuthoritativeFinancialSummary(pId, currentSched.id);
    assert.strictEqual(summary.confirmedCollectedRent, 0, 'Reversed payment must be strictly excluded');
    assert.strictEqual(summary.totalFeeAmount, 0, 'No fees for reversed payment');
    assert.strictEqual(summary.ownerNetAmount, 0, 'Owner net is 0 when payment reversed');

    await db.delete(paymentRecords).where(eq(paymentRecords.id, revPmt.id));
  });

  await t.test('9. Requirement 5: A refunded payment is excluded from net confirmed collections', async () => {
    // Insert confirmed payment, then simulate refund by setting status to REFUNDED
    const [refPmt] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: currentSched.id,
      payerId: tId,
      amount: '1000000',
      currency: 'IQD',
      paymentMethod: 'CASH',
      status: 'REFUNDED', // Marked REFUNDED
      recordedDate: '2026-10-05',
      idempotencyKey: `pay_${runId}_ref`
    }).returning();

    // Even if schedule.paidAmount remained 1,000,000 in database:
    await db.update(rentSchedules).set({ paidAmount: '1000000' }).where(eq(rentSchedules.id, currentSched.id));

    const summary = await propertyRepository.getAuthoritativeFinancialSummary(pId, currentSched.id);
    assert.strictEqual(summary.confirmedCollectedRent, 0, 'Refunded payment must be excluded even if schedule.paidAmount is dirty');
    assert.strictEqual(summary.totalFeeAmount, 0, 'No fees for refunded payment');
    assert.strictEqual(summary.ownerNetAmount, 0, 'Owner net is 0 for refunded payment');

    await db.delete(paymentRecords).where(eq(paymentRecords.id, refPmt.id));
    await db.update(rentSchedules).set({ paidAmount: '0' }).where(eq(rentSchedules.id, currentSched.id));
  });

  await t.test('10. Requirement 6: Fee values match authoritative policy when platform rate differs from 2% (e.g. 3%)', async () => {
    // Dynamically set PLATFORM_FEE_RATE to 0.03 (3%) for this scenario, then restore
    const originalRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
    await db.update(financialPolicies).set({ policyValue: '0.03' }).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));

    try {
      const policyRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
      assert.strictEqual(policyRate, 0.03, 'Authoritative policy rate in DB must be 0.03 (3%)');

      const [pmt] = await db.insert(paymentRecords).values({
        propertyId: pId,
        leaseId: lease.id,
        rentScheduleId: currentSched.id,
        payerId: tId,
        amount: '1000000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        status: 'CONFIRMED',
        recordedDate: '2026-10-06',
        idempotencyKey: `pay_${runId}_policy`
      }).returning();

      const summary = await propertyRepository.getAuthoritativeFinancialSummary(pId, currentSched.id);
      assert.strictEqual(summary.platformFeeRate, 0.03, 'Platform fee rate must be 0.03 (not obsolete 0.02)');
      assert.strictEqual(summary.platformFeeAmount, 30000, 'Platform fee must be 30,000 IQD (3% of 1,000,000)');

      await db.delete(paymentRecords).where(eq(paymentRecords.id, pmt.id));
    } finally {
      await db.update(financialPolicies).set({ policyValue: originalRate.toString() }).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
    }
  });

  await t.test('11. Requirement 7: The three operating models respect applicable fee categories', () => {
    // Base amount: 1,000,000. Platform rate: 3%. Rent Fee: 5%. Mgmt Fee: 10%.
    // 1. FULLY_MANAGED: Platform (30,000) + Rent (50,000) + Mgmt (100,000) = 180,000. Net = 820,000
    const full = CommissionService.calculateFeesSync(1000000, 0.03, 'FULLY_MANAGED', 0.05, 0.10, 'IQD');
    assert.strictEqual(full.platformFeeAmount, 30000);
    assert.strictEqual(full.rentFeeAmount, 50000);
    assert.strictEqual(full.managementFeeAmount, 100000);
    assert.strictEqual(full.totalFeeAmount, 180000);
    assert.strictEqual(full.ownerNetAmount, 820000);

    // 2. AGENT_LISTED_PLATFORM_MANAGED: Platform (30,000) + Mgmt (100,000) = 130,000. Rent fee waived. Net = 870,000
    const agentListed = CommissionService.calculateFeesSync(1000000, 0.03, 'AGENT_LISTED_PLATFORM_MANAGED', 0.05, 0.10, 'IQD');
    assert.strictEqual(agentListed.platformFeeAmount, 30000);
    assert.strictEqual(agentListed.rentFeeAmount, 0, 'Rent fee must be waived');
    assert.strictEqual(agentListed.managementFeeAmount, 100000);
    assert.strictEqual(agentListed.totalFeeAmount, 130000);
    assert.strictEqual(agentListed.ownerNetAmount, 870000);

    // 3. AGENT_OPERATED: Platform fee only (30,000). Rent and Mgmt fees waived. Net = 970,000
    const agentOp = CommissionService.calculateFeesSync(1000000, 0.03, 'AGENT_OPERATED', 0.05, 0.10, 'IQD');
    assert.strictEqual(agentOp.platformFeeAmount, 30000);
    assert.strictEqual(agentOp.rentFeeAmount, 0, 'Rent fee must be waived');
    assert.strictEqual(agentOp.managementFeeAmount, 0, 'Management fee must be waived');
    assert.strictEqual(agentOp.totalFeeAmount, 30000);
    assert.strictEqual(agentOp.ownerNetAmount, 970000);
  });

  await t.test('12. Requirement 8: Historical posted fee records are not silently recalculated using current rates', async () => {
    // Post a commission with historical platform rate = 0.025 (2.5%)
    const [pmt] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: currentSched.id,
      payerId: tId,
      amount: '1000000',
      currency: 'IQD',
      paymentMethod: 'CASH',
      status: 'CONFIRMED',
      recordedDate: '2026-10-07',
      idempotencyKey: `pay_${runId}_hist`
    }).returning();

    const [je] = await db.insert(journalEntries).values({
      propertyId: pId,
      description: `Historical JE for ${pmt.id}`,
      date: '2026-10-07',
      referenceType: 'PAYMENT_RECORD',
      referenceId: pmt.id,
      status: 'POSTED',
      idempotencyKey: `je_hist_${runId}`
    }).returning();

    // Insert historical ledger lines: Platform (25,000), Rent (50,000), Mgmt (100,000), Owner Net (825,000)
    await db.insert(ledgerLines).values([
      { journalEntryId: je.id, accountId: '4010', debit: '0', credit: '25000', currency: 'IQD' },
      { journalEntryId: je.id, accountId: '4011', debit: '0', credit: '50000', currency: 'IQD' },
      { journalEntryId: je.id, accountId: '4012', debit: '0', credit: '100000', currency: 'IQD' },
      { journalEntryId: je.id, accountId: '2010', debit: '0', credit: '825000', currency: 'IQD' },
    ]);

    const [comm] = await db.insert(commissions).values({
      paymentRecordId: pmt.id,
      propertyId: pId,
      tenantId: tId,
      rate: '0.025', // Historical rate 2.5%
      baseAmount: '1000000',
      commissionAmount: '175000',
      currency: 'IQD',
      status: 'POSTED',
      journalEntryId: je.id,
      idempotencyKey: `comm_hist_${runId}`
    }).returning();

    // Summary MUST preserve historical rate (0.025) and historical ledger figures, not today's 0.03 policy!
    const summary = await propertyRepository.getAuthoritativeFinancialSummary(pId, currentSched.id);
    assert.strictEqual(summary.platformFeeRate, 0.025, 'Historical platform rate 0.025 must be preserved');
    assert.strictEqual(summary.platformFeeAmount, 25000, 'Historical platform fee from ledger (25,000) must be preserved');
    assert.strictEqual(summary.totalFeeAmount, 175000, 'Historical total fee (175,000) must be preserved');
    assert.strictEqual(summary.ownerNetAmount, 825000, 'Historical owner net from ledger (825,000) must be preserved');

    // Clean up
    await db.delete(commissions).where(eq(commissions.id, comm.id));
    await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id));
    await db.delete(journalEntries).where(eq(journalEntries.id, je.id));
    await db.delete(paymentRecords).where(eq(paymentRecords.id, pmt.id));
  });

  await t.test('13. Requirement 9: Owner entitlement is not represented as a completed payout', async () => {
    const [pmt] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: currentSched.id,
      payerId: tId,
      amount: '1000000',
      currency: 'IQD',
      paymentMethod: 'CASH',
      status: 'CONFIRMED',
      recordedDate: '2026-10-08',
      idempotencyKey: `pay_${runId}_ent`
    }).returning();

    const summary = await propertyRepository.getAuthoritativeFinancialSummary(pId, currentSched.id);
    assert.strictEqual(summary.payoutStatus, 'ENTITLEMENT_RECORDED', 'Must be ENTITLEMENT_RECORDED, never COMPLETED');
    assert.notStrictEqual(summary.payoutStatus, 'COMPLETED', 'Owner entitlement must NOT be marked as COMPLETED payout');

    await db.delete(paymentRecords).where(eq(paymentRecords.id, pmt.id));
  });

  await t.test('14. Requirement 10: Property-level authorization remains enforced', async () => {
    // Verified Owner has permission
    const hasOwnerAuth = await ownerRepository.verifyPropertyPermission(
      { id: oId, roles: [UserRole.PROPERTY_OWNER] } as any,
      pId,
      Permission.VIEW_FINANCIALS
    );
    assert.strictEqual(hasOwnerAuth, true, 'Verified owner must have VIEW_FINANCIALS authority');

    // Managing Company with active agreement has permission
    const hasCompanyAuth = await ownerRepository.verifyPropertyPermission(
      { id: 'random-company-user', roles: [UserRole.COMPANY], organizationId: cId } as any,
      pId,
      Permission.VIEW_FINANCIALS
    );
    assert.strictEqual(hasCompanyAuth, true, 'Managing company with active agreement must have VIEW_FINANCIALS authority');

    // Unrelated third-party user is denied
    const hasUnrelatedAuth = await ownerRepository.verifyPropertyPermission(
      { id: 'random-user-attacker', roles: [UserRole.TENANT] } as any,
      pId,
      Permission.VIEW_FINANCIALS
    );
    assert.strictEqual(hasUnrelatedAuth, false, 'Unrelated user must be rejected with no access to financials');
  });

  await t.test('15. Requirement 11: Empty or unavailable financial data never produces fabricated figures', async () => {
    // Vacant property without leases
    const vacantPropId = `p-vacant-${runId}`;
    await db.insert(properties).values({
      id: vacantPropId,
      name: 'Vacant Property',
      type: 'HOUSE',
      address: {},
      operatingModel: 'FULLY_MANAGED'
    });

    const summary = await propertyRepository.getAuthoritativeFinancialSummary(vacantPropId);
    assert.strictEqual(summary.hasActiveLease, false, 'Must report no active lease');
    assert.strictEqual(summary.scheduledRentAmount, 0, 'Scheduled rent must be 0');
    assert.strictEqual(summary.confirmedCollectedRent, 0, 'Collected rent must be 0');
    assert.strictEqual(summary.totalFeeAmount, 0, 'Total fees must be 0');
    assert.strictEqual(summary.ownerNetAmount, 0, 'Owner net must be 0');
    assert.strictEqual(summary.currentSchedule, null, 'Schedule must be null');
    assert.strictEqual(summary.latestConfirmedPayment, null, 'Latest payment must be null');

    await db.delete(properties).where(eq(properties.id, vacantPropId));
  });

  // Final cleanup of test suite records
  await db.delete(paymentRecords).where(eq(paymentRecords.leaseId, lease.id)).catch(() => {});
  await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, lease.id)).catch(() => {});
  await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lease.id)).catch(() => {});
  await db.delete(leases).where(eq(leases.id, lease.id)).catch(() => {});
  await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, pId)).catch(() => {});
  await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, pId)).catch(() => {});
  await db.delete(properties).where(eq(properties.id, pId)).catch(() => {});
  await db.delete(organizations).where(eq(organizations.id, cId)).catch(() => {});
  await db.delete(users).where(eq(users.id, tId)).catch(() => {});
  await db.delete(users).where(eq(users.id, oId)).catch(() => {});
  await db.delete(users).where(eq(users.id, adminId)).catch(() => {});
});
