import './safe-test-env.js';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants, leaseRenewals, rentSchedules, paymentRecords, auditLogs } from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { leaseRepository, LeaseRepository } from '../src/server/repositories/leases.js';
import { CommissionService } from '../src/server/services/commission.js';
import leasesRouter from '../src/server/routes/leases.js';

// ============================================================================
// HARD FAIL-CLOSED SAFETY GATE
// Strictly target local homehub_test exclusively
// ============================================================================
const TARGET_TEST_DATABASE = 'homehub_test';

function assertSafeDatabaseConfig(): void {
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    throw new Error(`HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly '${TARGET_TEST_DATABASE}'. Got: '${targetDb || 'UNSET'}'. Aborting.`);
  }

  if (process.env.DATABASE_URL) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(process.env.DATABASE_URL);
    } catch {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL is malformed. Aborting.`);
    }

    if (parsedUrl.pathname !== `/${TARGET_TEST_DATABASE}`) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL pathname must be '/${TARGET_TEST_DATABASE}'. Got: '${parsedUrl.pathname}'. Aborting.`);
    }
  }
}

function getAuthHeader(actor: { id: string; roles: string[] }): string {
  const payload = { uid: actor.id, role: actor.roles[0] };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

test('Focused Lease Renewal and Payment Reversal Verification Suite (homehub_test)', async (t) => {
  assertSafeDatabaseConfig();

  // Verify real PostgreSQL connection
  const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name, current_user as db_user`);
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(activeDb, TARGET_TEST_DATABASE, `Must be connected to '${TARGET_TEST_DATABASE}'. Got: '${activeDb}'`);

  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdRenewalIds: string[] = [];
  const createdPaymentIds: string[] = [];

  async function cleanupFixtures() {
    for (const renId of createdRenewalIds) {
      await db.delete(leaseRenewals).where(eq(leaseRenewals.id, renId)).catch(() => { });
    }
    for (const pId of createdPaymentIds) {
      await db.delete(paymentRecords).where(eq(paymentRecords.id, pId)).catch(() => { });
    }
    for (const leaseId of createdLeaseIds) {
      await db.delete(paymentRecords).where(eq(paymentRecords.leaseId, leaseId)).catch(() => { });
      await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseId)).catch(() => { });
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId)).catch(() => { });
      await db.delete(leases).where(eq(leases.id, leaseId)).catch(() => { });
    }
    for (const propId of createdPropertyIds) {
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => { });
      await db.delete(properties).where(eq(properties.id, propId)).catch(() => { });
    }
    for (const userId of createdUserIds) {
      await db.delete(users).where(eq(users.id, userId)).catch(() => { });
    }
  }

  t.after(async () => {
    await cleanupFixtures();
  });

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/leases', leasesRouter);

  const leaseRepo = new LeaseRepository();
  const commissionService = new CommissionService();

  // --------------------------------------------------------------------------
  // COVERAGE 1: Reverse a payment, then approve a mid-lease renewal
  // --------------------------------------------------------------------------
  await t.test('1. Reverse a payment, then approve a mid-lease renewal', async () => {
    const runId = `foc1_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ownerId = `owner_${runId}`;
    const tenantId = `tenant_${runId}`;
    const propId = `prop_${runId}`;
    const leaseId = `lease_${runId}`;
    const renewalId = `ren_${runId}`;

    createdUserIds.push(ownerId, tenantId);
    createdPropertyIds.push(propId);
    createdLeaseIds.push(leaseId);
    createdRenewalIds.push(renewalId);

    await db.insert(users).values([
      { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Foc1', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Foc1', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId, name: 'Mid Renewal Reversal Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
    });
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
    });

    const [lease] = await db.insert(leases).values({
      id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE', currency: 'IQD'
    }).returning();
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    // Pick August schedule
    const [augSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-08-01T00:00:00.000Z')));
    assert.ok(augSchedule, 'August schedule must exist');

    // Record, confirm payment of 1000 IQD and post commission
    const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, augSchedule.id, 1000, 'CASH', `REF-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepo.confirmPayment(payment.id, ownerId);
    await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

    const [augAfterPay] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
    assert.strictEqual(Number(augAfterPay.paidAmount), 1000);
    assert.strictEqual(augAfterPay.status, 'PAID');

    // Reverse the payment via route
    const revRes = await request(app)
      .post(`/api/leases/payments/${payment.id}/reverse`)
      .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
      .send({ reason: 'Tenant check returned NSF' });

    assert.strictEqual(revRes.status, 200, `Reversal should succeed. Error: ${JSON.stringify(revRes.body)}`);
    assert.strictEqual(revRes.body.payment.status, 'REVERSED');

    // Verify August schedule paidAmount zeroed
    const [augAfterRev] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
    assert.strictEqual(Number(augAfterRev.paidAmount), 0);

    // Now approve a mid-lease renewal from August 1, 2026 extending through December 31, 2027 at 1500 rent
    const [renewal] = await db.insert(leaseRenewals).values({
      id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
      proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2027-12-31T00:00:00.000Z', proposedRentAmount: '1500', status: 'REQUESTED'
    }).returning();

    // Must NOT throw PostgreSQL foreign key violation error 23503
    await leaseRepository.approveRenewal(renewal.id);

    const [augRenewed] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
    assert.ok(augRenewed, 'August schedule row must remain intact');
    assert.strictEqual(Number(augRenewed.amount), 1500, 'August rent must update to renewed amount');
    assert.strictEqual(Number(augRenewed.paidAmount), 0, 'Paid amount must remain 0');

    // Verify reversed payment record still cleanly references August schedule
    const [persistedPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
    assert.strictEqual(persistedPayment.rentScheduleId, augSchedule.id, 'Reversed payment must still point to August schedule');
  });

  // --------------------------------------------------------------------------
  // COVERAGE 2: Confirm the payment-referenced schedule ID and foreign key remain valid
  // --------------------------------------------------------------------------
  await t.test('2. Confirm the payment-referenced schedule ID and foreign key remain valid', async () => {
    const runId = `foc2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ownerId = `owner_${runId}`;
    const tenantId = `tenant_${runId}`;
    const propId = `prop_${runId}`;
    const leaseId = `lease_${runId}`;
    const renewalId = `ren_${runId}`;

    createdUserIds.push(ownerId, tenantId);
    createdPropertyIds.push(propId);
    createdLeaseIds.push(leaseId);
    createdRenewalIds.push(renewalId);

    await db.insert(users).values([
      { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Foc2', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Foc2', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId, name: 'FK Validation Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
    });
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
    });

    const [lease] = await db.insert(leases).values({
      id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1200', status: 'ACTIVE'
    }).returning();
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1200);
    });

    const [targetSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-09-01T00:00:00.000Z')));
    const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, targetSchedule.id, 1200, 'BANK_TRANSFER', `REF-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepo.confirmPayment(payment.id, ownerId);
    await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

    // Reverse payment
    const revRes = await request(app)
      .post(`/api/leases/payments/${payment.id}/reverse`)
      .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
      .send({ reason: 'Reversal for test 2' });
    assert.strictEqual(revRes.status, 200, `Reversal should succeed: ${JSON.stringify(revRes.body)}`);

    // Mid-lease renewal
    const [renewal] = await db.insert(leaseRenewals).values({
      id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
      proposedStartDate: '2026-09-01T00:00:00.000Z', proposedEndDate: '2027-12-31T00:00:00.000Z', proposedRentAmount: '1800', status: 'REQUESTED'
    }).returning();
    await leaseRepository.approveRenewal(renewal.id);

    // Verify foreign key integrity via real PostgreSQL JOIN
    const fkQuery = await (db as any).execute(sql`
      SELECT p.id as payment_id, p.status as payment_status, p.rent_schedule_id, r.id as schedule_id, r.amount as schedule_amount
      FROM payment_records p
      JOIN rent_schedules r ON p.rent_schedule_id = r.id
      WHERE p.id = ${payment.id}
    `);

    const row = fkQuery.rows?.[0] || fkQuery[0];
    assert.ok(row, 'PostgreSQL foreign key JOIN must return matching row');
    assert.strictEqual(row.payment_id, payment.id);
    assert.strictEqual(row.rent_schedule_id, targetSchedule.id);
    assert.strictEqual(row.schedule_id, targetSchedule.id);
    assert.strictEqual(row.payment_status, 'REVERSED');
    assert.strictEqual(Number(row.schedule_amount), 1800);
  });

  // --------------------------------------------------------------------------
  // COVERAGE 3: Preserve partial paidAmount and calculate the correct status
  // --------------------------------------------------------------------------
  await t.test('3. Preserve partial paidAmount and calculate the correct status', async () => {
    const runId = `foc3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ownerId = `owner_${runId}`;
    const tenantId = `tenant_${runId}`;
    const propId = `prop_${runId}`;
    const leaseId = `lease_${runId}`;
    const renewalId = `ren_${runId}`;

    createdUserIds.push(ownerId, tenantId);
    createdPropertyIds.push(propId);
    createdLeaseIds.push(leaseId);
    createdRenewalIds.push(renewalId);

    await db.insert(users).values([
      { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Foc3', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Foc3', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId, name: 'Partial Pay Renewal Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
    });
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
    });

    const [lease] = await db.insert(leases).values({
      id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE', currency: 'IQD'
    }).returning();
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    // Make partial payment of 400 IQD on August schedule
    const [augSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-08-01T00:00:00.000Z')));
    const partialPayment = await leaseRepo.recordPayment(propId, lease.id, tenantId, augSchedule.id, 400, 'CASH', `PART-${runId}`);
    createdPaymentIds.push(partialPayment.id);
    await leaseRepo.confirmPayment(partialPayment.id, ownerId);

    const [augAfterPartial] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
    assert.strictEqual(Number(augAfterPartial.paidAmount), 400);
    assert.strictEqual(augAfterPartial.status, 'PARTIALLY_PAID');

    // Approve renewal raising rent from 1000 to 1400
    const [renewal] = await db.insert(leaseRenewals).values({
      id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
      proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2027-12-31T00:00:00.000Z', proposedRentAmount: '1400', status: 'REQUESTED'
    }).returning();
    await leaseRepository.approveRenewal(renewal.id);

    // Verify August schedule: ID preserved, paidAmount preserved at 400, status is PARTIALLY_PAID (400 < 1400)
    const [augRenewed] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
    assert.strictEqual(augRenewed.id, augSchedule.id);
    assert.strictEqual(Number(augRenewed.paidAmount), 400);
    assert.strictEqual(Number(augRenewed.amount), 1400);
    assert.strictEqual(augRenewed.status, 'PARTIALLY_PAID');

    // Confirm second payment of 1000 to satisfy balance (400 + 1000 = 1400)
    const secondPayment = await leaseRepo.recordPayment(propId, lease.id, tenantId, augSchedule.id, 1000, 'CASH', `FINAL-${runId}`);
    createdPaymentIds.push(secondPayment.id);
    await leaseRepo.confirmPayment(secondPayment.id, ownerId);

    const [augFinal] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
    assert.strictEqual(Number(augFinal.paidAmount), 1400);
    assert.strictEqual(augFinal.status, 'PAID');

    // Verify sufficient payment case: approve renewal where existing paid amount (1400) matches renewed amount (1400)
    const renSufficientId = `ren_suf_${runId}`;
    createdRenewalIds.push(renSufficientId);
    const [renewalSufficient] = await db.insert(leaseRenewals).values({
      id: renSufficientId, leaseId: lease.id, propertyId: propId, tenantId,
      proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2028-12-31T00:00:00.000Z', proposedRentAmount: '1400', status: 'REQUESTED'
    }).returning();
    await leaseRepository.approveRenewal(renewalSufficient.id);

    const [augAfterSufficientRenewal] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
    assert.strictEqual(Number(augAfterSufficientRenewal.paidAmount), 1400);
    assert.strictEqual(Number(augAfterSufficientRenewal.amount), 1400);
    assert.strictEqual(augAfterSufficientRenewal.status, 'PAID', 'Schedule with paidAmount >= monthlyRent must remain PAID upon renewal');
  });

  // --------------------------------------------------------------------------
  // COVERAGE 4: Recalculate a zero-paid schedule as UPCOMING or OVERDUE, based on established due-date rules
  // --------------------------------------------------------------------------
  await t.test('4. Recalculate a zero-paid schedule as UPCOMING or OVERDUE, based on established due-date rules', async () => {
    const runId = `foc4_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ownerId = `owner_${runId}`;
    const tenantId = `tenant_${runId}`;
    const propId = `prop_${runId}`;
    const leaseId = `lease_${runId}`;

    createdUserIds.push(ownerId, tenantId);
    createdPropertyIds.push(propId);
    createdLeaseIds.push(leaseId);

    await db.insert(users).values([
      { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Foc4', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Foc4', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId, name: 'Status Recalc Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
    });
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
    });

    // Create past and future dates relative to now
    const now = new Date();
    const pastYear = now.getUTCFullYear() - 1;
    const futureYear = now.getUTCFullYear() + 2;

    const pastStart = `${pastYear}-01-01T00:00:00.000Z`;
    const pastEnd = `${pastYear}-03-01T00:00:00.000Z`;
    const futureStart = `${futureYear}-01-01T00:00:00.000Z`;
    const futureEnd = `${futureYear}-03-01T00:00:00.000Z`;

    const [lease] = await db.insert(leases).values({
      id: leaseId, propertyId: propId, startDate: pastStart, endDate: futureEnd, rentAmount: '1000', status: 'ACTIVE'
    }).returning();
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    // Generate schedules for past period
    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, pastStart, pastEnd, 1000);
    });

    const pastSchedules = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, pastStart)));
    assert.strictEqual(pastSchedules[0].status, 'OVERDUE', 'Zero-paid schedule with past due date must be OVERDUE');

    // Generate schedules for future period
    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, futureStart, futureEnd, 1000);
    });

    const futureSchedules = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, futureStart)));
    assert.strictEqual(futureSchedules[0].status, 'UPCOMING', 'Zero-paid schedule with future due date must be UPCOMING');
  });

  // --------------------------------------------------------------------------
  // COVERAGE 5: Shorten a renewal when an obsolete schedule is still referenced by payment history
  // --------------------------------------------------------------------------
  await t.test('5. Shorten a renewal when an obsolete schedule is still referenced by payment history', async () => {
    const runId = `foc5_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ownerId = `owner_${runId}`;
    const tenantId = `tenant_${runId}`;
    const propId = `prop_${runId}`;
    const leaseId = `lease_${runId}`;
    const renUnreversedId = `ren_unrev_${runId}`;
    const renPendingId = `ren_pend_${runId}`;
    const renShortenId = `ren_short_${runId}`;

    createdUserIds.push(ownerId, tenantId);
    createdPropertyIds.push(propId);
    createdLeaseIds.push(leaseId);
    createdRenewalIds.push(renUnreversedId, renPendingId, renShortenId);

    await db.insert(users).values([
      { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Foc5', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Foc5', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId, name: 'Shorten Reference Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
    });
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
    });

    const [lease] = await db.insert(leases).values({
      id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE', currency: 'IQD'
    }).returning();
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    // December schedule (will become obsolete upon shortening to Oct 31)
    const [decSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-12-01T00:00:00.000Z')));

    // 5A: Test rejection when obsolete schedule has unreversed CONFIRMED payment
    const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, decSchedule.id, 1000, 'CASH', `PAY-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepo.confirmPayment(payment.id, ownerId);
    await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

    const [renewalUnreversed] = await db.insert(leaseRenewals).values({
      id: renUnreversedId, leaseId: lease.id, propertyId: propId, tenantId,
      proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2026-10-31T00:00:00.000Z', proposedRentAmount: '1100', status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => {
        await leaseRepository.approveRenewal(renewalUnreversed.id);
      },
      (err: any) => err.message.includes('Cannot shorten lease') && err.message.includes('has collected payments')
    );

    // 5B: Test rejection when obsolete schedule has pending RECORDED payment
    // Reverse the confirmed payment via route
    const revRes = await request(app)
      .post(`/api/leases/payments/${payment.id}/reverse`)
      .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
      .send({ reason: 'Reversal for shorten test' });
    assert.strictEqual(revRes.status, 200, `Reversal should succeed: ${JSON.stringify(revRes.body)}`);

    // Record an unconfirmed (RECORDED) payment on December
    const pendingPay = await leaseRepo.recordPayment(propId, lease.id, tenantId, decSchedule.id, 500, 'CASH', `PEND-${runId}`);
    createdPaymentIds.push(pendingPay.id);

    const [renewalPending] = await db.insert(leaseRenewals).values({
      id: renPendingId, leaseId: lease.id, propertyId: propId, tenantId,
      proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2026-10-31T00:00:00.000Z', proposedRentAmount: '1100', status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => {
        await leaseRepository.approveRenewal(renewalPending.id);
      },
      (err: any) => err.message.includes('Cannot shorten lease') && err.message.includes('pending recorded payments')
    );

    // Cancel pending payment
    await db.update(paymentRecords).set({ status: 'CANCELLED' }).where(eq(paymentRecords.id, pendingPay.id));

    // 5C: Shorten lease: obsolete schedule is safely marked CANCELLED with amount 0 (row preserved, FK intact)
    const [renewalShorten] = await db.insert(leaseRenewals).values({
      id: renShortenId, leaseId: lease.id, propertyId: propId, tenantId,
      proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2026-10-31T00:00:00.000Z', proposedRentAmount: '1100', status: 'REQUESTED'
    }).returning();

    await leaseRepository.approveRenewal(renewalShorten.id);

    const [decAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, decSchedule.id));
    assert.ok(decAfter, 'Obsolete schedule row must NOT be deleted');
    assert.strictEqual(decAfter.status, 'CANCELLED');
    assert.strictEqual(decAfter.amount, '0');
    assert.strictEqual(Number(decAfter.paidAmount), 0);

    // Both payment records (reversed and cancelled) still retain valid foreign key to December schedule
    const payments = await db.select().from(paymentRecords).where(eq(paymentRecords.rentScheduleId, decSchedule.id));
    assert.strictEqual(payments.length, 2);
  });

  // --------------------------------------------------------------------------
  // COVERAGE 6: Reject invalid lower-rent renewal and verify transaction rollback
  // --------------------------------------------------------------------------
  await t.test('6. Reject invalid lower-rent renewal and verify transaction rollback', async () => {
    const runId = `foc6_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ownerId = `owner_${runId}`;
    const tenantId = `tenant_${runId}`;
    const propId = `prop_${runId}`;
    const leaseId = `lease_${runId}`;
    const renewalId = `ren_${runId}`;

    createdUserIds.push(ownerId, tenantId);
    createdPropertyIds.push(propId);
    createdLeaseIds.push(leaseId);
    createdRenewalIds.push(renewalId);

    await db.insert(users).values([
      { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Foc6', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Foc6', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId, name: 'Lower Rent Rollback Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
    });
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
    });

    const [lease] = await db.insert(leases).values({
      id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE', currency: 'IQD'
    }).returning();
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    // Pay 800 IQD on August schedule
    const [augSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-08-01T00:00:00.000Z')));
    const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, augSchedule.id, 800, 'CASH', `REF-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepo.confirmPayment(payment.id, ownerId);

    // Try to approve renewal that reduces rent to 500 IQD (below 800 IQD paid)
    const [renewal] = await db.insert(leaseRenewals).values({
      id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
      proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2027-12-31T00:00:00.000Z', proposedRentAmount: '500', status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => {
        await leaseRepository.approveRenewal(renewal.id);
      },
      (err: any) => err.message.includes('Cannot reduce rent below the amount already paid')
    );

    // Verify COMPLETE TRANSACTION ROLLBACK:
    // 1. Renewal status must remain REQUESTED (not APPROVED)
    const [renewalAfter] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewal.id));
    assert.strictEqual(renewalAfter.status, 'REQUESTED');

    // 2. Lease end date and rent must remain 2026-12-31 and 1000
    const [leaseAfter] = await db.select().from(leases).where(eq(leases.id, lease.id));
    assert.strictEqual(leaseAfter.endDate, '2026-12-31T00:00:00.000Z');
    assert.strictEqual(leaseAfter.rentAmount, '1000');

    // 3. August schedule amount must remain 1000, paidAmount 800
    const [augAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
    assert.strictEqual(augAfter.amount, '1000');
    assert.strictEqual(Number(augAfter.paidAmount), 800);
    assert.strictEqual(augAfter.status, 'PARTIALLY_PAID');

    // 4. Zero 2027 schedules must have been created
    const futureSchedules = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2027-01-01T00:00:00.000Z')));
    assert.strictEqual(futureSchedules.length, 0);
  });

  // --------------------------------------------------------------------------
  // COVERAGE 7: Ensure no duplicate schedule periods are created
  // --------------------------------------------------------------------------
  await t.test('7. Ensure no duplicate schedule periods are created', async () => {
    const runId = `foc7_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ownerId = `owner_${runId}`;
    const tenantId = `tenant_${runId}`;
    const propId = `prop_${runId}`;
    const leaseId = `lease_${runId}`;
    const renewalId = `ren_${runId}`;

    createdUserIds.push(ownerId, tenantId);
    createdPropertyIds.push(propId);
    createdLeaseIds.push(leaseId);
    createdRenewalIds.push(renewalId);

    await db.insert(users).values([
      { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Foc7', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Foc7', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId, name: 'No Duplicates Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
    });
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
    });

    const [lease] = await db.insert(leases).values({
      id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE', currency: 'IQD'
    }).returning();
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    // Approve mid-lease renewal covering 2026-06-01 through 2027-12-31
    const [renewal] = await db.insert(leaseRenewals).values({
      id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
      proposedStartDate: '2026-06-01T00:00:00.000Z', proposedEndDate: '2027-12-31T00:00:00.000Z', proposedRentAmount: '1500', status: 'REQUESTED'
    }).returning();

    await leaseRepository.approveRenewal(renewal.id);

    // Fetch all schedules for this lease
    const allSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const activeSchedules = allSchedules.filter(s => s.status !== 'CANCELLED');

    // Total months from 2026-01 to 2027-12 is exactly 24 months
    assert.strictEqual(activeSchedules.length, 24, 'Total active schedules must be 24');

    // Verify uniqueness of periodStart
    const periodStarts = activeSchedules.map(s => s.periodStart);
    const uniqueStarts = new Set(periodStarts);
    assert.strictEqual(uniqueStarts.size, activeSchedules.length, 'Every active schedule periodStart must be unique');

    // Re-running schedule generation directly must NOT create duplicate rows
    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-06-01T00:00:00.000Z', '2027-12-31T00:00:00.000Z', 1500);
    });

    const schedulesAfterReRun = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), sql`${rentSchedules.status} != 'CANCELLED'`));
    assert.strictEqual(schedulesAfterReRun.length, 24, 'Zero duplicate rows after re-running schedule generation');
  });

  // --------------------------------------------------------------------------
  // COVERAGE 8: Ensure repeated or concurrent reversal cannot apply financial effects twice
  // --------------------------------------------------------------------------
  await t.test('8. Ensure repeated or concurrent reversal cannot apply financial effects twice', async () => {
    const runId = `foc8_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ownerId = `owner_${runId}`;
    const tenantId = `tenant_${runId}`;
    const propId = `prop_${runId}`;
    const leaseId = `lease_${runId}`;

    createdUserIds.push(ownerId, tenantId);
    createdPropertyIds.push(propId);
    createdLeaseIds.push(leaseId);

    await db.insert(users).values([
      { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Foc8', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Foc8', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId, name: 'Concurrent Reversal Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED'
    });
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
    });

    const [lease] = await db.insert(leases).values({
      id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE', currency: 'IQD'
    }).returning();
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    const [schedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-08-01T00:00:00.000Z')));
    const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, schedule.id, 1000, 'CASH', `REF-${runId}`);
    createdPaymentIds.push(payment.id);
    await leaseRepo.confirmPayment(payment.id, ownerId);
    await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

    // Initial reversal
    const initialRes = await request(app)
      .post(`/api/leases/payments/${payment.id}/reverse`)
      .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
      .send({ reason: 'Initial Reversal' });

    assert.strictEqual(initialRes.status, 200, `Initial reversal should succeed: ${JSON.stringify(initialRes.body)}`);

    const [scheduleAfterInitial] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule.id));
    assert.strictEqual(Number(scheduleAfterInitial.paidAmount), 0);

    // 8A: Repeated reversal call
    const repeatRes = await request(app)
      .post(`/api/leases/payments/${payment.id}/reverse`)
      .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
      .send({ reason: 'Repeat Reversal' });

    assert.strictEqual(repeatRes.status, 200);
    assert.strictEqual(repeatRes.body.message, 'Payment is already reversed');

    // Balance must still be 0 (not double-decremented)
    const [scheduleAfterRepeat] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule.id));
    assert.strictEqual(Number(scheduleAfterRepeat.paidAmount), 0);

    // Verify audit log has exactly 1 REVERSE_PAYMENT record for this payment
    const audits = await db.select().from(auditLogs).where(and(
      eq(auditLogs.resourceType, 'PaymentRecord'),
      eq(auditLogs.resourceId, payment.id),
      eq(auditLogs.action, 'REVERSE_PAYMENT')
    ));
    assert.strictEqual(audits.length, 1, 'Audit log must not duplicate reversal entries on repeat');

    // 8B: Concurrent Reversal Requests
    // Create second payment on September schedule
    const [sepSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-09-01T00:00:00.000Z')));
    const pay2 = await leaseRepo.recordPayment(propId, lease.id, tenantId, sepSchedule.id, 1000, 'CASH', `REF2-${runId}`);
    createdPaymentIds.push(pay2.id);
    await leaseRepo.confirmPayment(pay2.id, ownerId);
    await commissionService.postCommissionForPayment(pay2.id, ownerId, 'SYSTEM');

    // Send two concurrent reversal requests
    const [conResA, conResB] = await Promise.all([
      request(app)
        .post(`/api/leases/payments/${pay2.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Concurrent Attempt A' }),
      request(app)
        .post(`/api/leases/payments/${pay2.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Concurrent Attempt B' }),
    ]);

    // One succeeds with 200 (reversal completed), the second either completes recovery/idempotent 200 or serializes cleanly
    assert.ok(conResA.status === 200 || conResA.status === 400);
    assert.ok(conResB.status === 200 || conResB.status === 400);
    assert.ok(conResA.status === 200 || conResB.status === 200);

    // Balance on September schedule must be exactly 0, NOT double-decremented
    const [sepAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, sepSchedule.id));
    assert.strictEqual(Number(sepAfter.paidAmount), 0, 'Schedule paidAmount must not be double-decremented');

    // Payment status must be REVERSED
    const [pay2Record] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, pay2.id));
    assert.strictEqual(pay2Record.status, 'REVERSED');
  });
});
