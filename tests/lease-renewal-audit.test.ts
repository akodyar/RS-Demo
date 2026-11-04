import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants, leaseRenewals, rentSchedules, auditLogs } from '../src/db/schema.js';
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

test('Atomic Lease Renewal Audit Logging Suite (homehub_test)', async (t) => {
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
    // Note: audit_logs is append-only by design; homehub_app intentionally lacks DELETE privilege on audit_logs.
    for (const renId of createdRenewalIds) {
      await db.delete(leaseRenewals).where(eq(leaseRenewals.id, renId));
    }
    for (const leaseId of createdLeaseIds) {
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

  const mockIp = '192.168.10.50';

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/leases', leasesRouter);

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: Authorized renewal commits renewal, lease, schedules & audit row atomically
    // ------------------------------------------------------------------------
    await t.test('1. Authorized approval creates exactly one APPROVE_LEASE_RENEWAL audit log in same transaction', async () => {
      const ownerId = `audit-owner-${Date.now()}`;
      const tenantId = `audit-tenant-${Date.now()}`;
      const propId = `audit-prop-${Date.now()}`;
      const leaseId = `audit-lease-${Date.now()}`;
      const renewalId = `audit-ren-${Date.now()}`;

      createdUserIds.push(ownerId, tenantId);
      createdPropertyIds.push(propId);
      createdLeaseIds.push(leaseId);
      createdRenewalIds.push(renewalId);

      // Create owner and tenant
      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Audit', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Audit', email: `${tenantId}@test.com`, roles: ['TENANT'] }
      ]);

      // Create property owned by ownerId
      await db.insert(properties).values({
        id: propId,
        name: 'Audit Property',
        type: 'APARTMENT',
        ownerId: ownerId,
        address: { city: 'Erbil' },
      });

      // Authoritative verified ownership record per HomeHub invariant
      await db.insert(ownershipRecords).values({
        id: `own-${propId}`,
        propertyId: propId,
        ownerId: ownerId,
        status: 'VERIFIED',
        ownershipPercentage: '100',
      });

      // Create initial active lease
      const [lease] = await db.insert(leases).values({
        id: leaseId,
        propertyId: propId,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        rentAmount: '1200',
        status: 'ACTIVE'
      }).returning();

      // Link primary tenant
      await db.insert(leaseTenants).values({
        leaseId: lease.id,
        tenantId: tenantId,
        isPrimary: true
      });

      // Generate initial schedules
      await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1200);
      });

      // Create requested renewal
      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId,
        leaseId: lease.id,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2027-01-01T00:00:00.000Z',
        proposedEndDate: '2027-12-31T00:00:00.000Z',
        proposedRentAmount: '1500',
        status: 'REQUESTED'
      }).returning();

      // Execute approval via HTTP endpoint
      const response = await request(app)
        .post(`/api/leases/renewals/${renewal.id}/approve`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .set('x-forwarded-for', mockIp)
        .set('Accept', 'application/json');

      assert.strictEqual(response.status, 200, `Approval should succeed with 200. Got ${response.status}: ${JSON.stringify(response.body)}`);
      assert.strictEqual(response.body.status, 'APPROVED');

      // Query audit logs
      const auditEntries = await db.select().from(auditLogs).where(
        and(
          eq(auditLogs.resourceType, 'LeaseRenewal'),
          eq(auditLogs.resourceId, renewal.id)
        )
      );

      assert.strictEqual(auditEntries.length, 1, `Exactly one audit log must be recorded. Found ${auditEntries.length}`);

      const entry = auditEntries[0];
      assert.strictEqual(entry.action, 'APPROVE_LEASE_RENEWAL');
      assert.strictEqual(entry.actorUserId, ownerId);
      assert.strictEqual(entry.actorRole, 'PROPERTY_OWNER');
      assert.strictEqual(entry.resourceType, 'LeaseRenewal');
      assert.strictEqual(entry.resourceId, renewal.id);
      assert.strictEqual(entry.ipAddress, mockIp);

      const changes = entry.changes as any;
      assert.ok(changes, 'Changes object must be present in audit entry');
      assert.strictEqual(changes.leaseId, lease.id, 'Changes must include leaseId');
      assert.strictEqual(changes.propertyId, propId, 'Changes must include propertyId');
      assert.strictEqual(changes.previousEndDate, '2026-12-31T00:00:00.000Z', 'Authoritative previous end date must match database before-state');
      assert.strictEqual(changes.newEndDate, '2027-12-31T00:00:00.000Z', 'Authoritative new end date must match renewed date');
      assert.strictEqual(changes.previousRentAmount, '1200', 'Authoritative previous rent must match database before-state');
      assert.strictEqual(changes.newRentAmount, '1500', 'Authoritative new rent must match renewed amount');
      assert.strictEqual(changes.previousStatus, 'REQUESTED', 'Previous status must be REQUESTED');
      assert.strictEqual(changes.newStatus, 'APPROVED', 'New status must be APPROVED');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: Rejected renewal does not emit a success audit event
    // ------------------------------------------------------------------------
    await t.test('2. Attempting to approve a rejected renewal fails and emits ZERO audit events', async () => {
      const ownerId = `audit-owner-rej-${Date.now()}`;
      const tenantId = `audit-tenant-rej-${Date.now()}`;
      const propId = `audit-prop-rej-${Date.now()}`;
      const leaseId = `audit-lease-rej-${Date.now()}`;
      const renewalId = `audit-ren-rej-${Date.now()}`;

      createdUserIds.push(ownerId, tenantId);
      createdPropertyIds.push(propId);
      createdLeaseIds.push(leaseId);
      createdRenewalIds.push(renewalId);

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Rej', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Rej', email: `${tenantId}@test.com`, roles: ['TENANT'] }
      ]);

      await db.insert(properties).values({
        id: propId,
        name: 'Rejected Renewal Property',
        type: 'APARTMENT',
        ownerId: ownerId,
        address: { city: 'Erbil' },
      });

      await db.insert(ownershipRecords).values({
        id: `own-${propId}`,
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
        status: 'ACTIVE'
      }).returning();

      await db.insert(leaseTenants).values({
        leaseId: lease.id,
        tenantId: tenantId,
        isPrimary: true
      });

      const [rejectedRenewal] = await db.insert(leaseRenewals).values({
        id: renewalId,
        leaseId: lease.id,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2027-01-01T00:00:00.000Z',
        proposedEndDate: '2027-12-31T00:00:00.000Z',
        proposedRentAmount: '1100',
        status: 'REJECTED'
      }).returning();

      const response = await request(app)
        .post(`/api/leases/renewals/${rejectedRenewal.id}/approve`)
        .set('Authorization', getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] }))
        .set('x-forwarded-for', mockIp)
        .set('Accept', 'application/json');

      assert.strictEqual(response.status, 500, 'Attempting to approve a REJECTED renewal must fail with 500');

      const auditEntries = await db.select().from(auditLogs).where(
        and(
          eq(auditLogs.resourceType, 'LeaseRenewal'),
          eq(auditLogs.resourceId, rejectedRenewal.id)
        )
      );

      assert.strictEqual(auditEntries.length, 0, `Failed renewal approval must NOT emit any audit log. Found ${auditEntries.length}`);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 3: Unauthorized user approval attempt fails and emits ZERO audit events
    // ------------------------------------------------------------------------
    await t.test('3. Unauthorized caller receives 403 Forbidden and emits ZERO audit events', async () => {
      const ownerId = `audit-owner-auth-${Date.now()}`;
      const unauthorizedUserId = `audit-stranger-${Date.now()}`;
      const tenantId = `audit-tenant-auth-${Date.now()}`;
      const propId = `audit-prop-auth-${Date.now()}`;
      const leaseId = `audit-lease-auth-${Date.now()}`;
      const renewalId = `audit-ren-auth-${Date.now()}`;

      createdUserIds.push(ownerId, unauthorizedUserId, tenantId);
      createdPropertyIds.push(propId);
      createdLeaseIds.push(leaseId);
      createdRenewalIds.push(renewalId);

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Auth', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: unauthorizedUserId, uid: unauthorizedUserId, firstName: 'Stranger', lastName: 'User', email: `${unauthorizedUserId}@test.com`, roles: ['TENANT'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Auth', email: `${tenantId}@test.com`, roles: ['TENANT'] }
      ]);

      await db.insert(properties).values({
        id: propId,
        name: 'Auth Test Property',
        type: 'APARTMENT',
        ownerId: ownerId,
        address: { city: 'Erbil' },
      });

      await db.insert(ownershipRecords).values({
        id: `own-${propId}`,
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
        status: 'ACTIVE'
      }).returning();

      await db.insert(leaseTenants).values({
        leaseId: lease.id,
        tenantId: tenantId,
        isPrimary: true
      });

      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId,
        leaseId: lease.id,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2027-01-01T00:00:00.000Z',
        proposedEndDate: '2027-12-31T00:00:00.000Z',
        proposedRentAmount: '1100',
        status: 'REQUESTED'
      }).returning();

      const response = await request(app)
        .post(`/api/leases/renewals/${renewal.id}/approve`)
        .set('Authorization', getAuthHeader({ id: unauthorizedUserId, roles: ['TENANT'] }))
        .set('x-forwarded-for', mockIp)
        .set('Accept', 'application/json');

      assert.strictEqual(response.status, 403, 'Unauthorized actor must be rejected with 403 Forbidden');

      const auditEntries = await db.select().from(auditLogs).where(
        and(
          eq(auditLogs.resourceType, 'LeaseRenewal'),
          eq(auditLogs.resourceId, renewal.id)
        )
      );

      assert.strictEqual(auditEntries.length, 0, `Unauthorized attempt must NOT emit any audit log. Found ${auditEntries.length}`);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 4: Multi-role resolution correctly identifies PROPERTY_OWNER
    // ------------------------------------------------------------------------
    await t.test('4. Multi-role user correctly selects PROPERTY_OWNER as authoritative actor role', async () => {
      const multiOwnerId = `audit-multi-owner-${Date.now()}`;
      const tenantId = `audit-tenant-multi-${Date.now()}`;
      const propId = `audit-prop-multi-${Date.now()}`;
      const leaseId = `audit-lease-multi-${Date.now()}`;
      const renewalId = `audit-ren-multi-${Date.now()}`;

      createdUserIds.push(multiOwnerId, tenantId);
      createdPropertyIds.push(propId);
      createdLeaseIds.push(leaseId);
      createdRenewalIds.push(renewalId);

      // User has multiple roles: ['TENANT', 'PROPERTY_OWNER']
      await db.insert(users).values([
        { id: multiOwnerId, uid: multiOwnerId, firstName: 'Multi', lastName: 'Owner', email: `${multiOwnerId}@test.com`, roles: ['TENANT', 'PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Multi', email: `${tenantId}@test.com`, roles: ['TENANT'] }
      ]);

      await db.insert(properties).values({
        id: propId,
        name: 'Multi Role Property',
        type: 'APARTMENT',
        ownerId: multiOwnerId,
        address: { city: 'Erbil' },
      });

      await db.insert(ownershipRecords).values({
        id: `own-${propId}`,
        propertyId: propId,
        ownerId: multiOwnerId,
        status: 'VERIFIED',
        ownershipPercentage: '100',
      });

      const [lease] = await db.insert(leases).values({
        id: leaseId,
        propertyId: propId,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        rentAmount: '1200',
        status: 'ACTIVE'
      }).returning();

      await db.insert(leaseTenants).values({
        leaseId: lease.id,
        tenantId: tenantId,
        isPrimary: true
      });

      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId,
        leaseId: lease.id,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2027-01-01T00:00:00.000Z',
        proposedEndDate: '2027-12-31T00:00:00.000Z',
        proposedRentAmount: '1600',
        status: 'REQUESTED'
      }).returning();

      const response = await request(app)
        .post(`/api/leases/renewals/${renewal.id}/approve`)
        .set('Authorization', getAuthHeader({ id: multiOwnerId, roles: ['TENANT', 'PROPERTY_OWNER'] }))
        .set('x-forwarded-for', mockIp)
        .set('Accept', 'application/json');

      assert.strictEqual(response.status, 200, `Approval should succeed with 200. Got ${response.status}: ${JSON.stringify(response.body)}`);

      const [auditEntry] = await db.select().from(auditLogs).where(
        and(
          eq(auditLogs.resourceType, 'LeaseRenewal'),
          eq(auditLogs.resourceId, renewal.id)
        )
      );

      assert.ok(auditEntry, 'Audit log must be emitted');
      assert.strictEqual(auditEntry.actorRole, 'PROPERTY_OWNER', `Authoritative role must be resolved to PROPERTY_OWNER, not TENANT`);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 5: Transactional atomicity — simulated audit failure rolls back renewal & schedules
    // ------------------------------------------------------------------------
    await t.test('5. Transactional atomicity: simulated audit failure rolls back renewal and schedule mutations', async () => {
      const ownerId = `audit-owner-fail-${Date.now()}`;
      const tenantId = `audit-tenant-fail-${Date.now()}`;
      const propId = `audit-prop-fail-${Date.now()}`;
      const leaseId = `audit-lease-fail-${Date.now()}`;
      const renewalId = `audit-ren-fail-${Date.now()}`;

      createdUserIds.push(ownerId, tenantId);
      createdPropertyIds.push(propId);
      createdLeaseIds.push(leaseId);
      createdRenewalIds.push(renewalId);

      await db.insert(users).values([
        { id: ownerId, uid: ownerId, firstName: 'Owner', lastName: 'Fail', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
        { id: tenantId, uid: tenantId, firstName: 'Tenant', lastName: 'Fail', email: `${tenantId}@test.com`, roles: ['TENANT'] }
      ]);

      await db.insert(properties).values({
        id: propId,
        name: 'Fail Audit Property',
        type: 'APARTMENT',
        ownerId: ownerId,
        address: { city: 'Erbil' },
      });

      await db.insert(ownershipRecords).values({
        id: `own-${propId}`,
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
        status: 'ACTIVE'
      }).returning();

      await db.insert(leaseTenants).values({
        leaseId: lease.id,
        tenantId: tenantId,
        isPrimary: true
      });

      // Generate 2026 schedules
      await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', originalEndDate, 1000);
      });

      const schedulesBefore = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
      assert.strictEqual(schedulesBefore.length, 12, '12 schedules should exist initially for 2026');

      const [renewal] = await db.insert(leaseRenewals).values({
        id: renewalId,
        leaseId: lease.id,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2027-01-01T00:00:00.000Z',
        proposedEndDate: '2027-12-31T00:00:00.000Z',
        proposedRentAmount: '2000',
        status: 'REQUESTED'
      }).returning();

      // Attempt approveRenewal with simulated audit failure in the transaction
      let errorThrown = false;
      try {
        await leaseRepository.approveRenewal(renewal.id, {
          actorUserId: ownerId,
          actorRole: 'PROPERTY_OWNER',
          ipAddress: mockIp,
          simulateAuditFailure: true, // triggers failure during the transaction
        });
      } catch (err: any) {
        errorThrown = true;
        assert.ok(err.message.includes('SIMULATED_AUDIT_FAILURE'), `Expected SIMULATED_AUDIT_FAILURE error, got: ${err.message}`);
      }

      assert.strictEqual(errorThrown, true, 'approveRenewal must reject when audit write fails');

      // 1. Verify leaseRenewal row rolled back to REQUESTED
      const [renewalAfter] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewal.id));
      assert.strictEqual(renewalAfter.status, 'REQUESTED', 'Renewal status must remain REQUESTED due to atomic rollback');

      // 2. Verify lease row rolled back to original endDate and rentAmount
      const [leaseAfter] = await db.select().from(leases).where(eq(leases.id, lease.id));
      assert.strictEqual(leaseAfter.endDate, originalEndDate, 'Lease endDate must remain unchanged due to atomic rollback');
      assert.strictEqual(leaseAfter.rentAmount, originalRent, 'Lease rentAmount must remain unchanged due to atomic rollback');

      // 3. Verify rentSchedules rolled back (no 2027 schedules generated)
      const schedulesAfter = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
      assert.strictEqual(schedulesAfter.length, 12, 'Rent schedules count must remain 12 (no 2027 schedules generated)');
      const futureSchedules = schedulesAfter.filter(s => new Date(s.periodStart) >= new Date('2027-01-01T00:00:00.000Z'));
      assert.strictEqual(futureSchedules.length, 0, 'No future 2027 schedules should exist due to atomic rollback');

      // 4. Verify no audit log row exists
      const auditEntries = await db.select().from(auditLogs).where(
        and(
          eq(auditLogs.resourceType, 'LeaseRenewal'),
          eq(auditLogs.resourceId, renewal.id)
        )
      );
      assert.strictEqual(auditEntries.length, 0, 'Audit log row must not exist due to atomic rollback');
    });

  } finally {
    await cleanupFixtures();
  }
});
