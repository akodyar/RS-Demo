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
// Strictly enforce target database is local homehub_test before execution
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

test('Payment Reversal and Lease Renewal Integrity Suite (homehub_test)', async (t) => {
  assertSafeDatabaseConfig();

  // Verify active database on real connection
  const connCheck = await (db as any).execute('SELECT current_database() as db_name, current_user as db_user');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(activeDb, TARGET_TEST_DATABASE, `Must be connected to '${TARGET_TEST_DATABASE}'. Got: '${activeDb}'`);

  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdRenewalIds: string[] = [];
  const createdPaymentIds: string[] = [];

  async function cleanupFixtures() {
    for (const renId of createdRenewalIds) {
      await db.delete(leaseRenewals).where(eq(leaseRenewals.id, renId)).catch(() => {});
    }
    for (const pId of createdPaymentIds) {
      await db.delete(paymentRecords).where(eq(paymentRecords.id, pId)).catch(() => {});
    }
    for (const leaseId of createdLeaseIds) {
      await db.delete(paymentRecords).where(eq(paymentRecords.leaseId, leaseId)).catch(() => {});
      await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseId)).catch(() => {});
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId)).catch(() => {});
      await db.delete(leases).where(eq(leases.id, leaseId)).catch(() => {});
    }
    for (const propId of createdPropertyIds) {
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
      await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
    }
    for (const userId of createdUserIds) {
      await db.delete(users).where(eq(users.id, userId)).catch(() => {});
    }
  }

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/leases', leasesRouter);

  const leaseRepo = new LeaseRepository();
  const commissionService = new CommissionService();

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: A payment is reversed before a mid-lease renewal.
    // Must succeed without PostgreSQL foreign-key violation (23503) and preserve links.
    // ------------------------------------------------------------------------
    await t.test('1. A payment is reversed before a mid-lease renewal', async () => {
      const runId = `sc1_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC1', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC1', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId, name: 'FK Regression Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED', rentFee: '0.02', managementFee: '0.03'
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

      const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
      const augSchedule = schedules.find(s => new Date(s.periodStart).toISOString() === '2026-08-01T00:00:00.000Z')!;
      assert.ok(augSchedule, 'August schedule must exist');

      // Record and confirm payment on August schedule
      const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, augSchedule.id, 1000, 'CASH', `REF-${runId}`);
      createdPaymentIds.push(payment.id);
      await leaseRepo.confirmPayment(payment.id, ownerId);
      await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

      // Reverse payment via route before renewal
      const revRes = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Reversal before renewal test' });
      assert.strictEqual(revRes.status, 200, `Reversal failed: ${JSON.stringify(revRes.body)}`);

      // Verify payment is REVERSED and still references augSchedule.id
      const [revPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
      assert.strictEqual(revPayment.status, 'REVERSED');
      assert.strictEqual(revPayment.rentScheduleId, augSchedule.id);

      // Create renewal overlapping August 2026
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-08-01T00:00:00.000Z',
        proposedEndDate: '2027-07-31T00:00:00.000Z',
        proposedRentAmount: '1500',
        status: 'REQUESTED'
      }).returning();

      // Approve renewal: must NOT crash with PostgreSQL foreign key violation (23503)
      await leaseRepository.approveRenewal(renewal.id);

      // Verify renewal succeeded
      const [persistedRenewal] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewal.id));
      assert.strictEqual(persistedRenewal.status, 'APPROVED');

      // Verify schedule was updated in place with new rent amount and status
      const [updatedAug] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
      assert.strictEqual(updatedAug.id, augSchedule.id, 'August schedule ID must be preserved');
      assert.strictEqual(updatedAug.amount, '1500', 'August rent amount must reflect renewed rent');
      assert.strictEqual(Number(updatedAug.paidAmount), 0, 'August paidAmount must be 0');
      assert.strictEqual(updatedAug.status, 'OVERDUE', 'Past due schedule with zero paid must be OVERDUE');

      // Payment still links to August schedule
      const [finalPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
      assert.strictEqual(finalPayment.status, 'REVERSED');
      assert.strictEqual(finalPayment.rentScheduleId, augSchedule.id);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: A payment reversal occurs after renewal.
    // Recalculates renewed schedule balance and preserves foreign key.
    // ------------------------------------------------------------------------
    await t.test('2. A payment reversal occurs after renewal', async () => {
      const runId = `sc2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC2', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC2', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId, name: 'Reversal After Renewal Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED', rentFee: '0.02', managementFee: '0.03'
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

      const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
      const augSchedule = schedules.find(s => new Date(s.periodStart).toISOString() === '2026-08-01T00:00:00.000Z')!;
      assert.ok(augSchedule, 'August schedule must exist');

      // 1. Record and confirm payment of 1000 on August schedule
      const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, augSchedule.id, 1000, 'CASH', `REF-${runId}`);
      createdPaymentIds.push(payment.id);
      await leaseRepo.confirmPayment(payment.id, ownerId);
      await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

      const [augAfterPay] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
      assert.strictEqual(augAfterPay.status, 'PAID');
      assert.strictEqual(augAfterPay.paidAmount, '1000');

      // 2. Approve mid-lease renewal starting August 1, 2026 at new rent 1500
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2027-07-31T00:00:00.000Z', proposedRentAmount: '1500', status: 'REQUESTED'
      }).returning();
      await leaseRepository.approveRenewal(renewal.id);

      // Verify schedule was updated to 1500, with 1000 paidAmount => PARTIALLY_PAID
      const [augRenewed] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
      assert.strictEqual(augRenewed.amount, '1500');
      assert.strictEqual(augRenewed.paidAmount, '1000');
      assert.strictEqual(augRenewed.status, 'PARTIALLY_PAID');

      // 3. Reverse the payment AFTER renewal via API route
      const revRes = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Reversal after renewal test' });

      assert.strictEqual(revRes.status, 200, `Reversal failed: ${JSON.stringify(revRes.body)}`);
      assert.strictEqual(revRes.body.payment.status, 'REVERSED');

      // Verify schedule status recalculated to OVERDUE with 0 paidAmount and 1500 amount
      const [augAfterRev] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, augSchedule.id));
      assert.strictEqual(augAfterRev.id, augSchedule.id, 'August schedule ID preserved');
      assert.strictEqual(augAfterRev.amount, '1500');
      assert.strictEqual(Number(augAfterRev.paidAmount), 0);
      assert.strictEqual(augAfterRev.status, 'OVERDUE');

      // Verify foreign key integrity remains intact
      const [revPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
      assert.strictEqual(revPayment.status, 'REVERSED');
      assert.strictEqual(revPayment.rentScheduleId, augSchedule.id);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 3: A renewal reuses a schedule referenced by a payment.
    // Preserves schedule IDs, payment foreign keys, and paid amounts.
    // ------------------------------------------------------------------------
    await t.test('3. A renewal reuses a schedule referenced by a payment', async () => {
      const runId = `sc3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC3', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC3', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId, name: 'Schedule Reuse Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
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

      const [juneSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-06-01T00:00:00.000Z')));
      assert.ok(juneSchedule);

      // Record and confirm actual partial payment of 450 IQD
      const partialPayment = await leaseRepo.recordPayment(propId, lease.id, tenantId, juneSchedule.id, 450, 'CASH', `REF-PARTIAL-${runId}`);
      createdPaymentIds.push(partialPayment.id);
      await leaseRepo.confirmPayment(partialPayment.id, ownerId);

      // Mid-lease renewal starting 2026-06-01, new rent 1500
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-06-01T00:00:00.000Z', proposedEndDate: '2027-05-31T00:00:00.000Z', proposedRentAmount: '1500', status: 'REQUESTED'
      }).returning();

      await leaseRepository.approveRenewal(renewal.id);

      const [reusedJune] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, juneSchedule.id));
      assert.strictEqual(reusedJune.id, juneSchedule.id, 'Schedule primary key ID must be identical (reused)');
      assert.strictEqual(reusedJune.paidAmount, '450', 'Paid amount must not be erased or reduced');
      assert.strictEqual(reusedJune.amount, '1500', 'Schedule amount must be updated to renewed rent');
      assert.strictEqual(reusedJune.status, 'PARTIALLY_PAID', 'Schedule status must remain PARTIALLY_PAID');

      // Assert row count for June 2026 period is strictly 1 (no duplicates)
      const juneRows = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-06-01T00:00:00.000Z')));
      assert.strictEqual(juneRows.length, 1, 'Exactly one schedule must exist for June 2026 (no duplicates)');

      // Verify payment foreign key still points to the reused June schedule
      const [persistedPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, partialPayment.id));
      assert.strictEqual(persistedPayment.rentScheduleId, juneSchedule.id);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 4: A shortened renewal encounters a payment-referenced future schedule.
    // Must reject shortening if payments are unreversed; must safely cancel if reversed without row deletion.
    // ------------------------------------------------------------------------
    await t.test('4. A shortened renewal encounters a payment-referenced future schedule', async () => {
      const runId = `sc4_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;
      const renewalId1 = `ren1_${runId}`;
      const renewalId2 = `ren2_${runId}`;

      createdUserIds.push(ownerId, tenantId);
      createdPropertyIds.push(propId);
      createdLeaseIds.push(leaseId);
      createdRenewalIds.push(renewalId1, renewalId2);

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC4', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC4', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId, name: 'Shorten Safety Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
      });
      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
      });

      const originalEndDate = '2026-12-31T00:00:00.000Z';
      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: originalEndDate, rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', originalEndDate, 1000);
      });

      const [decSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-12-01T00:00:00.000Z')));

      // Record and confirm payment on December schedule
      const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, decSchedule.id, 1000, 'CASH', `REF-${runId}`);
      createdPaymentIds.push(payment.id);
      await leaseRepo.confirmPayment(payment.id, ownerId);

      // 4A: Attempting to shorten lease while December has unreversed payment MUST FAIL
      const [renewalUnreversed] = await db.insert(leaseRenewals).values({
        id: renewalId1, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2026-10-31T00:00:00.000Z', proposedRentAmount: '1200', status: 'REQUESTED'
      }).returning();

      await assert.rejects(
        async () => {
          await leaseRepository.approveRenewal(renewalUnreversed.id);
        },
        (err: any) => {
          return err.message.includes('Cannot shorten lease') && err.message.includes('has collected payments. Reverse payments first.');
        }
      );

      // Verify lease was not shortened on rejection
      const [leaseAfterRejection] = await db.select().from(leases).where(eq(leases.id, lease.id));
      assert.strictEqual(leaseAfterRejection.endDate, originalEndDate);

      // 4B: Reverse payment on December schedule
      await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, payment.id));
      await db.update(rentSchedules).set({ paidAmount: '0', status: 'UPCOMING' }).where(eq(rentSchedules.id, decSchedule.id));

      // 4C: Now approve shortened renewal
      const [renewalReversed] = await db.insert(leaseRenewals).values({
        id: renewalId2, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-08-01T00:00:00.000Z', proposedEndDate: '2026-10-31T00:00:00.000Z', proposedRentAmount: '1200', status: 'REQUESTED'
      }).returning();

      await leaseRepository.approveRenewal(renewalReversed.id);

      // Verify December schedule: preserved with status CANCELLED and amount 0 (no FK 23503 error)
      const [decAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, decSchedule.id));
      assert.ok(decAfter, 'December schedule row must not be deleted');
      assert.strictEqual(decAfter.status, 'CANCELLED');
      assert.strictEqual(decAfter.amount, '0');
      assert.strictEqual(Number(decAfter.paidAmount), 0);

      // Verify reversed payment record still links to December schedule
      const [persistedPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
      assert.strictEqual(persistedPayment.status, 'REVERSED');
      assert.strictEqual(persistedPayment.rentScheduleId, decSchedule.id);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 5: Zero-paid schedules receive the correct status.
    // Schedules in the past receive OVERDUE; schedules in the future receive UPCOMING.
    // ------------------------------------------------------------------------
    await t.test('5. Zero-paid schedules receive the correct status', async () => {
      const runId = `sc5_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC5', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC5', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId, name: 'Zero Paid Status Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
      });
      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2027-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2027-12-31T00:00:00.000Z', 1000);
      });

      // Past schedule: 2026-01-01
      const [pastSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-01-01T00:00:00.000Z')));
      assert.strictEqual(Number(pastSchedule.paidAmount), 0);
      assert.strictEqual(pastSchedule.status, 'OVERDUE', 'Zero-paid past due schedule must be OVERDUE');

      // Future schedule: 2027-11-01
      const [futureSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2027-11-01T00:00:00.000Z')));
      assert.strictEqual(Number(futureSchedule.paidAmount), 0);
      assert.strictEqual(futureSchedule.status, 'UPCOMING', 'Zero-paid future schedule must be UPCOMING');

      // Renew with rent update and verify statuses persist correctly
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-06-01T00:00:00.000Z', proposedEndDate: '2027-12-31T00:00:00.000Z', proposedRentAmount: '1100', status: 'REQUESTED'
      }).returning();
      await leaseRepository.approveRenewal(renewal.id);

      const [pastAfter] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-01-01T00:00:00.000Z')));
      assert.strictEqual(pastAfter.status, 'OVERDUE');

      const [futureAfter] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2027-11-01T00:00:00.000Z')));
      assert.strictEqual(futureAfter.status, 'UPCOMING');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 6: Partially paid schedules retain the correct balance and status.
    // ------------------------------------------------------------------------
    await t.test('6. Partially paid schedules retain the correct balance and status', async () => {
      const runId = `sc6_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC6', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC6', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId, name: 'Partial Balance Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
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

      const [sepSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-09-01T00:00:00.000Z')));

      // Pay 600 IQD toward September rent
      const p1 = await leaseRepo.recordPayment(propId, lease.id, tenantId, sepSchedule.id, 600, 'CASH', `REF-1-${runId}`);
      createdPaymentIds.push(p1.id);
      await leaseRepo.confirmPayment(p1.id, ownerId);

      const [sepBefore] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, sepSchedule.id));
      assert.strictEqual(sepBefore.paidAmount, '600');
      assert.strictEqual(sepBefore.status, 'PARTIALLY_PAID');

      // Renewal increases rent to 1500
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-09-01T00:00:00.000Z', proposedEndDate: '2027-08-31T00:00:00.000Z', proposedRentAmount: '1500', status: 'REQUESTED'
      }).returning();
      await leaseRepository.approveRenewal(renewal.id);

      // Verify schedule retains 600 paid and PARTIALLY_PAID status with new 1500 rent
      const [sepAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, sepSchedule.id));
      assert.strictEqual(sepAfter.amount, '1500');
      assert.strictEqual(sepAfter.paidAmount, '600');
      assert.strictEqual(sepAfter.status, 'PARTIALLY_PAID');

      // Now tenant pays remaining 900 IQD
      const p2 = await leaseRepo.recordPayment(propId, lease.id, tenantId, sepSchedule.id, 900, 'CASH', `REF-2-${runId}`);
      createdPaymentIds.push(p2.id);
      await leaseRepo.confirmPayment(p2.id, ownerId);

      // Total confirmed paid = 1500 => transitions to PAID
      const [sepFinal] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, sepSchedule.id));
      assert.strictEqual(sepFinal.paidAmount, '1500');
      assert.strictEqual(sepFinal.status, 'PAID');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 7: Existing schedule IDs and payment foreign keys remain valid.
    // ------------------------------------------------------------------------
    await t.test('7. Existing schedule IDs and payment foreign keys remain valid', async () => {
      const runId = `sc7_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC7', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC7', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId, name: 'FK Validation Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
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

      const [schedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-09-01T00:00:00.000Z')));

      const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, schedule.id, 1000, 'CASH', `REF-${runId}`);
      createdPaymentIds.push(payment.id);

      // Reverse payment
      await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, payment.id));

      // Approve renewal
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-09-01T00:00:00.000Z', proposedEndDate: '2027-08-31T00:00:00.000Z', proposedRentAmount: '1600', status: 'REQUESTED'
      }).returning();
      await leaseRepository.approveRenewal(renewal.id);

      // Direct JOIN query in PostgreSQL to verify referential integrity
      const fkJoin = await (db as any).execute(sql`
        SELECT p.id as payment_id, p.status as payment_status, p.rent_schedule_id, s.id as schedule_id, s.period_start
        FROM payment_records p
        JOIN rent_schedules s ON p.rent_schedule_id = s.id
        WHERE p.id = ${payment.id}
      `);
      const row = fkJoin.rows?.[0] || fkJoin[0];
      assert.ok(row, 'Payment record must join to rent schedule on foreign key');
      assert.strictEqual(row.payment_id, payment.id);
      assert.strictEqual(row.payment_status, 'REVERSED');
      assert.strictEqual(row.rent_schedule_id, schedule.id);
      assert.strictEqual(row.schedule_id, schedule.id);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 8: Repeated renewal or schedule generation does not create duplicate periods.
    // ------------------------------------------------------------------------
    await t.test('8. Repeated renewal or schedule generation does not create duplicate periods', async () => {
      const runId = `sc8_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC8', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC8', email: `${tenantId}@test.com`, roles: ['TENANT'] },
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

      // Mid-lease renewal overlapping 2026-07-01 to 2027-06-30
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-07-01T00:00:00.000Z', proposedEndDate: '2027-06-30T00:00:00.000Z', proposedRentAmount: '1400', status: 'REQUESTED'
      }).returning();
      await leaseRepository.approveRenewal(renewal.id);

      // Repeat schedule generation over overlapping period
      await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-07-01T00:00:00.000Z', '2027-06-30T00:00:00.000Z', 1400);
      });

      // Check PostgreSQL for any duplicate periodStart entries
      const dupCheck = await (db as any).execute(sql`
        SELECT period_start, count(*) as count
        FROM rent_schedules
        WHERE lease_id = ${lease.id}
        GROUP BY period_start
        HAVING count(*) > 1
      `);
      const dups = dupCheck.rows || dupCheck;
      assert.strictEqual(dups.length, 0, `No duplicate period_start values allowed: ${JSON.stringify(dups)}`);

      // Total schedules must be exactly 18 (Jan-Jun 2026 at 1000, Jul 2026-Jun 2027 at 1400)
      const allSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
      assert.strictEqual(allSchedules.length, 18, 'Expected exactly 18 schedules total');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 9: Invalid renewal data causes a complete rollback.
    // ------------------------------------------------------------------------
    await t.test('9. Invalid renewal data causes a complete rollback', async () => {
      const runId = `sc9_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const strangerId = `stranger_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;
      const renewalId1 = `ren1_${runId}`;
      const renewalId2 = `ren2_${runId}`;

      createdUserIds.push(ownerId, tenantId, strangerId);
      createdPropertyIds.push(propId);
      createdLeaseIds.push(leaseId);
      createdRenewalIds.push(renewalId1, renewalId2);

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC9', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC9', email: `${tenantId}@test.com`, roles: ['TENANT'] },
        { id: strangerId, uid: strangerId, firstName: 'Stranger', lastName: 'SC9', email: `${strangerId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId, name: 'Rollback Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
      });
      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100'
      });

      const originalEndDate = '2026-12-31T00:00:00.000Z';
      const originalRent = '1000';

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: originalEndDate, rentAmount: originalRent, status: 'ACTIVE'
      }).returning();
      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', originalEndDate, 1000);
      });

      // 9A: Unauthorized stranger tenant must fail and rollback
      const [renewalUnauthorized] = await db.insert(leaseRenewals).values({
        id: renewalId1, leaseId: lease.id, propertyId: propId, tenantId: strangerId,
        proposedStartDate: '2027-01-01T00:00:00.000Z', proposedEndDate: '2027-12-31T00:00:00.000Z', proposedRentAmount: '2000', status: 'REQUESTED'
      }).returning();

      await assert.rejects(
        async () => {
          await leaseRepository.approveRenewal(renewalUnauthorized.id);
        },
        (err: any) => {
          return err.message.includes('VALIDATION_ERROR') && err.message.includes('not associated with this lease');
        }
      );

      // Verify rollback
      const [renewalAfter1] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewalUnauthorized.id));
      assert.strictEqual(renewalAfter1.status, 'REQUESTED');

      const [leaseAfter1] = await db.select().from(leases).where(eq(leases.id, lease.id));
      assert.strictEqual(leaseAfter1.endDate, originalEndDate);
      assert.strictEqual(leaseAfter1.rentAmount, originalRent);

      // 9B: Rent reduction below already paid amount must fail and rollback
      const [octSchedule] = await db.select().from(rentSchedules).where(and(eq(rentSchedules.leaseId, lease.id), eq(rentSchedules.periodStart, '2026-10-01T00:00:00.000Z')));
      await db.update(rentSchedules).set({ paidAmount: '750', status: 'PARTIALLY_PAID' }).where(eq(rentSchedules.id, octSchedule.id));

      const [renewalReduced] = await db.insert(leaseRenewals).values({
        id: renewalId2, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2026-10-01T00:00:00.000Z', proposedEndDate: '2027-09-30T00:00:00.000Z', proposedRentAmount: '500', status: 'REQUESTED'
      }).returning();

      await assert.rejects(
        async () => {
          await leaseRepository.approveRenewal(renewalReduced.id);
        },
        (err: any) => {
          return err.message.includes('Cannot reduce rent below the amount already paid');
        }
      );

      const [renewalAfter2] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewalReduced.id));
      assert.strictEqual(renewalAfter2.status, 'REQUESTED');

      const [leaseAfter2] = await db.select().from(leases).where(eq(leases.id, lease.id));
      assert.strictEqual(leaseAfter2.endDate, originalEndDate);
      assert.strictEqual(leaseAfter2.rentAmount, originalRent);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 10: Ordinary renewal behavior remains correct.
    // ------------------------------------------------------------------------
    await t.test('10. Ordinary renewal behavior remains correct', async () => {
      const runId = `sc10_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'SC10', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'SC10', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId, name: 'Normal Renewal Prop', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'SELF_MANAGED'
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

      // Normal renewal starting at end of current lease
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId, leaseId: lease.id, propertyId: propId, tenantId,
        proposedStartDate: '2027-01-01T00:00:00.000Z', proposedEndDate: '2027-12-31T00:00:00.000Z', proposedRentAmount: '1250', status: 'REQUESTED'
      }).returning();

      await leaseRepository.approveRenewal(renewal.id);

      const [updatedLease] = await db.select().from(leases).where(eq(leases.id, lease.id));
      assert.strictEqual(updatedLease.endDate, '2027-12-31T00:00:00.000Z');
      assert.strictEqual(updatedLease.rentAmount, '1250');

      const allSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
      assert.strictEqual(allSchedules.length, 24, 'Exactly 24 monthly schedules must exist (12 old + 12 renewed)');

      const schedules2027 = allSchedules.filter(s => new Date(s.periodStart).getFullYear() === 2027);
      assert.strictEqual(schedules2027.length, 12);
      for (const s of schedules2027) {
        assert.strictEqual(s.amount, '1250');
        assert.strictEqual(s.status, 'UPCOMING');
      }
    });

  } finally {
    await cleanupFixtures();
  }
});
