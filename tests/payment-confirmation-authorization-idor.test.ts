import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { db, pool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { LeaseRepository } from '../src/server/repositories/leases.js';
import leasesRouter from '../src/server/routes/leases.js';

const testDb = process.env.SQL_DB_NAME || 'homehub_test';
if (testDb !== 'homehub_test') {
  console.error('[SAFETY GATE VIOLATION] Target database must be homehub_test');
  process.exit(1);
}

function getAuthHeader(actor: { id: string; roles: string[]; organizationId?: string }): string {
  const payload = { uid: actor.id, role: actor.roles[0], organizationId: actor.organizationId };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

test('Payment Confirmation Authorization & IDOR Regression Suite (homehub_test)', async (t) => {
  const runId = `idor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Personas
  const ownerAId = `usr_owner_a_${runId}`;
  const ownerBId = `usr_owner_b_${runId}`;
  const tenantId = `usr_tenant_${runId}`;
  const companyMemberAuthorizedId = `usr_mgr_auth_${runId}`;
  const companyMemberUnauthorizedId = `usr_mgr_unauth_${runId}`;
  
  // Organizations
  const companyAuthorizedId = `org_auth_${runId}`;
  const companyUnauthorizedId = `org_unauth_${runId}`;

  // Properties & Agreements
  const propAId = `prop_a_${runId}`;
  const propBId = `prop_b_${runId}`;
  const agreementId = `mgmt_agr_${runId}`;

  // Leases & Schedules
  const leaseAId = `lease_a_${runId}`;
  const schedAId = `sched_a_${runId}`;

  const createdUserIds: string[] = [
    ownerAId, ownerBId, tenantId, companyMemberAuthorizedId, companyMemberUnauthorizedId
  ];
  const createdOrgIds: string[] = [companyAuthorizedId, companyUnauthorizedId];
  const createdPropIds: string[] = [propAId, propBId];
  const createdLeaseIds: string[] = [leaseAId];
  const createdPaymentIds: string[] = [];

  const leaseRepo = new LeaseRepository();

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/leases', leasesRouter);

  // 1. Fixture Setup: Users
  await db.insert(schema.users).values([
    {
      id: ownerAId,
      uid: ownerAId,
      email: `${ownerAId}@homehub.iq`,
      firstName: 'OwnerA',
      lastName: 'AuthTest',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: ownerBId,
      uid: ownerBId,
      email: `${ownerBId}@homehub.iq`,
      firstName: 'OwnerB',
      lastName: 'AuthTest',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: tenantId,
      uid: tenantId,
      email: `${tenantId}@homehub.iq`,
      firstName: 'Tenant',
      lastName: 'AuthTest',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: companyMemberAuthorizedId,
      uid: companyMemberAuthorizedId,
      email: `${companyMemberAuthorizedId}@homehub.iq`,
      firstName: 'ManagerAuth',
      lastName: 'AuthTest',
      roles: ['COMPANY_MEMBER'],
      isActive: true,
    },
    {
      id: companyMemberUnauthorizedId,
      uid: companyMemberUnauthorizedId,
      email: `${companyMemberUnauthorizedId}@homehub.iq`,
      firstName: 'ManagerUnauth',
      lastName: 'AuthTest',
      roles: ['COMPANY_MEMBER'],
      isActive: true,
    },
  ]);

  // 2. Fixture Setup: Organizations & Memberships
  await db.insert(schema.organizations).values([
    {
      id: companyAuthorizedId,
      name: 'Authorized Management Co',
      type: 'COMPANY',
      status: 'VERIFIED',
      verified: true,
    },
    {
      id: companyUnauthorizedId,
      name: 'Unrelated Foreign Co',
      type: 'COMPANY',
      status: 'VERIFIED',
      verified: true,
    },
  ]);

  await db.insert(schema.organizationMembers).values([
    {
      id: `mem_auth_${runId}`,
      organizationId: companyAuthorizedId,
      userId: companyMemberAuthorizedId,
      role: 'PROPERTY_MANAGER',
      status: 'ACTIVE',
    },
    {
      id: `mem_unauth_${runId}`,
      organizationId: companyUnauthorizedId,
      userId: companyMemberUnauthorizedId,
      role: 'PROPERTY_MANAGER',
      status: 'ACTIVE',
    },
  ]);

  // 3. Fixture Setup: Properties
  await db.insert(schema.properties).values([
    {
      id: propAId,
      name: 'Property A (Owned by Owner A)',
      type: 'RESIDENTIAL',
      status: 'PUBLISHED',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',
      managementFee: '0.05',
      currency: 'IQD',
    },
    {
      id: propBId,
      name: 'Property B (Owned by Owner B)',
      type: 'RESIDENTIAL',
      status: 'PUBLISHED',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',
      managementFee: '0.05',
      currency: 'IQD',
    },
  ]);

  // 4. Ownership Records
  await db.insert(schema.ownershipRecords).values([
    {
      propertyId: propAId,
      ownerId: ownerAId,
      ownershipPercentage: '100',
      status: 'VERIFIED',
    },
    {
      propertyId: propBId,
      ownerId: ownerBId,
      ownershipPercentage: '100',
      status: 'VERIFIED',
    },
  ]);

  // 5. Management Agreement: Company Authorized manages Property A with COLLECT_RENT permission
  await db.insert(schema.managementAgreements).values({
    id: agreementId,
    propertyId: propAId,
    companyId: companyAuthorizedId,
    ownerId: ownerAId,
    status: 'ACTIVE',
    startDate: '2026-11-01',
    endDate: '2027-10-31',
    grantedPermissions: ['COLLECT_RENT', 'VIEW_PROPERTY'],
  });

  // 6. Lease on Property A (Rent schedules will be created per payment)
  await db.insert(schema.leases).values({
    id: leaseAId,
    propertyId: propAId,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2028-12-31',
    rentAmount: '1500000',
    currency: 'IQD',
  });

  await db.insert(schema.leaseTenants).values({
    leaseId: leaseAId,
    tenantId,
    isPrimary: true,
  });

  try {
    let scheduleCounter = 0;
    // Helper to create a fresh schedule and RECORDED payment on Property A
    async function createPaymentA(refSuffix: string): Promise<{ paymentId: string; scheduleId: string }> {
      scheduleCounter++;
      const month = String(1 + (scheduleCounter % 12)).padStart(2, '0');
      const year = 2026 + Math.floor(scheduleCounter / 12);
      const scheduleId = `sched_${refSuffix.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${runId}`;
      await db.insert(schema.rentSchedules).values({
        id: scheduleId,
        leaseId: leaseAId,
        propertyId: propAId,
        tenantId,
        dueDate: `${year}-${month}-01`,
        periodStart: `${year}-${month}-01`,
        periodEnd: `${year}-${month}-28`,
        amount: '1500000',
        paidAmount: '0',
        status: 'UPCOMING',
        currency: 'IQD',
      });

      const p = await leaseRepo.recordPayment(
        propAId,
        leaseAId,
        tenantId,
        scheduleId,
        1500000,
        'CASH',
        `REF-IDOR-${refSuffix}-${runId}`,
        ownerAId
      );
      createdPaymentIds.push(p.id);
      return { paymentId: p.id, scheduleId };
    }

    // =========================================================================
    // TEST 1: Unrelated Owner (Owner B) IDOR Attempt on Property A Payment
    // =========================================================================
    await t.test('1. IDOR: Unrelated Owner (Owner B) cannot confirm Owner A payment on Property A', async () => {
      const { paymentId, scheduleId } = await createPaymentA('OWNER-B-ATTEMPT');

      const res = await request(app)
        .post(`/api/leases/payments/${paymentId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerBId, roles: ['PROPERTY_OWNER'] }))
        .send({});

      assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.code, 'AUTHORITY_REQUIRED', 'Error code must be AUTHORITY_REQUIRED');

      // State Invariant Check: Payment is STILL RECORDED, schedule is STILL unpaid
      const [p] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, paymentId));
      assert.strictEqual(p.status, 'RECORDED', 'Payment status must not change');

      const [s] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, scheduleId));
      assert.strictEqual(Number(s.paidAmount), 0, 'Schedule paidAmount must remain 0');
      assert.strictEqual(s.status, 'UPCOMING', 'Schedule status must remain UPCOMING');

      // Ledger Invariant: Zero commissions or journal entries created
      const comms = await db.select().from(schema.commissions).where(eq(schema.commissions.paymentRecordId, paymentId));
      assert.strictEqual(comms.length, 0, 'No commission must be generated for denied request');

      const jes = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.referenceId, paymentId));
      assert.strictEqual(jes.length, 0, 'No journal entry must be posted for denied request');
    });

    // =========================================================================
    // TEST 2: Tenant Self-Confirmation IDOR Attempt
    // =========================================================================
    await t.test('2. IDOR: Tenant cannot confirm their own payment (COLLECT_RENT required)', async () => {
      const { paymentId, scheduleId } = await createPaymentA('TENANT-ATTEMPT');

      const res = await request(app)
        .post(`/api/leases/payments/${paymentId}/confirm`)
        .set('Authorization', getAuthHeader({ id: tenantId, roles: ['TENANT'] }))
        .send({});

      assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.code, 'AUTHORITY_REQUIRED');

      // State Invariant Check
      const [p] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, paymentId));
      assert.strictEqual(p.status, 'RECORDED');

      const [s] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, scheduleId));
      assert.strictEqual(Number(s.paidAmount), 0);
      assert.strictEqual(s.status, 'UPCOMING');
    });

    // =========================================================================
    // TEST 3: Company Member without Management Agreement IDOR Attempt
    // =========================================================================
    await t.test('3. IDOR: Company member of unrelated company cannot confirm payment on Property A', async () => {
      const { paymentId, scheduleId } = await createPaymentA('UNAUTH-MGR-ATTEMPT');

      const res = await request(app)
        .post(`/api/leases/payments/${paymentId}/confirm`)
        .set('Authorization', getAuthHeader({
          id: companyMemberUnauthorizedId,
          roles: ['COMPANY_MEMBER'],
          organizationId: companyUnauthorizedId,
        }))
        .send({});

      assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.code, 'AUTHORITY_REQUIRED');

      // State Invariant Check
      const [p] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, paymentId));
      assert.strictEqual(p.status, 'RECORDED');

      const [s] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, scheduleId));
      assert.strictEqual(Number(s.paidAmount), 0);
      assert.strictEqual(s.status, 'UPCOMING');
    });

    // =========================================================================
    // TEST 4: Parameter Forging Attempt (Caller supplies propertyId in body)
    // =========================================================================
    await t.test('4. IDOR Defense: Attacker cannot bypass authority by supplying their own propertyId in body', async () => {
      const { paymentId, scheduleId } = await createPaymentA('FORGED-PROP-ATTEMPT');

      // Owner B owns Property B. Owner B sends body: { propertyId: propBId }
      // The server must overwrite body.propertyId with payment.propertyId (propAId) and reject with 403.
      const res = await request(app)
        .post(`/api/leases/payments/${paymentId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerBId, roles: ['PROPERTY_OWNER'] }))
        .send({ propertyId: propBId });

      assert.strictEqual(res.status, 403, 'Server must defeat forged propertyId parameter and reject with 403');
      assert.strictEqual(res.body.code, 'AUTHORITY_REQUIRED');

      const [p] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, paymentId));
      assert.strictEqual(p.status, 'RECORDED');

      const [s] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, scheduleId));
      assert.strictEqual(Number(s.paidAmount), 0);
      assert.strictEqual(s.status, 'UPCOMING');
    });

    // =========================================================================
    // TEST 5: Non-Existent Payment ID (Resource Disclosure Defense)
    // =========================================================================
    await t.test('5. Non-Existent Payment ID: Returns 404 NOT_FOUND without resource disclosure', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .post(`/api/leases/payments/${nonExistentId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }))
        .send({});

      assert.strictEqual(res.status, 404, `Expected 404 NOT_FOUND, got ${res.status}`);
      assert.strictEqual(res.body.error, 'NOT_FOUND');
    });

    // =========================================================================
    // TEST 6: Positive Control — Authorized Managing Company Member Confirmation
    // =========================================================================
    await t.test('6. POSITIVE CONTROL: Authorized managing company member with active COLLECT_RENT agreement confirms payment', async () => {
      const { paymentId, scheduleId } = await createPaymentA('AUTH-MGR-CONFIRM');

      const res = await request(app)
        .post(`/api/leases/payments/${paymentId}/confirm`)
        .set('Authorization', getAuthHeader({
          id: companyMemberAuthorizedId,
          roles: ['COMPANY_MEMBER'],
          organizationId: companyAuthorizedId,
        }))
        .send({});

      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.payment.status, 'CONFIRMED');

      // Verify schedule is updated
      const [s] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, scheduleId));
      assert.strictEqual(Number(s.paidAmount), 1500000);
      assert.strictEqual(s.status, 'PAID');

      // Verify commission is posted
      const comms = await db.select().from(schema.commissions).where(eq(schema.commissions.paymentRecordId, paymentId));
      assert.strictEqual(comms.length, 1);
      assert.strictEqual(comms[0].status, 'POSTED');
    });

    // =========================================================================
    // TEST 7: Positive Control — Authorized Verified Property Owner Confirmation
    // =========================================================================
    await t.test('7. POSITIVE CONTROL: Verified Property Owner (Owner A) confirms payment on Property A', async () => {
      const { paymentId, scheduleId } = await createPaymentA('OWNER-A-CONFIRM');

      const res = await request(app)
        .post(`/api/leases/payments/${paymentId}/confirm`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }))
        .send({});

      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.payment.status, 'CONFIRMED');

      const [s] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, scheduleId));
      assert.strictEqual(Number(s.paidAmount), 1500000);
      assert.strictEqual(s.status, 'PAID');
    });

    // =========================================================================
    // TEST 8: Audit Log Security Verification
    // =========================================================================
    await t.test('8. Security Audit: Denied requests log DENIED_ACCESS_COLLECT_RENT events', async () => {
      const auditEntries = await db.select().from(schema.auditLogs).where(and(
        eq(schema.auditLogs.action, 'DENIED_ACCESS_COLLECT_RENT'),
        eq(schema.auditLogs.resourceId, propAId)
      ));

      assert.ok(auditEntries.length >= 3, `Expected at least 3 denial audit records, found ${auditEntries.length}`);
    });

  } finally {
    // Deterministic Cleanup
    for (const pId of createdPaymentIds) {
      const jes = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.referenceId, pId)).catch(() => []);
      for (const je of jes) {
        await db.delete(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, je.id)).catch(() => {});
        await db.delete(schema.journalEntries).where(eq(schema.journalEntries.id, je.id)).catch(() => {});
      }
      await db.delete(schema.commissions).where(eq(schema.commissions.paymentRecordId, pId)).catch(() => {});
      await db.delete(schema.paymentRecords).where(eq(schema.paymentRecords.id, pId)).catch(() => {});
    }
    for (const lId of createdLeaseIds) {
      await db.delete(schema.rentSchedules).where(eq(schema.rentSchedules.leaseId, lId)).catch(() => {});
      await db.delete(schema.leaseTenants).where(eq(schema.leaseTenants.leaseId, lId)).catch(() => {});
      await db.delete(schema.leases).where(eq(schema.leases.id, lId)).catch(() => {});
    }
    await db.delete(schema.managementAgreements).where(eq(schema.managementAgreements.id, agreementId)).catch(() => {});
    for (const prId of createdPropIds) {
      await db.delete(schema.ownershipRecords).where(eq(schema.ownershipRecords.propertyId, prId)).catch(() => {});
      await db.delete(schema.properties).where(eq(schema.properties.id, prId)).catch(() => {});
    }
    for (const orgId of createdOrgIds) {
      await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId)).catch(() => {});
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId)).catch(() => {});
    }
    for (const uId of createdUserIds) {
      await db.delete(schema.users).where(eq(schema.users.id, uId)).catch(() => {});
    }
    await db.delete(schema.auditLogs).where(eq(schema.auditLogs.resourceId, propAId)).catch(() => {});
    await pool.end();
  }
});
