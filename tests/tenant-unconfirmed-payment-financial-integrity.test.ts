import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, ownershipRecords, commissions, financialPolicies } from '../src/db/schema.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { propertyRepository } from '../src/server/repositories/properties.js';
import { commissionService } from '../src/server/services/commission.js';
import { eq, and, asc } from 'drizzle-orm';

process.env.SQL_HOST = 'localhost';

test('Tenant Unconfirmed Payment Financial Integrity Suite', async (t) => {
  const runId = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const tenantId = `t-integ-${runId}`;
  const ownerId = `o-integ-${runId}`;
  const adminId = `admin-integ-${runId}`;
  const propId = `p-integ-${runId}`;
  
  // 1. Seed base users and property
  await db.insert(users).values([
    { id: tenantId, firstName: 'Tenant', lastName: 'User', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    { id: ownerId, firstName: 'Owner', lastName: 'User', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: adminId, firstName: 'Admin', lastName: 'User', email: `${adminId}@test.com`, roles: ['PLATFORM_ADMIN'] }
  ]);

  await db.insert(properties).values({
    id: propId,
    name: 'Integrity Prop',
    type: 'RESIDENTIAL',
    operatingModel: 'DIRECT_RENTAL',
    status: 'ACTIVE'
  });

  await db.insert(ownershipRecords).values({
    propertyId: propId,
    ownerId: ownerId,
    ownershipPercentage: '100',
    status: 'VERIFIED'
  });

  // Ensure active 3-Fee policy exists
  await db.insert(financialPolicies).values({
    policyType: 'PLATFORM_FEE_RATE',
    policyValue: '0.02',
    active: true,
    effectiveFrom: new Date()
  }).onConflictDoNothing();

  // Create lease and rent schedules (1,000,000 IQD per month)
  const [lease] = await db.insert(leases).values({
    propertyId: propId,
    startDate: '2026-11-01',
    endDate: '2027-11-01',
    rentAmount: '1000000',
    status: 'ACTIVE'
  }).returning();

  await db.insert(leaseTenants).values({
    leaseId: lease.id,
    tenantId: tenantId,
    isPrimary: true
  });

  await db.transaction(async (tx) => {
    await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-11-01', '2027-11-01', 1000000);
  });

  const schedules = await db.select().from(rentSchedules)
    .where(eq(rentSchedules.leaseId, lease.id))
    .orderBy(asc(rentSchedules.dueDate));
  
  const schedule1 = schedules[0];
  const schedule2 = schedules[1];

  // --------------------------------------------------------------------------
  // Requirement 1: Recording a RECORDED payment leaves schedule paidAmount and status unchanged
  // --------------------------------------------------------------------------
  let unconfirmedPaymentResult: any;
  await t.test('1. Recording a RECORDED payment leaves schedule paidAmount and status unchanged', async () => {
    unconfirmedPaymentResult = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: propId,
      leaseId: lease.id,
      scheduleId: schedule1.id,
      amount: 400000,
      currency: 'IQD',
      paymentMethod: 'FIB',
      referenceNumber: `FIB-${runId}-1`,
    });

    assert.strictEqual(unconfirmedPaymentResult.payment.status, 'RECORDED', 'Payment record status must be RECORDED');

    // Inspect rent schedule directly from database
    const [sched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule1.id));
    assert.strictEqual(Number(sched.paidAmount || 0), 0, 'Schedule paidAmount must remain 0 when payment is unconfirmed');
    assert.strictEqual(sched.status, 'UPCOMING', 'Schedule status must remain UPCOMING when payment is unconfirmed');

    // Authoritative financial summary must report 0 confirmed collected rent and 0 fees
    const summary = await propertyRepository.getAuthoritativeFinancialSummary(propId, schedule1.id);
    assert.strictEqual(summary.confirmedCollectedRent, 0, 'Summary must report 0 confirmed collected rent');
    assert.strictEqual(summary.platformFeeAmount, 0, 'No platform fee may be generated on unconfirmed payment');
  });

  // --------------------------------------------------------------------------
  // Requirement 2 & 3: A partial confirmed payment updates schedule to PARTIALLY_PAID with correct balance
  // --------------------------------------------------------------------------
  await t.test('2 & 3. Partial confirmed payment transitions schedule to PARTIALLY_PAID with correct balance', async () => {
    // Confirm the 400,000 IQD payment via leaseRepository.confirmPayment
    const confirmedPmt = await leaseRepository.confirmPayment(unconfirmedPaymentResult.payment.id, adminId);
    assert.strictEqual(confirmedPmt.status, 'CONFIRMED', 'Payment status must be CONFIRMED');

    const [sched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule1.id));
    assert.strictEqual(Number(sched.paidAmount), 400000, 'Schedule paidAmount must reflect confirmed 400,000 IQD');
    assert.strictEqual(sched.status, 'PARTIALLY_PAID', 'Schedule status must transition to PARTIALLY_PAID');

    // Post fees on confirmed payment
    await commissionService.postCommissionForPayment(confirmedPmt.id, adminId);

    const summary = await propertyRepository.getAuthoritativeFinancialSummary(propId, schedule1.id);
    assert.strictEqual(summary.confirmedCollectedRent, 400000, 'Confirmed collected rent must equal 400,000 IQD');
    assert.strictEqual(summary.platformFeeAmount, Math.round(400000 * summary.platformFeeRate), `Platform fee must match policy rate (${summary.platformFeeRate})`);
  });

  // --------------------------------------------------------------------------
  // Requirement 4: A second payment completing the balance marks the schedule PAID
  // --------------------------------------------------------------------------
  let secondPaymentResult: any;
  await t.test('4. Second confirmed payment completing the balance transitions schedule to PAID', async () => {
    // Tenant pays remaining 600,000 IQD
    secondPaymentResult = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: propId,
      leaseId: lease.id,
      scheduleId: schedule1.id,
      amount: 600000,
      currency: 'IQD',
      paymentMethod: 'FIB',
      referenceNumber: `FIB-${runId}-2`,
    });

    // Before confirmation: paidAmount remains 400,000 IQD
    let [sched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule1.id));
    assert.strictEqual(Number(sched.paidAmount), 400000, 'Schedule paidAmount must not increment before second payment is confirmed');
    assert.strictEqual(sched.status, 'PARTIALLY_PAID', 'Schedule status must remain PARTIALLY_PAID before confirmation');

    // Confirm the second payment
    await leaseRepository.confirmPayment(secondPaymentResult.payment.id, adminId);
    await commissionService.postCommissionForPayment(secondPaymentResult.payment.id, adminId);

    // After confirmation: paidAmount becomes 1,000,000 IQD and status becomes PAID
    [sched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule1.id));
    assert.strictEqual(Number(sched.paidAmount), 1000000, 'Schedule paidAmount must equal full 1,000,000 IQD');
    assert.strictEqual(sched.status, 'PAID', 'Schedule status must transition to PAID');

    const summary = await propertyRepository.getAuthoritativeFinancialSummary(propId, schedule1.id);
    assert.strictEqual(summary.confirmedCollectedRent, 1000000, 'Total confirmed collected rent must equal 1,000,000 IQD');
    assert.strictEqual(summary.platformFeeAmount, Math.round(1000000 * summary.platformFeeRate), `Total platform fee must match policy rate (${summary.platformFeeRate})`);
  });

  // --------------------------------------------------------------------------
  // Requirement 5: Duplicate confirmation does not double-count payment
  // --------------------------------------------------------------------------
  await t.test('5. Duplicate confirmation is idempotent and does not double-count payment', async () => {
    // Attempt re-confirming already confirmed payment
    const reconfirmed = await leaseRepository.confirmPayment(secondPaymentResult.payment.id, adminId);
    assert.strictEqual(reconfirmed.status, 'CONFIRMED', 'Reconfirm returns confirmed payment');

    const [sched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule1.id));
    assert.strictEqual(Number(sched.paidAmount), 1000000, 'Schedule paidAmount must remain exactly 1,000,000 IQD without double-counting');
    assert.strictEqual(sched.status, 'PAID', 'Schedule status must remain PAID');
  });

  // --------------------------------------------------------------------------
  // Requirement 6: A failed or rejected payment does not reduce outstanding rent
  // --------------------------------------------------------------------------
  await t.test('6. A failed or rejected payment does not reduce outstanding rent', async () => {
    const failedResult = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: propId,
      leaseId: lease.id,
      scheduleId: schedule2.id,
      amount: 500000,
      currency: 'IQD',
      paymentMethod: 'FIB',
      referenceNumber: `FIB-${runId}-FAIL`,
    });

    // Simulate gateway failure: mark payment FAILED
    await db.update(paymentRecords)
      .set({ status: 'FAILED' })
      .where(eq(paymentRecords.id, failedResult.payment.id));

    // Confirm schedule 2 is unaffected
    const [sched2] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule2.id));
    assert.strictEqual(Number(sched2.paidAmount || 0), 0, 'Failed payment must not reduce outstanding rent');
    assert.strictEqual(sched2.status, 'UPCOMING', 'Schedule status must remain UPCOMING');
  });

  // --------------------------------------------------------------------------
  // Requirement 7: Reversal reconciles the schedule and financial history
  // --------------------------------------------------------------------------
  await t.test('7. Reversal reconciles schedule paidAmount and status strictly to remaining confirmed funds', async () => {
    // Reversing second payment (600,000 IQD) leaves first payment (400,000 IQD) confirmed
    await db.update(paymentRecords)
      .set({ status: 'REVERSED' })
      .where(eq(paymentRecords.id, secondPaymentResult.payment.id));

    // Recalculate schedule strictly from remaining confirmed payments
    const confirmedPayments = await db.select({ amount: paymentRecords.amount })
      .from(paymentRecords)
      .where(and(
        eq(paymentRecords.rentScheduleId, schedule1.id),
        eq(paymentRecords.status, 'CONFIRMED')
      ));

    const confirmedPaidAmount = confirmedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const newStatus = confirmedPaidAmount >= Number(schedule1.amount)
      ? 'PAID'
      : confirmedPaidAmount > 0
        ? 'PARTIALLY_PAID'
        : 'UPCOMING';

    await db.update(rentSchedules)
      .set({ paidAmount: confirmedPaidAmount.toString(), status: newStatus })
      .where(eq(rentSchedules.id, schedule1.id));

    const [sched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule1.id));
    assert.strictEqual(Number(sched.paidAmount), 400000, 'Schedule paidAmount must drop back to 400,000 IQD after reversal');
    assert.strictEqual(sched.status, 'PARTIALLY_PAID', 'Schedule status must revert back to PARTIALLY_PAID');
  });

  // --------------------------------------------------------------------------
  // Requirement 8: Direct manager-recorded payment behavior remains compatible
  // --------------------------------------------------------------------------
  await t.test('8. Existing direct manager-recorded payment behavior remains compatible', async () => {
    const mgrPayment = await leaseRepository.recordPayment(
      propId,
      lease.id,
      tenantId,
      schedule2.id,
      300000,
      'CASH',
      `MGR-REF-${runId}`,
      ownerId
    );

    assert.ok(mgrPayment.id, 'Manager payment must be recorded');

    // INVARIANT (Phase 32 / F-02 Remediation):
    // Prior to confirmation, unconfirmed payment leaves schedule paidAmount and status unchanged
    const [sched2Before] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule2.id));
    assert.strictEqual(Number(sched2Before.paidAmount || 0), 0, 'Unconfirmed manager payment leaves schedule paidAmount at 0');
    assert.strictEqual(sched2Before.status, 'UPCOMING', 'Unconfirmed manager payment leaves schedule status at UPCOMING');

    // Confirm via leaseRepository.confirmPayment
    await leaseRepository.confirmPayment(mgrPayment.id, ownerId);

    const [sched2] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule2.id));
    assert.strictEqual(Number(sched2.paidAmount), 300000, 'Direct manager payment updates schedule paidAmount upon confirmation');
    assert.strictEqual(sched2.status, 'PARTIALLY_PAID', 'Schedule status is PARTIALLY_PAID upon confirmation');
  });

  // --------------------------------------------------------------------------
  // Requirement 9: Authorization and overpayment guards remain enforced
  // --------------------------------------------------------------------------
  await t.test('9. Authorization and overpayment guards remain enforced', async () => {
    // Attempt payment for schedule exceeding remaining due
    await assert.rejects(
      async () => {
        await tenantRepository.recordRentPayment(tenantId, {
          propertyId: propId,
          leaseId: lease.id,
          scheduleId: schedule2.id,
          amount: 800000, // Remaining due is 700,000 IQD
          currency: 'IQD',
          paymentMethod: 'FIB',
        });
      },
      (err: any) => err.message === 'Payment amount exceeds remaining rent due',
      'Must reject payment exceeding remaining rent due'
    );
  });

  // --------------------------------------------------------------------------
  // Requirement 10: Multiple pending RECORDED claims cannot collectively exceed schedule capacity
  // --------------------------------------------------------------------------
  await t.test('10. Multiple pending RECORDED claims cannot collectively bypass overpayment rule, and concurrent submissions serialize', async () => {
    const schedule3 = schedules[2];
    assert.ok(schedule3, 'Schedule 3 must exist');

    // 1. Submit first valid unconfirmed claim of 600,000 IQD
    const claim1 = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: propId,
      leaseId: lease.id,
      scheduleId: schedule3.id,
      amount: 600000,
      currency: 'IQD',
      paymentMethod: 'FIB',
      referenceNumber: `FIB-AGG-1-${runId}`,
    });
    assert.strictEqual(claim1.payment.status, 'RECORDED');

    // Schedule 3 paidAmount remains 0
    let [sched3] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule3.id));
    assert.strictEqual(Number(sched3.paidAmount || 0), 0);

    // 2. Submit second claim of 500,000 IQD (600k + 500k = 1,100,000 > 1,000,000)
    // Must be rejected because aggregate pending claims exceed total schedule amount
    await assert.rejects(
      async () => {
        await tenantRepository.recordRentPayment(tenantId, {
          propertyId: propId,
          leaseId: lease.id,
          scheduleId: schedule3.id,
          amount: 500000,
          currency: 'IQD',
          paymentMethod: 'FIB',
          referenceNumber: `FIB-AGG-2-${runId}`,
        });
      },
      (err: any) => err.message === 'Payment amount exceeds remaining rent due',
      'Must reject second pending claim that would cause aggregate to exceed total rent due'
    );

    // 3. Submit second claim of exactly remaining 400,000 IQD (600k + 400k = 1,000,000)
    const claim2 = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: propId,
      leaseId: lease.id,
      scheduleId: schedule3.id,
      amount: 400000,
      currency: 'IQD',
      paymentMethod: 'FIB',
      referenceNumber: `FIB-AGG-3-${runId}`,
    });
    assert.strictEqual(claim2.payment.status, 'RECORDED');

    // 4. Any further claim even for 1 IQD must be rejected as capacity is fully committed
    await assert.rejects(
      async () => {
        await tenantRepository.recordRentPayment(tenantId, {
          propertyId: propId,
          leaseId: lease.id,
          scheduleId: schedule3.id,
          amount: 1,
          currency: 'IQD',
          paymentMethod: 'FIB',
          referenceNumber: `FIB-AGG-4-${runId}`,
        });
      },
      (err: any) => err.message === 'Payment amount exceeds remaining rent due',
      'Must reject any claim once schedule capacity is fully committed by pending claims'
    );

    // 5. Concurrent submission race: simulate 2 concurrent claims on schedule 4
    const schedule4 = schedules[3];
    assert.ok(schedule4, 'Schedule 4 must exist');

    // Two concurrent submissions of 600,000 IQD each on a 1,000,000 schedule: exactly one can succeed
    const results = await Promise.allSettled([
      tenantRepository.recordRentPayment(tenantId, {
        propertyId: propId,
        leaseId: lease.id,
        scheduleId: schedule4.id,
        amount: 600000,
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: `FIB-RACE-1-${runId}`,
      }),
      tenantRepository.recordRentPayment(tenantId, {
        propertyId: propId,
        leaseId: lease.id,
        scheduleId: schedule4.id,
        amount: 600000,
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: `FIB-RACE-2-${runId}`,
      })
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent submission must succeed');
    assert.strictEqual(rejected.length, 1, 'The competing concurrent submission exceeding capacity must be rejected');

    const [sched4] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule4.id));
    assert.strictEqual(Number(sched4.paidAmount || 0), 0, 'Schedule 4 paidAmount remains 0 on unconfirmed concurrent race');
  });

  // --------------------------------------------------------------------------
  // Requirement 11: Failure during confirmation leaves no partial schedule mutations
  // --------------------------------------------------------------------------
  await t.test('11. Confirmation failure rolls back cleanly without mutating rent schedule', async () => {
    const schedule5 = schedules[4];
    assert.ok(schedule5, 'Schedule 5 must exist');

    // Create an unconfirmed payment
    const claim = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: propId,
      leaseId: lease.id,
      scheduleId: schedule5.id,
      amount: 500000,
      currency: 'IQD',
      paymentMethod: 'FIB',
      referenceNumber: `FIB-ROLLBACK-${runId}`,
    });

    // Verify confirmation of a non-existent payment fails closed
    await assert.rejects(
      async () => {
        await leaseRepository.confirmPayment('00000000-0000-0000-0000-000000000000', adminId);
      },
      (err: any) => err.message === 'Payment not found',
      'Confirming non-existent payment throws Payment not found'
    );

    // Schedule 5 paidAmount remains 0
    const [sched5] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule5.id));
    assert.strictEqual(Number(sched5.paidAmount || 0), 0, 'Schedule 5 paidAmount remains 0');
    assert.strictEqual(sched5.status, 'UPCOMING', 'Schedule 5 status remains UPCOMING');
  });
});

