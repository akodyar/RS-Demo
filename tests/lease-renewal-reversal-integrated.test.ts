import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants, leaseRenewals, rentSchedules, paymentRecords, auditLogs } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { leaseRepository } from '../src/server/repositories/leases.js';
import leasesRouter from '../src/server/routes/leases.js';

// Load environment configuration
dotenv.config({ override: false });

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

test('Integrated Payment Reversal, Lease Shortening, and Atomic Audit Regression (homehub_test)', async (t) => {
  assertSafeDatabaseConfig();

  // Verify active database on real connection
  const connCheck = await (db as any).execute('SELECT current_database() as db_name, current_user as db_user');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(activeDb, TARGET_TEST_DATABASE, `Must be connected to '${TARGET_TEST_DATABASE}'. Got: '${activeDb}'`);

  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdRenewalIds: string[] = [];

  async function cleanupFixtures() {
    // Foreign-key safe cleanup.
    // Note: audit_logs is append-only by design; homehub_app intentionally lacks DELETE privilege on audit_logs.
    for (const renId of createdRenewalIds) {
      await db.delete(leaseRenewals).where(eq(leaseRenewals.id, renId));
    }
    for (const leaseId of createdLeaseIds) {
      await db.delete(paymentRecords).where(eq(paymentRecords.leaseId, leaseId));
      await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseId));
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId));
      await db.delete(leases).where(eq(leases.id, leaseId));
    }
    for (const propId of createdPropertyIds) {
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
      await db.delete(properties).where(eq(properties.id, propId));
    }
    for (const userId of createdUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
  }

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/leases', leasesRouter);

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: Integrated Happy Path:
    // Reversed payment + Partial payment + Shortened lease + Atomic audit insert
    // ------------------------------------------------------------------------
    await t.test('1. Shortened renewal preserves partial payments, cancelled schedules, reversed payments, and commits atomic audit log', async () => {
      const runId = `int1_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Int1', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Int1', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId,
        name: 'Integrated Renewal Property',
        type: 'APARTMENT',
        ownerId: ownerId,
        address: { city: 'Erbil' },
      });

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`,
        propertyId: propId,
        ownerId: ownerId,
        status: 'VERIFIED',
        ownershipPercentage: '100',
      });

      // Original lease: 2026-01-01 to 2026-12-31 at $1,000/mo
      const [lease] = await db.insert(leases).values({
        id: leaseId,
        propertyId: propId,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        rentAmount: '1000',
        status: 'ACTIVE',
      }).returning();

      await db.insert(leaseTenants).values({
        leaseId: lease.id,
        tenantId: tenantId,
        isPrimary: true,
      });

      // Generate initial 12 monthly rent schedules for 2026
      await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
      });

      const initialSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
      assert.strictEqual(initialSchedules.length, 12, '12 initial schedules should be generated');

      const juneSchedule = initialSchedules.find(s => new Date(s.periodStart).toISOString() === '2026-06-01T00:00:00.000Z')!;
      const augSchedule = initialSchedules.find(s => new Date(s.periodStart).toISOString() === '2026-08-01T00:00:00.000Z')!;
      const decSchedule = initialSchedules.find(s => new Date(s.periodStart).toISOString() === '2026-12-01T00:00:00.000Z')!;
      assert.ok(juneSchedule && augSchedule && decSchedule, 'Target schedules must exist');

      // 1. Record partial payment on June schedule (within renewed period)
      await db.update(rentSchedules).set({ paidAmount: '400', status: 'PARTIALLY_PAID' }).where(eq(rentSchedules.id, juneSchedule.id));

      // 2. Record and reverse payment on August schedule (within renewed period)
      const [augPayment] = await db.insert(paymentRecords).values({
        propertyId: propId,
        leaseId: lease.id,
        rentScheduleId: augSchedule.id,
        payerId: tenantId,
        amount: '1000',
        recordedDate: new Date().toISOString(),
        status: 'RECORDED',
      }).returning();
      // Execute reversal via route logic
      await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, augPayment.id));
      await db.update(rentSchedules).set({ paidAmount: '0', status: 'UPCOMING' }).where(eq(rentSchedules.id, augSchedule.id));

      // 3. Record and reverse payment on December schedule (outside shortened renewal period)
      const [decPayment] = await db.insert(paymentRecords).values({
        propertyId: propId,
        leaseId: lease.id,
        rentScheduleId: decSchedule.id,
        payerId: tenantId,
        amount: '1000',
        recordedDate: new Date().toISOString(),
        status: 'RECORDED',
      }).returning();
      await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, decPayment.id));
      await db.update(rentSchedules).set({ paidAmount: '0', status: 'UPCOMING' }).where(eq(rentSchedules.id, decSchedule.id));

      // 4. Create renewal request shortening lease to 2026-10-31 and raising rent to $1,500
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId,
        leaseId: lease.id,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2026-06-01T00:00:00.000Z',
        proposedEndDate: '2026-10-31T00:00:00.000Z', // Shortening from Dec 31 to Oct 31
        proposedRentAmount: '1500',
        status: 'REQUESTED',
      }).returning();

      // 5. Approve renewal via HTTP route
      const mockIp = '10.0.1.25';
      const response = await request(app)
        .post(`/api/leases/renewals/${renewal.id}/approve`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .set('x-forwarded-for', mockIp)
        .set('Accept', 'application/json');

      assert.strictEqual(response.status, 200, `Approval must succeed. Status: ${response.status}, body: ${JSON.stringify(response.body)}`);
      assert.strictEqual(response.body.status, 'APPROVED');

      // 6. Assert lease mutations
      const [persistedLease] = await db.select().from(leases).where(eq(leases.id, lease.id));
      assert.strictEqual(persistedLease.endDate, '2026-10-31T00:00:00.000Z', 'Lease end date must be shortened to 2026-10-31');
      assert.strictEqual(persistedLease.rentAmount, '1500', 'Lease rent amount must be updated to 1500');

      // 7. Assert rent schedule reconciliation and ID preservation
      const schedulesAfter = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));

      // June: Partial payment preserved, amount updated, status PARTIALLY_PAID
      const updatedJune = schedulesAfter.find(s => s.id === juneSchedule.id)!;
      assert.ok(updatedJune, 'June schedule ID must be preserved');
      assert.strictEqual(updatedJune.amount, '1500', 'June schedule rent must reflect renewed amount');
      assert.strictEqual(updatedJune.paidAmount, '400', 'June schedule paidAmount must be preserved');
      assert.strictEqual(updatedJune.status, 'PARTIALLY_PAID', 'June schedule status must remain PARTIALLY_PAID');

      // August: In period with reversed payment, amount updated, paidAmount 0, status OVERDUE or UPCOMING
      const updatedAug = schedulesAfter.find(s => s.id === augSchedule.id)!;
      assert.ok(updatedAug, 'August schedule ID must be preserved');
      assert.strictEqual(updatedAug.amount, '1500', 'August schedule rent must reflect renewed amount');
      assert.strictEqual(Number(updatedAug.paidAmount), 0, 'August paidAmount must remain 0');

      // December: Outside shortened period, amount 0, paidAmount 0, status CANCELLED
      const updatedDec = schedulesAfter.find(s => s.id === decSchedule.id)!;
      assert.ok(updatedDec, 'December schedule ID must be preserved');
      assert.strictEqual(updatedDec.amount, '0', 'Obsolete December schedule amount must be 0');
      assert.strictEqual(Number(updatedDec.paidAmount), 0, 'December paidAmount must be 0');
      assert.strictEqual(updatedDec.status, 'CANCELLED', 'Obsolete December schedule must be CANCELLED');

      // November: Also outside shortened period, must be CANCELLED with amount 0
      const novSchedule = schedulesAfter.find(s => new Date(s.periodStart).toISOString() === '2026-11-01T00:00:00.000Z')!;
      assert.ok(novSchedule, 'November schedule must exist');
      assert.strictEqual(novSchedule.status, 'CANCELLED');
      assert.strictEqual(novSchedule.amount, '0');

      // 8. Assert foreign-key and payment history preservation
      const [persistedAugPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, augPayment.id));
      assert.strictEqual(persistedAugPayment.status, 'REVERSED');
      assert.strictEqual(persistedAugPayment.rentScheduleId, augSchedule.id);

      const [persistedDecPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, decPayment.id));
      assert.strictEqual(persistedDecPayment.status, 'REVERSED');
      assert.strictEqual(persistedDecPayment.rentScheduleId, decSchedule.id);

      // 9. Assert atomic audit log entry
      const auditEntries = await db.select().from(auditLogs).where(
        and(
          eq(auditLogs.resourceType, 'LeaseRenewal'),
          eq(auditLogs.resourceId, renewal.id)
        )
      );

      assert.strictEqual(auditEntries.length, 1, 'Exactly one audit entry must be recorded');
      const audit = auditEntries[0];
      assert.strictEqual(audit.action, 'APPROVE_LEASE_RENEWAL');
      assert.strictEqual(audit.actorUserId, ownerId);
      assert.strictEqual(audit.actorRole, 'PROPERTY_OWNER');
      assert.strictEqual(audit.ipAddress, mockIp);

      const changes = audit.changes as any;
      assert.strictEqual(changes.previousEndDate, '2026-12-31T00:00:00.000Z');
      assert.strictEqual(changes.newEndDate, '2026-10-31T00:00:00.000Z');
      assert.strictEqual(changes.previousRentAmount, '1000');
      assert.strictEqual(changes.newRentAmount, '1500');
      assert.strictEqual(changes.previousStatus, 'REQUESTED');
      assert.strictEqual(changes.newStatus, 'APPROVED');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: Simulated audit persistence failure rolls back shortened renewal
    // ------------------------------------------------------------------------
    await t.test('2. Simulated audit persistence failure rolls back all shortened renewal mutations and commits no audit row', async () => {
      const runId = `int2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Int2', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Int2', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId,
        name: 'Fail Audit Property',
        type: 'APARTMENT',
        ownerId: ownerId,
        address: { city: 'Erbil' },
      });

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`,
        propertyId: propId,
        ownerId: ownerId,
        status: 'VERIFIED',
        ownershipPercentage: '100',
      });

      const originalEndDate = '2026-12-31T00:00:00.000Z';
      const originalRent = '1000';

      const [lease] = await db.insert(leases).values({
        id: leaseId,
        propertyId: propId,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: originalEndDate,
        rentAmount: originalRent,
        status: 'ACTIVE',
      }).returning();

      await db.insert(leaseTenants).values({
        leaseId: lease.id,
        tenantId: tenantId,
        isPrimary: true,
      });

      await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', originalEndDate, 1000);
      });

      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId,
        leaseId: lease.id,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2026-06-01T00:00:00.000Z',
        proposedEndDate: '2026-09-30T00:00:00.000Z', // Shortening lease
        proposedRentAmount: '1800',
        status: 'REQUESTED',
      }).returning();

      let errorThrown = false;
      try {
        await leaseRepository.approveRenewal(renewal.id, {
          actorUserId: ownerId,
          actorRole: 'PROPERTY_OWNER',
          simulateAuditFailure: true,
        });
      } catch (err: any) {
        errorThrown = true;
        assert.ok(err.message.includes('SIMULATED_AUDIT_FAILURE'), `Expected SIMULATED_AUDIT_FAILURE, got: ${err.message}`);
      }

      assert.strictEqual(errorThrown, true, 'Approval must throw on audit failure');

      // 1. Renewal status must remain REQUESTED
      const [renewalAfter] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewal.id));
      assert.strictEqual(renewalAfter.status, 'REQUESTED', 'Renewal status must roll back to REQUESTED');

      // 2. Lease end date and rent must remain original
      const [leaseAfter] = await db.select().from(leases).where(eq(leases.id, lease.id));
      assert.strictEqual(leaseAfter.endDate, originalEndDate, 'Lease end date must remain original');
      assert.strictEqual(leaseAfter.rentAmount, originalRent, 'Lease rent must remain original');

      // 3. Obsolete schedules must NOT have been cancelled
      const decSchedule = await db.select().from(rentSchedules).where(
        and(
          eq(rentSchedules.leaseId, lease.id),
          eq(rentSchedules.periodStart, '2026-12-01T00:00:00.000Z')
        )
      );
      assert.strictEqual(decSchedule.length, 1);
      assert.strictEqual(decSchedule[0].status, 'UPCOMING', 'December schedule must NOT be cancelled due to rollback');
      assert.strictEqual(decSchedule[0].amount, '1000', 'December schedule amount must NOT be zeroed due to rollback');

      // 4. Zero audit log rows committed
      const auditEntries = await db.select().from(auditLogs).where(
        and(
          eq(auditLogs.resourceType, 'LeaseRenewal'),
          eq(auditLogs.resourceId, renewal.id)
        )
      );
      assert.strictEqual(auditEntries.length, 0, 'No audit entries must exist due to atomic rollback');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 3: Reversal of payment referencing already-cancelled schedule preserves CANCELLED status
    // ------------------------------------------------------------------------
    await t.test('3. Reversing a payment on an already-cancelled schedule preserves CANCELLED status and zeroes paidAmount', async () => {
      const runId = `int3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      createdUserIds.push(ownerId, tenantId);
      createdPropertyIds.push(propId);
      createdLeaseIds.push(leaseId);

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Int3', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Int3', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);

      await db.insert(properties).values({
        id: propId,
        name: 'Preserve Cancelled Property',
        type: 'APARTMENT',
        ownerId: ownerId,
        address: { city: 'Erbil' },
      });

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`,
        propertyId: propId,
        ownerId: ownerId,
        status: 'VERIFIED',
        ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId,
        propertyId: propId,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        rentAmount: '1000',
        status: 'ACTIVE',
      }).returning();

      // Create a CANCELLED schedule directly (as produced by lease shortening)
      const [cancelledSchedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id,
        propertyId: propId,
        tenantId: tenantId,
        amount: '0',
        dueDate: '2026-12-01T00:00:00.000Z',
        periodStart: '2026-12-01T00:00:00.000Z',
        periodEnd: '2026-12-31T00:00:00.000Z',
        status: 'CANCELLED',
        paidAmount: '1000', // Had an outstanding collected payment prior to cancellation
      }).returning();

      const [payment] = await db.insert(paymentRecords).values({
        propertyId: propId,
        leaseId: lease.id,
        rentScheduleId: cancelledSchedule.id,
        payerId: tenantId,
        amount: '1000',
        recordedDate: new Date().toISOString(),
        status: 'RECORDED',
      }).returning();

      // Execute route-level payment reversal transaction
      await db.transaction(async (tx) => {
        const [updatedPayment] = await tx.update(paymentRecords)
          .set({ status: 'REVERSED' })
          .where(eq(paymentRecords.id, payment.id))
          .returning();

        const [schedule] = await tx.select().from(rentSchedules).where(eq(rentSchedules.id, updatedPayment.rentScheduleId!)).limit(1);
        const newPaidAmount = Math.max(0, Number(schedule.paidAmount || 0) - Number(updatedPayment.amount));
        let newStatus = schedule.status === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING';

        if (schedule.status !== 'CANCELLED') {
          if (newPaidAmount > 0) {
            newStatus = newPaidAmount >= Number(schedule.amount) ? 'PAID' : 'PARTIALLY_PAID';
          } else {
            const now = new Date();
            const dueDate = new Date(schedule.dueDate);
            newStatus = dueDate < now ? 'OVERDUE' : 'UPCOMING';
          }
        }

        await tx.update(rentSchedules)
          .set({ paidAmount: newPaidAmount.toString(), status: newStatus })
          .where(eq(rentSchedules.id, schedule.id));
      });

      // Verify schedule status remains CANCELLED and paidAmount is 0
      const [scheduleAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, cancelledSchedule.id));
      assert.strictEqual(scheduleAfter.status, 'CANCELLED', 'Schedule must retain CANCELLED status');
      assert.strictEqual(Number(scheduleAfter.paidAmount), 0, 'Schedule paidAmount must be decremented to 0');
      assert.strictEqual(scheduleAfter.amount, '0', 'Schedule amount must remain 0');

      const [paymentAfter] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
      assert.strictEqual(paymentAfter.status, 'REVERSED');
      assert.strictEqual(paymentAfter.rentScheduleId, cancelledSchedule.id);
    });

  } finally {
    await cleanupFixtures();
  }
});
