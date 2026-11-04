import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants, rentSchedules, paymentRecords, commissions, financialPolicies, auditLogs } from '../src/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import leasesRouter from '../src/server/routes/leases.js';

dotenv.config({ override: false });

process.env.NODE_ENV = 'test';

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

test('Digital Payment Confirmation API Integration Suite (F-01)', async (t) => {
  assertSafeDatabaseConfig();

  const connCheck = await (db as any).execute('SELECT current_database() as db_name');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(activeDb, TARGET_TEST_DATABASE, `Must be connected to '${TARGET_TEST_DATABASE}'. Got: '${activeDb}'`);

  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdPaymentIds: string[] = [];

  async function cleanupFixtures() {
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

  // Ensure active 3-Fee policy exists
  await db.insert(financialPolicies).values({
    policyType: 'PLATFORM_FEE_RATE',
    policyValue: '0.02',
    active: true,
    effectiveFrom: new Date()
  }).onConflictDoNothing();

  const runId = `f01_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const ownerId = `owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const foreignOwnerId = `foreign_owner_${runId}`;
  const propId = `prop_${runId}`;
  const leaseId = `lease_${runId}`;
  const scheduleId = `sched_${runId}`;

  // Seed base users
  await db.insert(users).values([
    { id: ownerId, uid: ownerId, firstName: 'Authorized', lastName: 'Owner', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: tenantId, uid: tenantId, firstName: 'Authorized', lastName: 'Tenant', email: `${tenantId}@test.com`, roles: ['TENANT'] },
    { id: foreignOwnerId, uid: foreignOwnerId, firstName: 'Foreign', lastName: 'Owner', email: `${foreignOwnerId}@test.com`, roles: ['PROPERTY_OWNER'] },
  ]);
  createdUserIds.push(ownerId, tenantId, foreignOwnerId);

  // Seed property & verified ownership
  await db.insert(properties).values({
    id: propId,
    name: 'F01 Digital Confirmation Prop',
    type: 'RESIDENTIAL',
    operatingModel: 'DIRECT_RENTAL',
    status: 'ACTIVE'
  });
  createdPropertyIds.push(propId);

  await db.insert(ownershipRecords).values({
    id: `own_${propId}`,
    propertyId: propId,
    ownerId: ownerId,
    ownershipPercentage: '100',
    status: 'VERIFIED'
  });

  // Seed active lease & primary tenant
  await db.insert(leases).values({
    id: leaseId,
    propertyId: propId,
    startDate: '2026-11-01',
    endDate: '2027-11-01',
    rentAmount: '1000000',
    status: 'ACTIVE'
  });
  createdLeaseIds.push(leaseId);

  await db.insert(leaseTenants).values({
    leaseId: leaseId,
    tenantId: tenantId,
    isPrimary: true
  });

  // Seed rent schedule (1,000,000 IQD)
  await db.insert(rentSchedules).values({
    id: scheduleId,
    leaseId: leaseId,
    propertyId: propId,
    tenantId: tenantId,
    dueDate: '2026-11-01',
    amount: '1000000',
    paidAmount: '0',
    status: 'UPCOMING',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    currency: 'IQD'
  });

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: Authorized owner confirms a supported FIB digital payment
    // ------------------------------------------------------------------------
    await t.test('1. Authorized owner confirms supported FIB payment with valid reference', async () => {
      const paymentId = `pay_fib_${runId}`;
      await db.insert(paymentRecords).values({
        id: paymentId,
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: '600000',
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: `FIB-TXN-${runId}`,
        status: 'RECORDED',
        recordedDate: new Date().toISOString()
      });
      createdPaymentIds.push(paymentId);

      const res = await request(app)
        .post(`/api/leases/payments/${paymentId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({});

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.payment.status, 'CONFIRMED');
      assert.strictEqual(res.body.payment.confirmedByUserId, ownerId);

      // Verify schedule updated in PostgreSQL
      const [sched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
      assert.strictEqual(Number(sched.paidAmount), 600000, 'Schedule paidAmount must reflect confirmed 600,000 IQD');
      assert.strictEqual(sched.status, 'PARTIALLY_PAID', 'Schedule status must transition to PARTIALLY_PAID');

      // Verify commission created
      const comms = await db.select().from(commissions).where(eq(commissions.paymentRecordId, paymentId));
      assert.strictEqual(comms.length, 1, 'Commission record must be generated');

      // Verify audit log has CONFIRM_DIGITAL_PAYMENT
      const audits = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.resourceId, paymentId), eq(auditLogs.action, 'CONFIRM_DIGITAL_PAYMENT')))
        .orderBy(desc(auditLogs.timestamp))
        .limit(1);
      assert.strictEqual(audits.length, 1, 'Audit log must record CONFIRM_DIGITAL_PAYMENT');
      assert.strictEqual(audits[0].actorUserId, ownerId);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: All supported digital payment methods (FASTPAY, ZAINCASH, BANK_TRANSFER)
    // ------------------------------------------------------------------------
    await t.test('2. Supported digital payment methods (FASTPAY, ZAINCASH, BANK_TRANSFER) succeed', async () => {
      const methods = ['FASTPAY', 'ZAINCASH', 'BANK_TRANSFER'] as const;
      for (const method of methods) {
        const pId = `pay_${method.toLowerCase()}_${runId}`;
        await db.insert(paymentRecords).values({
          id: pId,
          propertyId: propId,
          leaseId: leaseId,
          rentScheduleId: scheduleId,
          payerId: tenantId,
          amount: '100000',
          currency: 'IQD',
          paymentMethod: method,
          referenceNumber: `${method}-REF-${runId}`,
          status: 'RECORDED',
          recordedDate: new Date().toISOString()
        });
        createdPaymentIds.push(pId);

        const res = await request(app)
          .post(`/api/leases/payments/${pId}/confirm`)
          .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
          .send({});

        assert.strictEqual(res.status, 200, `${method} confirmation must succeed with 200`);
        assert.strictEqual(res.body.payment.status, 'CONFIRMED');
        assert.strictEqual(res.body.payment.paymentMethod, method);
      }
    });

    // ------------------------------------------------------------------------
    // SCENARIO 3: Unsupported payment method is rejected with 400 INVALID_METHOD
    // ------------------------------------------------------------------------
    await t.test('3. Unsupported payment method is rejected with 400 INVALID_METHOD', async () => {
      const pId = `pay_unsupported_${runId}`;
      await db.insert(paymentRecords).values({
        id: pId,
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: '50000',
        currency: 'IQD',
        paymentMethod: 'CRYPTO',
        referenceNumber: `BTC-${runId}`,
        status: 'RECORDED',
        recordedDate: new Date().toISOString()
      });
      createdPaymentIds.push(pId);

      const res = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({});

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'INVALID_METHOD');

      // Verify payment row was not mutated
      const [pmt] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, pId));
      assert.strictEqual(pmt.status, 'RECORDED', 'Payment must remain RECORDED');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 4: Missing verification evidence (empty reference) is rejected
    // ------------------------------------------------------------------------
    await t.test('4. Digital payment without reference number is rejected with 400 MISSING_VERIFICATION_EVIDENCE', async () => {
      const pId = `pay_no_ref_${runId}`;
      await db.insert(paymentRecords).values({
        id: pId,
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: '50000',
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: '   ', // whitespace only
        status: 'RECORDED',
        recordedDate: new Date().toISOString()
      });
      createdPaymentIds.push(pId);

      const res = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({});

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'MISSING_VERIFICATION_EVIDENCE');

      const [pmt] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, pId));
      assert.strictEqual(pmt.status, 'RECORDED', 'Payment must remain RECORDED on validation failure');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 5: Supplying reference number in confirmation body validates and updates reference
    // ------------------------------------------------------------------------
    await t.test('5. Providing referenceNumber in request body satisfies verification evidence', async () => {
      const pId = `pay_body_ref_${runId}`;
      await db.insert(paymentRecords).values({
        id: pId,
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: '50000',
        currency: 'IQD',
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: null,
        status: 'RECORDED',
        recordedDate: new Date().toISOString()
      });
      createdPaymentIds.push(pId);

      const suppliedRef = `BANK-WIRE-VERIFIED-${runId}`;
      const res = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({ referenceNumber: suppliedRef });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.payment.status, 'CONFIRMED');
      assert.strictEqual(res.body.payment.referenceNumber, suppliedRef);

      const [pmt] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, pId));
      assert.strictEqual(pmt.referenceNumber, suppliedRef, 'Supplied reference number must be persisted');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 6: Unauthorized caller cannot confirm payment
    // ------------------------------------------------------------------------
    await t.test('6. Unauthorized caller without COLLECT_RENT permission receives 403', async () => {
      const pId = `pay_unauth_${runId}`;
      await db.insert(paymentRecords).values({
        id: pId,
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: '50000',
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: `FIB-UNAUTH-${runId}`,
        status: 'RECORDED',
        recordedDate: new Date().toISOString()
      });
      createdPaymentIds.push(pId);

      // 6a: Foreign owner lacking ownership on this property
      const resForeign = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .set('Authorization', getAuthHeader({ id: foreignOwnerId, roles: ['PROPERTY_OWNER'] }))
        .send({});
      assert.strictEqual(resForeign.status, 403);

      // 6b: Tenant role
      const resTenant = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .set('Authorization', getAuthHeader({ id: tenantId, roles: ['TENANT'] }))
        .send({});
      assert.strictEqual(resTenant.status, 403);

      // Payment remains RECORDED
      const [pmt] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, pId));
      assert.strictEqual(pmt.status, 'RECORDED');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 7: Unauthenticated request receives 401
    // ------------------------------------------------------------------------
    await t.test('7. Unauthenticated request receives 401 UNAUTHORIZED', async () => {
      const pId = `pay_noauth_${runId}`;
      await db.insert(paymentRecords).values({
        id: pId,
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: '50000',
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: `FIB-NOAUTH-${runId}`,
        status: 'RECORDED',
        recordedDate: new Date().toISOString()
      });
      createdPaymentIds.push(pId);

      const res = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .send({});
      assert.strictEqual(res.status, 401);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 8: Payment not in RECORDED status cannot be confirmed
    // ------------------------------------------------------------------------
    await t.test('8. Non-RECORDED payment (e.g. FAILED) is rejected with 400 INVALID_STATE', async () => {
      const pId = `pay_failed_${runId}`;
      await db.insert(paymentRecords).values({
        id: pId,
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: '50000',
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: `FIB-FAIL-${runId}`,
        status: 'FAILED',
        recordedDate: new Date().toISOString()
      });
      createdPaymentIds.push(pId);

      const res = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({});
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'INVALID_STATE');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 9: Existing CASH confirmation behavior remains intact
    // ------------------------------------------------------------------------
    await t.test('9. Existing CASH payment confirmation remains intact with CONFIRM_CASH_PAYMENT audit', async () => {
      const pId = `pay_cash_${runId}`;
      await db.insert(paymentRecords).values({
        id: pId,
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: '100000',
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `CASH-${runId}`,
        status: 'RECORDED',
        recordedDate: new Date().toISOString()
      });
      createdPaymentIds.push(pId);

      const res = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({});

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.payment.status, 'CONFIRMED');

      const audits = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.resourceId, pId), eq(auditLogs.action, 'CONFIRM_CASH_PAYMENT')))
        .limit(1);
      assert.strictEqual(audits.length, 1, 'CASH payment must use CONFIRM_CASH_PAYMENT audit action');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 10: Non-existent payment returns 404 NOT_FOUND
    // ------------------------------------------------------------------------
    await t.test('10. Non-existent payment returns 404 NOT_FOUND', async () => {
      const res = await request(app)
        .post(`/api/leases/payments/00000000-0000-0000-0000-000000000000/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({});
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'NOT_FOUND');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 11: Idempotent re-confirmation does not duplicate commission or balance
    // ------------------------------------------------------------------------
    await t.test('11. Idempotent re-confirmation returns success without double-posting', async () => {
      const pId = `pay_idemp_${runId}`;
      await db.insert(paymentRecords).values({
        id: pId,
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: '50000',
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: `FIB-IDEMP-${runId}`,
        status: 'RECORDED',
        recordedDate: new Date().toISOString()
      });
      createdPaymentIds.push(pId);

      // First confirmation
      const res1 = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({});
      assert.strictEqual(res1.status, 200);

      const [schedBefore] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
      const commCountBefore = (await db.select().from(commissions).where(eq(commissions.paymentRecordId, pId))).length;

      // Repeat confirmation
      const res2 = await request(app)
        .post(`/api/leases/payments/${pId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .send({});
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.message, 'Payment is already confirmed');

      const [schedAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
      const commCountAfter = (await db.select().from(commissions).where(eq(commissions.paymentRecordId, pId))).length;

      assert.strictEqual(schedAfter.paidAmount, schedBefore.paidAmount, 'Schedule paidAmount must not increment on reconfirmation');
      assert.strictEqual(commCountAfter, commCountBefore, 'Commission count must not increment on reconfirmation');
    });

  } finally {
    await cleanupFixtures();
  }
});
