import './safe-test-env.js';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants, rentSchedules, paymentRecords, commissions, journalEntries, ledgerLines, auditLogs } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { LeaseRepository } from '../src/server/repositories/leases.js';
import { CommissionService } from '../src/server/services/commission.js';
import leasesRouter from '../src/server/routes/leases.js';

// Set explicit test-mode gates for this test process
process.env.NODE_ENV = 'test';
process.env.ENABLE_TEST_FAILURE_INJECTION = 'true';

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

test('Atomic Payment Reversal, Recovery Audit Consistency, and Failure Hook Hardening (homehub_test)', async (t) => {
  assertSafeDatabaseConfig();

  const connCheck = await (db as any).execute('SELECT current_database() as db_name');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(activeDb, TARGET_TEST_DATABASE, `Must be connected to '${TARGET_TEST_DATABASE}'. Got: '${activeDb}'`);

  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdPaymentIds: string[] = [];

  async function cleanupFixtures() {
    // Note: audit_logs, journal_entries, and ledger_lines are strictly append-only (DELETE=false for homehub_app).
    for (const pId of createdPaymentIds) {
      await db.delete(commissions).where(eq(commissions.paymentRecordId, pId)).catch(() => {});
      await db.delete(paymentRecords).where(eq(paymentRecords.id, pId)).catch(() => {});
    }
    for (const leaseId of createdLeaseIds) {
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
    // SCENARIO 1: Full Atomic Success (Normal Reversal)
    // ------------------------------------------------------------------------
    await t.test('1. Successful normal reversal: payment, schedule, commission, journal, ledger, and audits are consistent', async () => {
      const runId = `atom1_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Atom1', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Atom1', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);
      createdUserIds.push(ownerId, tenantId);

      await db.insert(properties).values({
        id: propId, name: 'Atomic Reversal Property', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED', rentFee: '0.02', managementFee: '0.03'
      });
      createdPropertyIds.push(propId);

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      createdLeaseIds.push(lease.id);

      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      const [schedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id, propertyId: propId, tenantId, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z', dueDate: '2026-01-05T00:00:00.000Z', paidAmount: '0'
      }).returning();

      const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, schedule.id, 1000, 'CASH', 'REF-ATOM-1');
      createdPaymentIds.push(payment.id);
      await leaseRepo.confirmPayment(payment.id, ownerId);
      await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

      const res = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Overcharge adjustment' });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.payment.status, 'REVERSED');
      assert.ok(res.body.commissionReversal, 'Commission reversal should be returned');

      const [paymentAfter] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
      assert.strictEqual(paymentAfter.status, 'REVERSED');

      const [scheduleAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule.id));
      assert.strictEqual(Number(scheduleAfter.paidAmount), 0);

      const [commAfter] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
      assert.strictEqual(commAfter.status, 'REVERSED');

      const reversalJournal = await db.select().from(journalEntries).where(and(
        eq(journalEntries.referenceType, 'FEE_REVERSAL'),
        eq(journalEntries.referenceId, commAfter.id)
      ));
      assert.strictEqual(reversalJournal.length, 1, 'Exactly one compensating journal entry must exist');

      const paymentAudit = await db.select().from(auditLogs).where(and(
        eq(auditLogs.resourceType, 'PaymentRecord'),
        eq(auditLogs.resourceId, payment.id),
        eq(auditLogs.action, 'REVERSE_PAYMENT')
      ));
      assert.strictEqual(paymentAudit.length, 1, 'Exactly one REVERSE_PAYMENT audit log must exist');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: Injected Commission Reversal Failure (Atomic Rollback)
    // ------------------------------------------------------------------------
    await t.test('2. Injected commission-reversal failure: payment and schedule roll back completely', async () => {
      const runId = `atom2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Atom2', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Atom2', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);
      createdUserIds.push(ownerId, tenantId);

      await db.insert(properties).values({
        id: propId, name: 'Rollback Comm Property', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED'
      });
      createdPropertyIds.push(propId);

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      createdLeaseIds.push(lease.id);

      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      const [schedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id, propertyId: propId, tenantId, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z', dueDate: '2026-01-05T00:00:00.000Z', paidAmount: '0'
      }).returning();

      const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, schedule.id, 1000, 'CASH', 'REF-ATOM-2');
      createdPaymentIds.push(payment.id);
      await leaseRepo.confirmPayment(payment.id, ownerId);
      await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

      const res = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Failed reversal test', _simulateFailure: 'COMMISSION_FAILURE' });

      assert.strictEqual(res.status, 400, 'Must return 400 on injected commission failure');
      assert.ok(res.body.message.includes('SIMULATED_COMMISSION_FAILURE'));

      const [paymentAfter] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
      assert.strictEqual(paymentAfter.status, 'CONFIRMED', 'Payment must roll back to CONFIRMED');

      const [scheduleAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule.id));
      assert.strictEqual(scheduleAfter.status, 'PAID', 'Schedule must roll back to PAID');
      assert.strictEqual(scheduleAfter.paidAmount, '1000', 'Schedule paidAmount must remain 1000');

      const [commAfter] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
      assert.strictEqual(commAfter.status, 'POSTED', 'Commission must remain POSTED');

      const reversalJournals = await db.select().from(journalEntries).where(and(
        eq(journalEntries.referenceType, 'FEE_REVERSAL'),
        eq(journalEntries.referenceId, commAfter.id)
      ));
      assert.strictEqual(reversalJournals.length, 0, 'No reversal journal entries must exist due to atomic rollback');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 3: Injected Audit-Log Failure (Atomic Rollback)
    // ------------------------------------------------------------------------
    await t.test('3. Injected audit-log failure: all required reversal mutations roll back', async () => {
      const runId = `atom3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Atom3', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Atom3', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);
      createdUserIds.push(ownerId, tenantId);

      await db.insert(properties).values({
        id: propId, name: 'Rollback Audit Property', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED'
      });
      createdPropertyIds.push(propId);

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      createdLeaseIds.push(lease.id);

      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      const [schedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id, propertyId: propId, tenantId, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z', dueDate: '2026-01-05T00:00:00.000Z', paidAmount: '0'
      }).returning();

      const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, schedule.id, 1000, 'CASH', 'REF-ATOM-3');
      createdPaymentIds.push(payment.id);
      await leaseRepo.confirmPayment(payment.id, ownerId);
      await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

      const res = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Failed audit test', _simulateFailure: 'AUDIT_FAILURE' });

      assert.strictEqual(res.status, 400, 'Must return 400 on injected audit failure');
      assert.ok(res.body.message.includes('SIMULATED_AUDIT_FAILURE'));

      const [paymentAfter] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
      assert.strictEqual(paymentAfter.status, 'CONFIRMED', 'Payment must roll back to CONFIRMED');

      const [scheduleAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule.id));
      assert.strictEqual(scheduleAfter.status, 'PAID', 'Schedule must remain PAID');

      const [commAfter] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
      assert.strictEqual(commAfter.status, 'POSTED', 'Commission must remain POSTED');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 4: Failure-Injection Gate Disabled (Fails Closed in Normal/Dev/Prod)
    // ------------------------------------------------------------------------
    await t.test('4. Failure-injection hooks are disabled unless the explicit test-only gate is satisfied', async () => {
      const runId = `atom4_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Atom4', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Atom4', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);
      createdUserIds.push(ownerId, tenantId);

      await db.insert(properties).values({
        id: propId, name: 'Gate Disabled Property', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED'
      });
      createdPropertyIds.push(propId);

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      createdLeaseIds.push(lease.id);

      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      const [schedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id, propertyId: propId, tenantId, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z', dueDate: '2026-01-05T00:00:00.000Z', paidAmount: '0'
      }).returning();

      const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, schedule.id, 1000, 'CASH', 'REF-ATOM-4');
      createdPaymentIds.push(payment.id);
      await leaseRepo.confirmPayment(payment.id, ownerId);
      await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');

      // Temporarily disable explicit test injection gate
      process.env.ENABLE_TEST_FAILURE_INJECTION = 'false';

      try {
        // Send request with _simulateFailure payload; because the gate is false, failure must NOT be injected
        const res = await request(app)
          .post(`/api/leases/payments/${payment.id}/reverse`)
          .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
          .send({ reason: 'Reversal with disabled hook', _simulateFailure: 'COMMISSION_FAILURE' });

        assert.strictEqual(res.status, 200, 'Reversal must succeed when hook gate is disabled');
        assert.strictEqual(res.body.payment.status, 'REVERSED');
      } finally {
        // Restore test flag
        process.env.ENABLE_TEST_FAILURE_INJECTION = 'true';
      }
    });

    // ------------------------------------------------------------------------
    // SCENARIO 5: Already-reversed payment + commission already reversed + missing REVERSE_PAYMENT audit
    // (Restores exactly one required audit record with authoritative data)
    // ------------------------------------------------------------------------
    await t.test('5. Already-reversed payment + commission already reversed + missing REVERSE_PAYMENT audit: restores exactly one audit record', async () => {
      const runId = `atom5_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Atom5', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Atom5', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);
      createdUserIds.push(ownerId, tenantId);

      await db.insert(properties).values({
        id: propId, name: 'Missing Audit Recovery Property', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED'
      });
      createdPropertyIds.push(propId);

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      createdLeaseIds.push(lease.id);

      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      const [schedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id, propertyId: propId, tenantId, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z', dueDate: '2026-01-05T00:00:00.000Z', paidAmount: '0'
      }).returning();

      // Create an already-REVERSED payment record
      const [payment] = await db.insert(paymentRecords).values({
        propertyId: propId, leaseId: lease.id, rentScheduleId: schedule.id, payerId: tenantId, amount: '1000', paymentMethod: 'CASH', status: 'REVERSED', recordedDate: new Date().toISOString()
      }).returning();
      createdPaymentIds.push(payment.id);

      // Create an already-REVERSED commission record with an authoritative fee reversal audit
      const [comm] = await db.insert(commissions).values({
        propertyId: propId, leaseId: lease.id, tenantId, ownerId, paymentRecordId: payment.id, rate: '0.05', baseAmount: '1000', commissionAmount: '50', currency: 'IQD', status: 'REVERSED', policyVersion: 'v1.0'
      }).returning();

      await db.insert(auditLogs).values({
        id: `audit_fee_${runId}`,
        timestamp: new Date(),
        actorUserId: ownerId,
        actorRole: 'PROPERTY_OWNER',
        action: 'HOMEHUB_FEES_REVERSED',
        resourceType: 'Commission',
        resourceId: comm.id,
        changes: { paymentRecordId: payment.id, commissionAmount: '50', reason: 'Original historical fee reversal reason' },
        ipAddress: '127.0.0.1',
      });

      // Verify no REVERSE_PAYMENT audit exists before recovery
      const preAudit = await db.select().from(auditLogs).where(and(
        eq(auditLogs.resourceType, 'PaymentRecord'),
        eq(auditLogs.resourceId, payment.id),
        eq(auditLogs.action, 'REVERSE_PAYMENT')
      ));
      assert.strictEqual(preAudit.length, 0, 'No REVERSE_PAYMENT audit must exist prior to recovery');

      // Call reversal endpoint to trigger recovery
      const res = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Recovery caller reason' });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.recoveredAudit, true);
      assert.strictEqual(res.body.recoveredCommission, false, 'Commission was already reversed and must not be re-reversed');

      // Verify exactly ONE REVERSE_PAYMENT audit record now exists
      const postAudit = await db.select().from(auditLogs).where(and(
        eq(auditLogs.resourceType, 'PaymentRecord'),
        eq(auditLogs.resourceId, payment.id),
        eq(auditLogs.action, 'REVERSE_PAYMENT')
      ));
      assert.strictEqual(postAudit.length, 1, 'Exactly one REVERSE_PAYMENT audit log must now exist');
      assert.strictEqual((postAudit[0].changes as any).recovered, true);
      assert.strictEqual((postAudit[0].changes as any).originalReversalActorUserId, ownerId);
      assert.strictEqual((postAudit[0].changes as any).reason, 'Original historical fee reversal reason');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 6: Repeated Recovery Idempotency
    // (Subsequent recovery calls do not duplicate audit records or commission reversals)
    // ------------------------------------------------------------------------
    await t.test('6. Repeated recovery does not duplicate audit or commission-reversal records', async () => {
      const runId = `atom6_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Atom6', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Atom6', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);
      createdUserIds.push(ownerId, tenantId);

      await db.insert(properties).values({
        id: propId, name: 'Repeat Recovery Property', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED'
      });
      createdPropertyIds.push(propId);

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      createdLeaseIds.push(lease.id);

      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      const [schedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id, propertyId: propId, tenantId, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z', dueDate: '2026-01-05T00:00:00.000Z', paidAmount: '0'
      }).returning();

      const [payment] = await db.insert(paymentRecords).values({
        propertyId: propId, leaseId: lease.id, rentScheduleId: schedule.id, payerId: tenantId, amount: '1000', paymentMethod: 'CASH', status: 'REVERSED', recordedDate: new Date().toISOString()
      }).returning();
      createdPaymentIds.push(payment.id);

      const [comm] = await db.insert(commissions).values({
        propertyId: propId, leaseId: lease.id, tenantId, ownerId, paymentRecordId: payment.id, rate: '0.05', baseAmount: '1000', commissionAmount: '50', currency: 'IQD', status: 'REVERSED', policyVersion: 'v1.0'
      }).returning();

      // First call recovers missing audit
      const res1 = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Initial recovery call' });

      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.recoveredAudit, true);

      // Second call (retry) returns already reversed and does NOT duplicate
      const res2 = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Second recovery retry call' });

      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.message, 'Payment is already reversed');

      // Assert exactly 1 audit record exists
      const audits = await db.select().from(auditLogs).where(and(
        eq(auditLogs.resourceType, 'PaymentRecord'),
        eq(auditLogs.resourceId, payment.id),
        eq(auditLogs.action, 'REVERSE_PAYMENT')
      ));
      assert.strictEqual(audits.length, 1, 'Exactly one REVERSE_PAYMENT audit log must exist, zero duplicates');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 7: Concurrent Recovery Requests for the Same Payment
    // (Race condition: row lock ensures exactly one audit record is created)
    // ------------------------------------------------------------------------
    await t.test('7. Concurrent recovery requests for the same payment do not create duplicate audit events or compensating entries', async () => {
      const runId = `atom7_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Atom7', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Atom7', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);
      createdUserIds.push(ownerId, tenantId);

      await db.insert(properties).values({
        id: propId, name: 'Concurrent Recovery Property', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED'
      });
      createdPropertyIds.push(propId);

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      createdLeaseIds.push(lease.id);

      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      const [schedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id, propertyId: propId, tenantId, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z', dueDate: '2026-01-05T00:00:00.000Z', paidAmount: '0'
      }).returning();

      const [payment] = await db.insert(paymentRecords).values({
        propertyId: propId, leaseId: lease.id, rentScheduleId: schedule.id, payerId: tenantId, amount: '1000', paymentMethod: 'CASH', status: 'REVERSED', recordedDate: new Date().toISOString()
      }).returning();
      createdPaymentIds.push(payment.id);

      const [comm] = await db.insert(commissions).values({
        propertyId: propId, leaseId: lease.id, tenantId, ownerId, paymentRecordId: payment.id, rate: '0.05', baseAmount: '1000', commissionAmount: '50', currency: 'IQD', status: 'REVERSED', policyVersion: 'v1.0'
      }).returning();

      // Launch two concurrent recovery calls simultaneously
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/leases/payments/${payment.id}/reverse`)
          .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
          .send({ reason: 'Concurrent recovery attempt A' }),
        request(app)
          .post(`/api/leases/payments/${payment.id}/reverse`)
          .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
          .send({ reason: 'Concurrent recovery attempt B' }),
      ]);

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(resB.status, 200);

      // Verify that across both requests, exactly ONE audit log was created
      const audits = await db.select().from(auditLogs).where(and(
        eq(auditLogs.resourceType, 'PaymentRecord'),
        eq(auditLogs.resourceId, payment.id),
        eq(auditLogs.action, 'REVERSE_PAYMENT')
      ));
      assert.strictEqual(audits.length, 1, 'Row lock must guarantee exactly 1 REVERSE_PAYMENT audit log despite concurrent requests');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 8: Recovery with an Unreversed Commission
    // (Completes commission reversal and audit restoration safely and idempotently)
    // ------------------------------------------------------------------------
    await t.test('8. Recovery with an unreversed commission still completes safely and idempotently', async () => {
      const runId = `atom8_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Atom8', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Atom8', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);
      createdUserIds.push(ownerId, tenantId);

      await db.insert(properties).values({
        id: propId, name: 'Unreversed Comm Recovery Property', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED'
      });
      createdPropertyIds.push(propId);

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      createdLeaseIds.push(lease.id);

      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      const [schedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id, propertyId: propId, tenantId, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z', dueDate: '2026-01-05T00:00:00.000Z', paidAmount: '0'
      }).returning();

      // Create a payment already marked REVERSED
      const [payment] = await db.insert(paymentRecords).values({
        propertyId: propId, leaseId: lease.id, rentScheduleId: schedule.id, payerId: tenantId, amount: '1000', paymentMethod: 'CASH', status: 'REVERSED', recordedDate: new Date().toISOString()
      }).returning();
      createdPaymentIds.push(payment.id);

      // But commission is still in POSTED status (broken previous run)
      const [comm] = await db.insert(commissions).values({
        propertyId: propId, leaseId: lease.id, tenantId, ownerId, paymentRecordId: payment.id, rate: '0.05', baseAmount: '1000', commissionAmount: '50', currency: 'IQD', status: 'POSTED', policyVersion: 'v1.0'
      }).returning();

      // Call reversal endpoint
      const res = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Recovering unreversed commission' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.recoveredCommission, true);
      assert.strictEqual(res.body.recoveredAudit, true);

      // Commission is now REVERSED
      const [commAfter] = await db.select().from(commissions).where(eq(commissions.id, comm.id));
      assert.strictEqual(commAfter.status, 'REVERSED');

      // Compensating journal entry created
      const reversalJournals = await db.select().from(journalEntries).where(and(
        eq(journalEntries.referenceType, 'FEE_REVERSAL'),
        eq(journalEntries.referenceId, comm.id)
      ));
      assert.strictEqual(reversalJournals.length, 1);

      // Exactly 1 REVERSE_PAYMENT audit log exists
      const audits = await db.select().from(auditLogs).where(and(
        eq(auditLogs.resourceType, 'PaymentRecord'),
        eq(auditLogs.resourceId, payment.id),
        eq(auditLogs.action, 'REVERSE_PAYMENT')
      ));
      assert.strictEqual(audits.length, 1);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 9: Cancelled Rent Schedules Remain Cancelled During Recovery & Reversal
    // ------------------------------------------------------------------------
    await t.test('9. Cancelled rent schedules remain cancelled during recovery', async () => {
      const runId = `atom9_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ownerId = `owner_${runId}`;
      const tenantId = `tenant_${runId}`;
      const propId = `prop_${runId}`;
      const leaseId = `lease_${runId}`;

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Atom9', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Atom9', email: `${tenantId}@test.com`, roles: ['TENANT'] },
      ]);
      createdUserIds.push(ownerId, tenantId);

      await db.insert(properties).values({
        id: propId, name: 'Cancelled Schedule Recovery Property', type: 'APARTMENT', ownerId, address: { city: 'Erbil' }, operatingModel: 'FULLY_MANAGED'
      });
      createdPropertyIds.push(propId);

      await db.insert(ownershipRecords).values({
        id: `own_${propId}`, propertyId: propId, ownerId, status: 'VERIFIED', ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId, propertyId: propId, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', rentAmount: '1000', status: 'ACTIVE'
      }).returning();
      createdLeaseIds.push(lease.id);

      await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId, isPrimary: true });

      // Create CANCELLED rent schedule with initial paidAmount
      const [cancelledSchedule] = await db.insert(rentSchedules).values({
        leaseId: lease.id, propertyId: propId, tenantId, amount: '0', currency: 'IQD', status: 'CANCELLED', periodStart: '2026-12-01T00:00:00.000Z', periodEnd: '2026-12-31T00:00:00.000Z', dueDate: '2026-12-05T00:00:00.000Z', paidAmount: '1000'
      }).returning();

      // Payment is already REVERSED, but linked to this CANCELLED schedule
      const [payment] = await db.insert(paymentRecords).values({
        propertyId: propId, leaseId: lease.id, rentScheduleId: cancelledSchedule.id, payerId: tenantId, amount: '1000', paymentMethod: 'CASH', status: 'REVERSED', recordedDate: new Date().toISOString()
      }).returning();
      createdPaymentIds.push(payment.id);

      const [comm] = await db.insert(commissions).values({
        propertyId: propId, leaseId: lease.id, tenantId, ownerId, paymentRecordId: payment.id, rate: '0.05', baseAmount: '1000', commissionAmount: '50', currency: 'IQD', status: 'REVERSED', policyVersion: 'v1.0'
      }).returning();

      // Trigger recovery
      const res = await request(app)
        .post(`/api/leases/payments/${payment.id}/reverse`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ reason: 'Recovery with cancelled schedule' });

      assert.strictEqual(res.status, 200);

      // Verify schedule status strictly remains CANCELLED and paidAmount is updated to 0
      const [scheduleAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, cancelledSchedule.id));
      assert.strictEqual(scheduleAfter.status, 'CANCELLED', 'Status must strictly remain CANCELLED');
      assert.strictEqual(Number(scheduleAfter.paidAmount), 0, 'paidAmount must be updated to 0');
    });

  } finally {
    await cleanupFixtures();
  }
});
