import { test } from 'node:test';
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
} from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { ownerRepository } from '../src/server/repositories/owner.js';

process.env.SQL_HOST = 'localhost';

test('Owner Dashboard Monthly Revenue Accuracy & Regression Suite', async (t) => {
  const runId = Date.now().toString(36) + Math.floor(Math.random() * 10000);
  const oId = `o-rev-${runId}`;
  const pId = `p-rev-${runId}`;
  const tId = `t-rev-${runId}`;
  const cId = `c-rev-${runId}`;

  // Time boundaries relative to current UTC month
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-indexed

  const currentMonthKey = now.toISOString().slice(0, 7); // 'YYYY-MM'
  const currentMonthStart = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(currentYear, currentMonth + 1, 1, 0, 0, 0, 0));

  // Mid current month date (e.g. 15th at noon UTC)
  const currentMonthMidDate = new Date(Date.UTC(currentYear, currentMonth, 15, 12, 0, 0, 0)).toISOString();

  // Previous month mid date (15th of previous month)
  const prevMonthDate = new Date(Date.UTC(currentYear, currentMonth - 1, 15, 12, 0, 0, 0)).toISOString();

  // Boundary timestamps:
  // Millisecond immediately preceding current month start (last ms of previous month)
  const exactPrevMonthEndMs = new Date(currentMonthStart.getTime() - 1).toISOString();
  // Millisecond exact start of current month
  const exactCurrentMonthStartMs = currentMonthStart.toISOString();
  // Millisecond exact end of current month (last ms before next month start)
  const exactCurrentMonthEndMs = new Date(nextMonthStart.getTime() - 1).toISOString();
  // Millisecond exact start of next month
  const exactNextMonthStartMs = nextMonthStart.toISOString();

  // 1. Seed base entities in PostgreSQL
  await db.insert(users).values([
    { id: oId, firstName: 'Owner', lastName: 'Rev', email: `${oId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: tId, firstName: 'Tenant', lastName: 'Rev', email: `${tId}@test.com`, roles: ['TENANT'] },
  ]);

  await db.insert(organizations).values({
    id: cId,
    name: 'Rev Management Co',
    type: 'MANAGEMENT_COMPANY',
  });

  await db.insert(properties).values({
    id: pId,
    name: 'Revenue Audit Property',
    type: 'APARTMENT',
    address: { city: 'Erbil' },
    operatingModel: 'FULLY_MANAGED',
    managementFee: '0.05',
    rentFee: '0.05',
  });

  await db.insert(ownershipRecords).values({
    propertyId: pId,
    ownerId: oId,
    ownershipPercentage: '100',
    status: 'VERIFIED',
  });

  await db.insert(managementAgreements).values({
    propertyId: pId,
    ownerId: oId,
    companyId: cId,
    startDate: '2026-01-01',
    status: 'ACTIVE',
    grantedPermissions: [],
  });

  const [lease] = await db.insert(leases).values({
    propertyId: pId,
    startDate: `${currentMonthKey}-01`,
    endDate: '2027-12-31',
    rentAmount: '1000000',
    status: 'ACTIVE',
  }).returning();

  await db.insert(leaseTenants).values({
    leaseId: lease.id,
    tenantId: tId,
    isPrimary: true,
  });

  const [sched] = await db.insert(rentSchedules).values({
    leaseId: lease.id,
    propertyId: pId,
    tenantId: tId,
    amount: '1000000',
    dueDate: `${currentMonthKey}-01`,
    periodStart: `${currentMonthKey}-01`,
    periodEnd: `${currentMonthKey}-28`,
    status: 'UPCOMING',
  }).returning();

  // =========================================================================
  // TEST 7: Empty months return a truthful zero
  // =========================================================================
  await t.test('7. Empty months return a truthful zero and awaiting verification status', async () => {
    const dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 0, 'KPI monthly revenue must be 0 when no confirmed collections exist');
    assert.strictEqual(dash.kpis.revenueChangeText, 'Awaiting payment verification', 'Status text must truthfully state awaiting verification');
  });

  // =========================================================================
  // TEST 1: A confirmed payment within the current month is included
  // =========================================================================
  let pCurrentMidId = '';
  await t.test('1. A confirmed payment within the current month is included in monthlyRevenueIqd', async () => {
    const [p] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: sched.id,
      payerId: tId,
      amount: '1000000',
      currency: 'IQD',
      status: 'CONFIRMED',
      recordedDate: currentMonthMidDate,
    }).returning();
    pCurrentMidId = p.id;

    const dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 1000000, 'Current month confirmed payment must be included');
    assert.strictEqual(dash.kpis.revenueChangeText, 'Verified rent roll', 'KPI label reflects verified rent roll');
  });

  // =========================================================================
  // TEST 2: A confirmed payment in the previous month is excluded
  // =========================================================================
  await t.test('2. A confirmed payment in the previous month is excluded from monthlyRevenueIqd', async () => {
    await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      payerId: tId,
      amount: '500000',
      currency: 'IQD',
      status: 'CONFIRMED',
      recordedDate: prevMonthDate,
    });

    const dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    // Must remain 1,000,000 (previous month's 500,000 excluded)
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 1000000, 'Historical confirmed payment from previous month must be excluded');
  });

  // =========================================================================
  // TEST 3: Exact month boundary payments handled correctly
  // =========================================================================
  await t.test('3. Exact month boundary payments are correctly included or excluded', async () => {
    // 3a. Exact previous month end millisecond (e.g. 2026-09-30T23:59:59.999Z) -> EXCLUDED
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '111000',
      currency: 'IQD',
      status: 'CONFIRMED',
      recordedDate: exactPrevMonthEndMs,
    });

    let dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 1000000, 'Payment at previous month end millisecond must be excluded');

    // 3b. Exact current month start millisecond (e.g. 2026-10-01T00:00:00.000Z) -> INCLUDED
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '200000',
      currency: 'IQD',
      status: 'CONFIRMED',
      recordedDate: exactCurrentMonthStartMs,
    });

    dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 1200000, 'Payment at exact start of current month must be included');

    // 3c. Exact current month end millisecond (e.g. 2026-10-31T23:59:59.999Z) -> INCLUDED
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '300000',
      currency: 'IQD',
      status: 'CONFIRMED',
      recordedDate: exactCurrentMonthEndMs,
    });

    dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 1500000, 'Payment at exact end millisecond of current month must be included');

    // 3d. Exact next month start millisecond (e.g. 2026-11-01T00:00:00.000Z) -> EXCLUDED
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '444000',
      currency: 'IQD',
      status: 'CONFIRMED',
      recordedDate: exactNextMonthStartMs,
    });

    dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 1500000, 'Payment at exact start millisecond of next month must be excluded');
  });

  // =========================================================================
  // TEST 4: Pending and recorded payments are excluded
  // =========================================================================
  await t.test('4. Pending and recorded payments within the current month are excluded', async () => {
    // RECORDED payment (awaiting confirmation)
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '50000',
      currency: 'IQD',
      status: 'RECORDED',
      recordedDate: currentMonthMidDate,
    });

    // PENDING payment
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '60000',
      currency: 'IQD',
      status: 'PENDING',
      recordedDate: currentMonthMidDate,
    });

    // FAILED payment
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '70000',
      currency: 'IQD',
      status: 'FAILED',
      recordedDate: currentMonthMidDate,
    });

    // CANCELLED payment
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '80000',
      currency: 'IQD',
      status: 'CANCELLED',
      recordedDate: currentMonthMidDate,
    });

    const dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 1500000, 'Unconfirmed, pending, failed, or cancelled payments must not count towards revenue');
  });

  // =========================================================================
  // TEST 5: Reversed and refunded payments are excluded
  // =========================================================================
  await t.test('5. Reversed and refunded payments within current month are excluded', async () => {
    // Standalone REVERSED payment record
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '90000',
      currency: 'IQD',
      status: 'REVERSED',
      recordedDate: currentMonthMidDate,
    });

    // Standalone REFUNDED payment record
    await db.insert(paymentRecords).values({
      propertyId: pId,
      payerId: tId,
      amount: '95000',
      currency: 'IQD',
      status: 'REFUNDED',
      recordedDate: currentMonthMidDate,
    });

    let dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 1500000, 'REVERSED and REFUNDED records must not be counted in revenue');

    // Dynamic refund transition: refund the initial 1,000,000 payment
    await db.update(paymentRecords).set({ status: 'REFUNDED' }).where(eq(paymentRecords.id, pCurrentMidId));

    dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    // Was 1,500,000 - 1,000,000 = 500,000 (the 200,000 boundary start + 300,000 boundary end remain)
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 500000, 'Refunding a confirmed payment immediately reduces current month revenue');
  });

  // =========================================================================
  // TEST 6: Multiple eligible payments are counted exactly once
  // =========================================================================
  await t.test('6. Multiple eligible confirmed payments in current month are counted exactly once', async () => {
    await db.insert(paymentRecords).values([
      {
        propertyId: pId,
        payerId: tId,
        amount: '100000',
        currency: 'IQD',
        status: 'CONFIRMED',
        recordedDate: currentMonthMidDate,
      },
      {
        propertyId: pId,
        payerId: tId,
        amount: '150000',
        currency: 'IQD',
        status: 'CONFIRMED',
        recordedDate: currentMonthMidDate,
      },
    ]);

    const dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    // 500,000 + 100,000 + 150,000 = 750,000
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 750000, 'Multiple payments must be summed without double-counting');
  });

  // =========================================================================
  // TEST 8: Scope isolation (unauthorized property payments excluded)
  // =========================================================================
  await t.test('8. Existing owner/company scope isolation remains intact', async () => {
    const oOtherId = `o-other-${runId}`;
    const pOtherId = `p-other-${runId}`;

    await db.insert(users).values({
      id: oOtherId,
      firstName: 'Other',
      lastName: 'Owner',
      email: `${oOtherId}@test.com`,
      roles: ['PROPERTY_OWNER'],
    });

    await db.insert(properties).values({
      id: pOtherId,
      name: 'Unrelated Property',
      type: 'VILLA',
      address: { city: 'Sulaymaniyah' },
    });

    await db.insert(ownershipRecords).values({
      propertyId: pOtherId,
      ownerId: oOtherId,
      ownershipPercentage: '100',
      status: 'VERIFIED',
    });

    // Insert large payment on other owner's property
    await db.insert(paymentRecords).values({
      propertyId: pOtherId,
      payerId: tId,
      amount: '5000000',
      currency: 'IQD',
      status: 'CONFIRMED',
      recordedDate: currentMonthMidDate,
    });

    // Owner 1 dashboard must NOT see Owner 2's payment
    const dash1 = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash1.kpis.monthlyRevenueIqd, 750000, 'Owner 1 must not see revenue from unauthorized properties');

    // Owner 2 dashboard must see only their own payment
    const dash2 = await ownerRepository.getAuthoritativeDashboard({ id: oOtherId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(dash2.kpis.monthlyRevenueIqd, 5000000, 'Owner 2 must see only their authorized property revenue');
  });

  // =========================================================================
  // TEST 9: KPI meaning remains consistent with its label
  // =========================================================================
  await t.test('9. KPI meaning remains gross confirmed rent collected and consistent with product rules', async () => {
    const dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });

    // The KPI is gross verified collected rent for the month
    assert.strictEqual(dash.kpis.monthlyRevenueIqd, 750000, 'monthlyRevenueIqd preserves gross confirmed collected rent');
    assert.strictEqual(dash.kpis.revenueChangeText, 'Verified rent roll', 'Positive revenue displays Verified rent roll');

    // Management fees and net deductions belong to the authoritative financial breakdown
    const finances = await ownerRepository.getAuthoritativeFinances({ id: oId, roles: ['PROPERTY_OWNER'] }, pId);
    assert.ok(typeof finances.summary.net === 'number', 'Net income is tracked in authoritative finances summary');
    assert.ok(typeof finances.summary.managementFees === 'number', 'Fees are tracked in authoritative finances summary');
  });
});
