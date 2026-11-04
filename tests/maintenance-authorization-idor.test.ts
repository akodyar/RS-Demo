import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { db, pool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import maintenanceRouter from '../src/server/routes/maintenance.js';

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

test('Maintenance Domain Authorization & IDOR Regression Suite (homehub_test)', async (t) => {
  const runId = `maint_idor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Personas
  const ownerAId = `usr_maint_own_a_${runId}`;
  const ownerBId = `usr_maint_own_b_${runId}`;
  const tenantAId = `usr_maint_ten_a_${runId}`;
  const coTenantAId = `usr_maint_coten_a_${runId}`;
  const tenantBId = `usr_maint_ten_b_${runId}`;
  const tenantTerminatedId = `usr_maint_term_${runId}`;
  const tenantExpiredId = `usr_maint_exp_${runId}`;
  const vendorAuthId = `usr_maint_vnd_auth_${runId}`;
  const vendorUnauthId = `usr_maint_vnd_unauth_${runId}`;
  const orgVendorAuthId = `org_maint_vnd_auth_${runId}`;
  const orgVendorUnauthId = `org_maint_vnd_unauth_${runId}`;

  // Properties
  const propAId = `prop_maint_a_${runId}`;
  const propBId = `prop_maint_b_${runId}`;

  // Leases
  const leaseAId = `lease_maint_a_${runId}`;
  const leaseTerminatedId = `lease_maint_term_${runId}`;
  const leaseExpiredId = `lease_maint_exp_${runId}`;

  // Synthetic Tracking IDs for cleanup
  const createdUserIds: string[] = [
    ownerAId, ownerBId, tenantAId, coTenantAId, tenantBId, tenantTerminatedId, tenantExpiredId, vendorAuthId, vendorUnauthId
  ];
  const createdOrgIds: string[] = [orgVendorAuthId, orgVendorUnauthId];
  const createdPropIds: string[] = [propAId, propBId];
  const createdLeaseIds: string[] = [leaseAId, leaseTerminatedId, leaseExpiredId];
  const createdRequestIds: string[] = [];
  const createdQuoteIds: string[] = [];
  const createdWorkOrderIds: string[] = [];

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/maintenance', maintenanceRouter);

  // 1. Fixture Setup: Users
  await db.insert(schema.users).values([
    {
      id: ownerAId,
      uid: ownerAId,
      email: `${ownerAId}@homehub.iq`,
      firstName: 'OwnerA',
      lastName: 'MaintTest',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: ownerBId,
      uid: ownerBId,
      email: `${ownerBId}@homehub.iq`,
      firstName: 'OwnerB',
      lastName: 'MaintTest',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: tenantAId,
      uid: tenantAId,
      email: `${tenantAId}@homehub.iq`,
      firstName: 'TenantA',
      lastName: 'MaintTest',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: coTenantAId,
      uid: coTenantAId,
      email: `${coTenantAId}@homehub.iq`,
      firstName: 'CoTenantA',
      lastName: 'MaintTest',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: tenantBId,
      uid: tenantBId,
      email: `${tenantBId}@homehub.iq`,
      firstName: 'TenantB',
      lastName: 'MaintTest',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: tenantTerminatedId,
      uid: tenantTerminatedId,
      email: `${tenantTerminatedId}@homehub.iq`,
      firstName: 'TenantTerminated',
      lastName: 'MaintTest',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: tenantExpiredId,
      uid: tenantExpiredId,
      email: `${tenantExpiredId}@homehub.iq`,
      firstName: 'TenantExpired',
      lastName: 'MaintTest',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: vendorAuthId,
      uid: vendorAuthId,
      email: `${vendorAuthId}@homehub.iq`,
      firstName: 'VendorAuth',
      lastName: 'MaintTest',
      roles: ['VENDOR'],
      isActive: true,
    },
    {
      id: vendorUnauthId,
      uid: vendorUnauthId,
      email: `${vendorUnauthId}@homehub.iq`,
      firstName: 'VendorUnauth',
      lastName: 'MaintTest',
      roles: ['VENDOR'],
      isActive: true,
    },
  ]);

  // 1b. Organizations (for Vendor foreign keys)
  await db.insert(schema.organizations).values([
    {
      id: orgVendorAuthId,
      name: 'Authorized Vendor Services LLC',
      type: 'VENDOR',
      status: 'VERIFIED',
      verified: true,
    },
    {
      id: orgVendorUnauthId,
      name: 'Unrelated Vendor Services LLC',
      type: 'VENDOR',
      status: 'VERIFIED',
      verified: true,
    },
  ]);

  await db.insert(schema.organizationMembers).values([
    {
      id: `mem_vnd_auth_${runId}`,
      organizationId: orgVendorAuthId,
      userId: vendorAuthId,
      role: 'SERVICE_PROVIDER',
      status: 'ACTIVE',
    },
    {
      id: `mem_vnd_unauth_${runId}`,
      organizationId: orgVendorUnauthId,
      userId: vendorUnauthId,
      role: 'SERVICE_PROVIDER',
      status: 'ACTIVE',
    },
  ]);

  // 2. Fixture Setup: Properties
  await db.insert(schema.properties).values([
    {
      id: propAId,
      name: 'Property A (Owner A)',
      type: 'RESIDENTIAL',
      status: 'PUBLISHED',
      operatingModel: 'DIRECT_MANAGEMENT',
      currency: 'IQD',
    },
    {
      id: propBId,
      name: 'Property B (Owner B)',
      type: 'RESIDENTIAL',
      status: 'PUBLISHED',
      operatingModel: 'DIRECT_MANAGEMENT',
      currency: 'IQD',
    },
  ]);

  // 3. Ownership Records
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

  // 4. Leases on Property A
  // 4a. Active lease with primary tenant A and co-tenant A
  await db.insert(schema.leases).values({
    id: leaseAId,
    propertyId: propAId,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2028-12-31',
    rentAmount: '1200000',
    currency: 'IQD',
  });

  await db.insert(schema.leaseTenants).values([
    {
      leaseId: leaseAId,
      tenantId: tenantAId,
      isPrimary: true,
    },
    {
      leaseId: leaseAId,
      tenantId: coTenantAId,
      isPrimary: false,
    },
  ]);

  // 4b. Terminated lease on Property A
  await db.insert(schema.leases).values({
    id: leaseTerminatedId,
    propertyId: propAId,
    status: 'TERMINATED',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    rentAmount: '1000000',
    currency: 'IQD',
  });

  await db.insert(schema.leaseTenants).values({
    leaseId: leaseTerminatedId,
    tenantId: tenantTerminatedId,
    isPrimary: true,
  });

  // 4c. Expired lease on Property A (status EXPIRED and past endDate)
  await db.insert(schema.leases).values({
    id: leaseExpiredId,
    propertyId: propAId,
    status: 'EXPIRED',
    startDate: '2025-01-01',
    endDate: '2025-06-30',
    rentAmount: '1000000',
    currency: 'IQD',
  });

  await db.insert(schema.leaseTenants).values({
    leaseId: leaseExpiredId,
    tenantId: tenantExpiredId,
    isPrimary: true,
  });

  try {
    // Helper to seed a baseline maintenance request on Property A
    async function seedRequestA(titleSuffix: string, assignedVendorId?: string): Promise<string> {
      const [req] = await db.insert(schema.maintenanceRequests).values({
        propertyId: propAId,
        reporterUserId: tenantAId,
        category: 'PLUMBING',
        priority: 'NORMAL',
        title: `Pipe Leak - ${titleSuffix}`,
        description: 'Water leaking under the sink',
        status: 'REPORTED',
        assignedVendorId: assignedVendorId || null,
      }).returning();
      createdRequestIds.push(req.id);
      return req.id;
    }

    // Helper to seed a scheduled work order on Property A
    async function seedWorkOrderA(titleSuffix: string, assignedVendorOrgId?: string): Promise<string> {
      const reqId = await seedRequestA(titleSuffix, assignedVendorOrgId);
      const [wo] = await db.insert(schema.workOrders).values({
        maintenanceRequestId: reqId,
        propertyId: propAId,
        vendorId: assignedVendorOrgId || orgVendorAuthId,
        vendorUserId: vendorAuthId,
        status: 'SCHEDULED',
      }).returning();
      createdWorkOrderIds.push(wo.id);
      return wo.id;
    }

    // =========================================================================
    // TEST 1: IDOR & OCCUPANCY: Unrelated Tenant B cannot create request on Property A
    // =========================================================================
    await t.test('1. IDOR: Tenant B cannot create maintenance request for Property A (occupancy check)', async () => {
      const initialRequests = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.propertyId, propAId));

      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', getAuthHeader({ id: tenantBId, roles: ['TENANT'] }))
        .send({
          propertyId: propAId,
          category: 'ELECTRICAL',
          priority: 'HIGH',
          title: 'Power Outage',
          description: 'Sparks from electrical socket in living room',
        });

      assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got: ${res.status}`);
      assert.strictEqual(res.body.error, 'AUTHORIZATION_ERROR');

      // Invariant: No record created
      const afterRequests = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.propertyId, propAId));
      assert.strictEqual(afterRequests.length, initialRequests.length, 'Database state must remain unmodified');
    });

    // =========================================================================
    // TEST 2: LEASE STATUS BOUNDARY: Terminated-lease tenant cannot submit request
    // =========================================================================
    await t.test('2. LEASE STATUS: Tenant with TERMINATED lease cannot submit maintenance request', async () => {
      const initialRequests = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.propertyId, propAId));

      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', getAuthHeader({ id: tenantTerminatedId, roles: ['TENANT'] }))
        .send({
          propertyId: propAId,
          category: 'PLUMBING',
          priority: 'NORMAL',
          title: 'Post-Termination Leaking Faucet',
          description: 'Attempting to file request after lease has terminated',
        });

      assert.strictEqual(res.status, 403, `Expected 403 Forbidden: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.error, 'AUTHORIZATION_ERROR');

      const afterRequests = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.propertyId, propAId));
      assert.strictEqual(afterRequests.length, initialRequests.length, 'No request inserted for terminated lease');
    });

    // =========================================================================
    // TEST 3: LEASE STATUS BOUNDARY: Expired-lease tenant cannot submit request
    // =========================================================================
    await t.test('3. LEASE STATUS: Tenant with EXPIRED lease cannot submit maintenance request', async () => {
      const initialRequests = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.propertyId, propAId));

      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', getAuthHeader({ id: tenantExpiredId, roles: ['TENANT'] }))
        .send({
          propertyId: propAId,
          category: 'HEATING',
          priority: 'HIGH',
          title: 'Heater Broken in Expired Unit',
          description: 'Attempting to file request on expired lease',
        });

      assert.strictEqual(res.status, 403, `Expected 403 Forbidden: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.error, 'AUTHORIZATION_ERROR');

      const afterRequests = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.propertyId, propAId));
      assert.strictEqual(afterRequests.length, initialRequests.length, 'No request inserted for expired lease');
    });

    // =========================================================================
    // TEST 4: CO-TENANT RELATIONSHIP: Legitimate co-tenant on active lease CAN submit
    // =========================================================================
    await t.test('4. CO-TENANT: Co-tenant with active lease CAN submit maintenance request', async () => {
      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', getAuthHeader({ id: coTenantAId, roles: ['TENANT'] }))
        .send({
          propertyId: propAId,
          category: 'PLUMBING',
          priority: 'NORMAL',
          title: 'Co-tenant kitchen sink repair',
          description: 'Water pressure low at kitchen sink',
        });

      assert.strictEqual(res.status, 201, `Expected 201 Created: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.reporterUserId, coTenantAId);
      createdRequestIds.push(res.body.id);
    });

    // =========================================================================
    // TEST 5: CROSS-OWNER: Unrelated Owner B cannot triage Property A request
    // =========================================================================
    await t.test('5. Cross-Owner: Unrelated Owner B cannot triage/modify maintenance request on Property A', async () => {
      const reqId = await seedRequestA('TEST-5-TRIAGE');

      const res = await request(app)
        .put(`/api/maintenance/${reqId}/triage`)
        .set('Authorization', getAuthHeader({ id: ownerBId, roles: ['PROPERTY_OWNER'] }))
        .send({
          status: 'SCHEDULED',
          priority: 'HIGH',
          assignedVendorId: orgVendorAuthId,
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'AUTHORIZATION_ERROR');

      // Verify state untouched
      const [r] = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.id, reqId));
      assert.strictEqual(r.status, 'REPORTED');
      assert.strictEqual(r.priority, 'NORMAL');
    });

    // =========================================================================
    // TEST 6: TENANT SELF-TRIAGE: Tenant A cannot triage their own request
    // =========================================================================
    await t.test('6. Tenant self-triage rejection: Tenant A cannot triage their own maintenance request', async () => {
      const reqId = await seedRequestA('TEST-6-SELF-TRIAGE');

      const res = await request(app)
        .put(`/api/maintenance/${reqId}/triage`)
        .set('Authorization', getAuthHeader({ id: tenantAId, roles: ['TENANT'] }))
        .send({
          status: 'SCHEDULED',
          priority: 'CRITICAL',
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'AUTHORIZATION_ERROR');

      const [r] = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.id, reqId));
      assert.strictEqual(r.status, 'REPORTED');
    });

    // =========================================================================
    // TEST 7: IDOR DETAILS: Unrelated Owner B cannot view quotes/details
    // =========================================================================
    await t.test('7. IDOR Details: Unrelated Owner B cannot view quotes/details of Property A request', async () => {
      const reqId = await seedRequestA('TEST-7-DETAILS');

      const res = await request(app)
        .get(`/api/maintenance/${reqId}/details`)
        .set('Authorization', getAuthHeader({ id: ownerBId, roles: ['PROPERTY_OWNER'] }));

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'AUTHORIZATION_ERROR');
    });

    // =========================================================================
    // TEST 8: QUOTE APPROVAL: Unrelated Owner B cannot approve quote for Property A
    // =========================================================================
    await t.test('8. Quote Approval: Unrelated Owner B cannot approve quote for Property A', async () => {
      const reqId = await seedRequestA('TEST-8-QUOTE-APP');
      const [quote] = await db.insert(schema.maintenanceQuotes).values({
        maintenanceRequestId: reqId,
        vendorId: orgVendorAuthId,
        propertyId: propAId,
        totalAmount: '450000',
        status: 'PENDING_APPROVAL',
      }).returning();
      createdQuoteIds.push(quote.id);

      const res = await request(app)
        .post(`/api/maintenance/quote/${quote.id}/approve`)
        .set('Authorization', getAuthHeader({ id: ownerBId, roles: ['PROPERTY_OWNER'] }))
        .send({});

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'AUTHORIZATION_ERROR');

      const [q] = await db.select().from(schema.maintenanceQuotes).where(eq(schema.maintenanceQuotes.id, quote.id));
      assert.strictEqual(q.status, 'PENDING_APPROVAL');
    });

    // =========================================================================
    // TEST 9: PARAMETER FORGING DEFENSE: Vendor quote derives propertyId from DB
    // =========================================================================
    await t.test('9. Parameter Forging Defense: Vendor quote submission derives propertyId from persisted request', async () => {
      const reqId = await seedRequestA('TEST-9-PARAM-FORGE', orgVendorAuthId);

      const res = await request(app)
        .post(`/api/maintenance/${reqId}/quote`)
        .set('Authorization', getAuthHeader({ id: vendorAuthId, roles: ['VENDOR'], organizationId: orgVendorAuthId }))
        .send({
          propertyId: propBId, // Malicious parameter forging attempt
          totalAmount: 320000,
          notes: 'Estimate includes replacement cartridge',
        });

      assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(res.body)}`);
      createdQuoteIds.push(res.body.id);

      const [storedQuote] = await db.select().from(schema.maintenanceQuotes).where(eq(schema.maintenanceQuotes.id, res.body.id));
      assert.strictEqual(
        storedQuote.propertyId,
        propAId,
        'Authoritative propertyId from request must strictly override forged body value'
      );
    });

    // =========================================================================
    // TEST 10: SAFE DENIAL: Non-existent requests and quotes return 404
    // =========================================================================
    await t.test('10. Safe Denial: Non-existent requests and quotes return 404 without resource disclosure', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const resDetails = await request(app)
        .get(`/api/maintenance/${nonExistentId}/details`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }));
      assert.strictEqual(resDetails.status, 404);

      const resTriage = await request(app)
        .put(`/api/maintenance/${nonExistentId}/triage`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }))
        .send({ status: 'SCHEDULED' });
      assert.strictEqual(resTriage.status, 404);

      const resApprove = await request(app)
        .post(`/api/maintenance/quote/${nonExistentId}/approve`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }))
        .send({});
      assert.strictEqual(resApprove.status, 404);

      const resComplete = await request(app)
        .post(`/api/maintenance/${nonExistentId}/complete`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }))
        .send({});
      assert.strictEqual(resComplete.status, 404);
    });

    // =========================================================================
    // TEST 11: POSITIVE CONTROL: Verified Owner A triage and approve quote
    // =========================================================================
    await t.test('11. POSITIVE CONTROL: Verified Owner A can triage request and approve quotes', async () => {
      const reqId = await seedRequestA('TEST-11-OWNER-SUCCESS');
      const [quote] = await db.insert(schema.maintenanceQuotes).values({
        maintenanceRequestId: reqId,
        vendorId: orgVendorAuthId,
        propertyId: propAId,
        totalAmount: '180000',
        status: 'PENDING_APPROVAL',
      }).returning();
      createdQuoteIds.push(quote.id);

      // Triage
      const resTriage = await request(app)
        .put(`/api/maintenance/${reqId}/triage`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }))
        .send({
          status: 'SCHEDULED',
          priority: 'HIGH',
          assignedVendorId: orgVendorAuthId,
        });
      assert.strictEqual(resTriage.status, 200);

      // Details view
      const resDetails = await request(app)
        .get(`/api/maintenance/${reqId}/details`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }));
      assert.strictEqual(resDetails.status, 200);
      assert.strictEqual(resDetails.body.quotes.length, 1);

      // Quote approval
      const resApprove = await request(app)
        .post(`/api/maintenance/quote/${quote.id}/approve`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }))
        .send({});
      assert.strictEqual(resApprove.status, 200);
      assert.strictEqual(resApprove.body.vendorId, orgVendorAuthId);
      createdWorkOrderIds.push(resApprove.body.id);

      const [q] = await db.select().from(schema.maintenanceQuotes).where(eq(schema.maintenanceQuotes.id, quote.id));
      assert.strictEqual(q.status, 'APPROVED');
    });

    // =========================================================================
    // TEST 12: POSITIVE CONTROL: Assigned Vendor Access
    // =========================================================================
    await t.test('12. POSITIVE CONTROL: Assigned vendor can view details of assigned maintenance request', async () => {
      const reqId = await seedRequestA('TEST-12-VENDOR-AUTH', orgVendorAuthId);

      const resDetails = await request(app)
        .get(`/api/maintenance/${reqId}/details`)
        .set('Authorization', getAuthHeader({ id: vendorAuthId, roles: ['VENDOR'], organizationId: orgVendorAuthId }));
      assert.strictEqual(resDetails.status, 200);

      // Unassigned vendor cannot view details
      const resUnauth = await request(app)
        .get(`/api/maintenance/${reqId}/details`)
        .set('Authorization', getAuthHeader({ id: vendorUnauthId, roles: ['VENDOR'], organizationId: orgVendorUnauthId }));
      assert.strictEqual(resUnauth.status, 403);
    });

    // =========================================================================
    // TEST 13: WORK ORDER COMPLETION: Unrelated parties rejected
    // =========================================================================
    await t.test('13. WORK ORDER COMPLETION: Unrelated owner, unrelated vendor, and tenant cannot complete work order', async () => {
      const woId = await seedWorkOrderA('TEST-13-WO-REJECTIONS', orgVendorAuthId);

      // 1. Unrelated Owner B cannot complete
      const resOwnerB = await request(app)
        .post(`/api/maintenance/${woId}/complete`)
        .set('Authorization', getAuthHeader({ id: ownerBId, roles: ['PROPERTY_OWNER'] }))
        .send({ inspectionPassed: true });
      assert.strictEqual(resOwnerB.status, 403, `Expected 403 for Owner B: ${resOwnerB.status}`);
      assert.strictEqual(resOwnerB.body.error, 'AUTHORIZATION_ERROR');

      // 2. Unrelated Vendor cannot complete
      const resVendorUnauth = await request(app)
        .post(`/api/maintenance/${woId}/complete`)
        .set('Authorization', getAuthHeader({ id: vendorUnauthId, roles: ['VENDOR'], organizationId: orgVendorUnauthId }))
        .send({ inspectionPassed: true });
      assert.strictEqual(resVendorUnauth.status, 403, `Expected 403 for Unrelated Vendor: ${resVendorUnauth.status}`);
      assert.strictEqual(resVendorUnauth.body.error, 'AUTHORIZATION_ERROR');

      // 3. Tenant cannot complete
      const resTenant = await request(app)
        .post(`/api/maintenance/${woId}/complete`)
        .set('Authorization', getAuthHeader({ id: tenantAId, roles: ['TENANT'] }))
        .send({ inspectionPassed: true });
      assert.strictEqual(resTenant.status, 403, `Expected 403 for Tenant: ${resTenant.status}`);
      assert.strictEqual(resTenant.body.error, 'AUTHORIZATION_ERROR');

      // State verification: Work order remains SCHEDULED, 0 inspection rows created
      const [wo] = await db.select().from(schema.workOrders).where(eq(schema.workOrders.id, woId));
      assert.strictEqual(wo.status, 'SCHEDULED');

      const inspRows = await db.select().from(schema.inspections).where(eq(schema.inspections.workOrderId, woId));
      assert.strictEqual(inspRows.length, 0, 'No inspection row must be created on denied requests');
    });

    // =========================================================================
    // TEST 14: WORK ORDER COMPLETION: Authorized Owner A completion succeeds
    // =========================================================================
    await t.test('14. WORK ORDER COMPLETION: Authorized Owner A can complete work order', async () => {
      const woId = await seedWorkOrderA('TEST-14-OWNER-COMPLETE', orgVendorAuthId);

      const res = await request(app)
        .post(`/api/maintenance/${woId}/complete`)
        .set('Authorization', getAuthHeader({ id: ownerAId, roles: ['PROPERTY_OWNER'] }))
        .send({ inspectionPassed: true, findings: 'Superb quality work.' });

      assert.strictEqual(res.status, 200, `Expected 200 OK: ${JSON.stringify(res.body)}`);

      // Verify work order status COMPLETED
      const [wo] = await db.select().from(schema.workOrders).where(eq(schema.workOrders.id, woId));
      assert.strictEqual(wo.status, 'COMPLETED');
      assert.ok(wo.actualEndDate, 'actualEndDate must be set');

      // Verify inspection record created
      const inspRows = await db.select().from(schema.inspections).where(eq(schema.inspections.workOrderId, woId));
      assert.strictEqual(inspRows.length, 1);
      assert.strictEqual(inspRows[0].status, 'PASSED');
      assert.strictEqual(inspRows[0].inspectorId, ownerAId);
    });

    // =========================================================================
    // TEST 15: WORK ORDER COMPLETION: Assigned Vendor completion succeeds
    // =========================================================================
    await t.test('15. WORK ORDER COMPLETION: Assigned Vendor can complete work order via /work-orders/:id/complete', async () => {
      const woId = await seedWorkOrderA('TEST-15-VENDOR-COMPLETE', orgVendorAuthId);

      const res = await request(app)
        .post(`/api/maintenance/work-orders/${woId}/complete`)
        .set('Authorization', getAuthHeader({ id: vendorAuthId, roles: ['VENDOR'], organizationId: orgVendorAuthId }))
        .send({ inspectionPassed: true, findings: 'All tasks completed to spec.' });

      assert.strictEqual(res.status, 200, `Expected 200 OK: ${JSON.stringify(res.body)}`);

      const [wo] = await db.select().from(schema.workOrders).where(eq(schema.workOrders.id, woId));
      assert.strictEqual(wo.status, 'COMPLETED');
    });

  } finally {
    // Deterministic Cleanup
    for (const propId of createdPropIds) {
      await db.delete(schema.inspections).where(eq(schema.inspections.propertyId, propId)).catch(() => {});
    }
    for (const woId of createdWorkOrderIds) {
      await db.delete(schema.inspections).where(eq(schema.inspections.workOrderId, woId)).catch(() => {});
      await db.delete(schema.workOrders).where(eq(schema.workOrders.id, woId)).catch(() => {});
    }
    for (const qId of createdQuoteIds) {
      await db.delete(schema.maintenanceQuotes).where(eq(schema.maintenanceQuotes.id, qId)).catch(() => {});
    }
    for (const reqId of createdRequestIds) {
      await db.delete(schema.inspections).where(eq(schema.inspections.propertyId, propAId)).catch(() => {});
      await db.delete(schema.workOrders).where(eq(schema.workOrders.maintenanceRequestId, reqId)).catch(() => {});
      await db.delete(schema.maintenanceQuotes).where(eq(schema.maintenanceQuotes.maintenanceRequestId, reqId)).catch(() => {});
      await db.delete(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.id, reqId)).catch(() => {});
    }
    for (const lId of createdLeaseIds) {
      await db.delete(schema.leaseTenants).where(eq(schema.leaseTenants.leaseId, lId)).catch(() => {});
      await db.delete(schema.leases).where(eq(schema.leases.id, lId)).catch(() => {});
    }
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
    await pool.end();
  }
});
