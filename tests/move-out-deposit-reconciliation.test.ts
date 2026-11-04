import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  ownershipRecords,
  managementAgreements,
  leases,
  leaseTenants,
  securityDeposits,
  moveOutRequests,
  auditLogs,
  chartOfAccounts,
} from '../src/db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { Permission, UserRole, LeaseStatus } from '../src/types/index.js';

test('Phase 36 — Move-Out Explicit Unresolved Deposit State Suite (D01 / P01)', async (t) => {
  const runId = `d01_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // Express Test Harness
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  // Setup Accounts in Chart of Accounts (if missing)
  await db.insert(chartOfAccounts).values([
    { id: `coa_1010_${runId}`, code: '1010', name: 'Cash', accountType: 'ASSET' },
    { id: `coa_2100_${runId}`, code: '2100', name: 'Security Deposits Liability', accountType: 'LIABILITY' },
  ]).onConflictDoNothing();

  // Test Personas
  const ownerId = `owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const leaseManagerId = `lsemgr_${runId}`;
  const finManagerId = `finmgr_${runId}`;
  const viewOnlyId = `vomgr_${runId}`;
  const orgId = `org_${runId}`;

  // Insert test users
  await db.insert(users).values([
    { id: ownerId, email: `owner_${runId}@test.com`, roles: [UserRole.PROPERTY_OWNER], firstName: 'Owner', lastName: runId, isActive: true },
    { id: tenantId, email: `tenant_${runId}@test.com`, roles: [UserRole.TENANT], firstName: 'Tenant', lastName: runId, isActive: true },
    { id: leaseManagerId, email: `lsemgr_${runId}@test.com`, roles: [UserRole.COMPANY], firstName: 'LeaseMgr', lastName: runId, isActive: true },
    { id: finManagerId, email: `finmgr_${runId}@test.com`, roles: [UserRole.COMPANY], firstName: 'FinMgr', lastName: runId, isActive: true },
    { id: viewOnlyId, email: `vomgr_${runId}@test.com`, roles: [UserRole.COMPANY], firstName: 'ViewMgr', lastName: runId, isActive: true },
  ]).onConflictDoNothing();

  // Insert Management Company
  await db.insert(organizations).values([
    { id: orgId, name: `Management Org ${runId}`, type: 'COMPANY' }
  ]).onConflictDoNothing();

  // Insert Organization Memberships
  await db.insert(organizationMembers).values([
    { id: `om_lse_${runId}`, organizationId: orgId, userId: leaseManagerId, role: 'MANAGER', status: 'ACTIVE' },
    { id: `om_fin_${runId}`, organizationId: orgId, userId: finManagerId, role: 'MANAGER', status: 'ACTIVE' },
    { id: `om_vo_${runId}`, organizationId: orgId, userId: viewOnlyId, role: 'AGENT', status: 'ACTIVE' },
  ]).onConflictDoNothing();

  // Tokens
  const ownerToken = signAuthToken({ id: ownerId, email: `owner_${runId}@test.com`, role: UserRole.PROPERTY_OWNER, roles: [UserRole.PROPERTY_OWNER] });
  const tenantToken = signAuthToken({ id: tenantId, email: `tenant_${runId}@test.com`, role: UserRole.TENANT, roles: [UserRole.TENANT] });
  const leaseManagerToken = signAuthToken({ id: leaseManagerId, email: `lsemgr_${runId}@test.com`, role: UserRole.COMPANY, roles: [UserRole.COMPANY], organizationId: orgId });
  const viewOnlyToken = signAuthToken({ id: viewOnlyId, email: `vomgr_${runId}@test.com`, role: UserRole.COMPANY, roles: [UserRole.COMPANY], organizationId: orgId });

  // Helper to create complete lease + move-out request fixture
  const createMoveOutFixture = async (opts: {
    suffix: string;
    depositRequiredAmount?: number | null;
    depositRecord?: {
      recordedAmount: string;
      releasedAmount: string;
      status: string;
    } | null;
  }) => {
    const propId = `prop_${opts.suffix}_${runId}`;
    const leaseId = `lease_${opts.suffix}_${runId}`;
    const moveOutId = `mo_${opts.suffix}_${runId}`;
    const depId = opts.depositRecord ? `dep_${opts.suffix}_${runId}` : null;

    // Property
    await db.insert(properties).values({
      id: propId,
      name: `Property ${opts.suffix}`,
      type: 'RESIDENTIAL',
      status: 'AVAILABLE',
      createdBy: ownerId
    });

    // Ownership
    await db.insert(ownershipRecords).values({
      id: `own_${opts.suffix}_${runId}`,
      propertyId: propId,
      ownerId: ownerId,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    });

    // Management Agreement granting MANAGE_LEASES to leaseManager
    await db.insert(managementAgreements).values({
      id: `ma_${opts.suffix}_${runId}`,
      propertyId: propId,
      companyId: orgId,
      ownerId: ownerId,
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 86400000).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 365).toISOString(),
      grantedPermissions: [Permission.MANAGE_LEASES, Permission.MANAGE_FINANCIALS, Permission.VIEW_PROPERTY],
    });

    // Lease
    await db.insert(leases).values({
      id: leaseId,
      propertyId: propId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1000000',
      depositAmount: opts.depositRequiredAmount != null ? opts.depositRequiredAmount.toString() : null,
      currency: 'IQD',
      status: 'ACTIVE',
      depositReconciliationStatus: 'NOT_EVALUATED'
    });

    // Lease Tenant Link
    await db.insert(leaseTenants).values({
      id: `lt_${opts.suffix}_${runId}`,
      leaseId: leaseId,
      tenantId: tenantId,
      isPrimary: true
    });

    // Security Deposit Record (if specified)
    if (opts.depositRecord && depId) {
      await db.insert(securityDeposits).values({
        id: depId,
        leaseId: leaseId,
        propertyId: propId,
        tenantId: tenantId,
        requiredAmount: (opts.depositRequiredAmount || 0).toString(),
        recordedAmount: opts.depositRecord.recordedAmount,
        releasedAmount: opts.depositRecord.releasedAmount,
        currency: 'IQD',
        status: opts.depositRecord.status
      });
    }

    // Move-out Request
    await db.insert(moveOutRequests).values({
      id: moveOutId,
      leaseId: leaseId,
      propertyId: propId,
      tenantId: tenantId,
      requestedMoveOutDate: '2026-06-30',
      status: 'PENDING_REVIEW'
    });

    return { propId, leaseId, moveOutId, depId };
  };

  // 1. Move-out approval for a lease with no deposit: normal completion is preserved (NOT_APPLICABLE)
  await t.test('1. No deposit on lease completes move-out with NOT_APPLICABLE', async () => {
    const f = await createMoveOutFixture({ suffix: 'no_dep', depositRequiredAmount: null, depositRecord: null });

    const result = await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });
    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.depositReconciliationStatus, 'NOT_APPLICABLE');

    // Verify database record
    const [dbLease] = await db.select().from(leases).where(eq(leases.id, f.leaseId)).limit(1);
    assert.strictEqual(dbLease.status, LeaseStatus.TERMINATED);
    assert.strictEqual(dbLease.depositReconciliationStatus, 'NOT_APPLICABLE');

    // Verify audit log
    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED')))
      .orderBy(desc(auditLogs.timestamp)).limit(1);
    assert.ok(audit, 'Audit log for normal move-out must exist');
    assert.strictEqual((audit.changes as any).depositReconciliationStatus, 'NOT_APPLICABLE');
  });

  // 2. Agreed but uncollected PENDING deposit: lease terminates, status is explicitly UNRESOLVED
  await t.test('2. Agreed but uncollected PENDING deposit terminates lease with UNRESOLVED status', async () => {
    const f = await createMoveOutFixture({
      suffix: 'pending_dep',
      depositRequiredAmount: 1000000,
      depositRecord: { recordedAmount: '0', releasedAmount: '0', status: 'PENDING' }
    });

    const result = await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });
    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.depositReconciliationStatus, 'UNRESOLVED');

    const [dbLease] = await db.select().from(leases).where(eq(leases.id, f.leaseId)).limit(1);
    assert.strictEqual(dbLease.status, LeaseStatus.TERMINATED);
    assert.strictEqual(dbLease.depositReconciliationStatus, 'UNRESOLVED');

    // Verify audit log
    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED')))
      .orderBy(desc(auditLogs.timestamp)).limit(1);
    assert.ok(audit, 'Audit log MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED must exist');
    assert.strictEqual((audit.changes as any).depositReconciliationStatus, 'UNRESOLVED');
    assert.strictEqual((audit.changes as any).depositDetails.unresolvedReason, 'DEPOSIT_PENDING_COLLECTION');
  });

  // 3. Move-out approval with PARTIALLY_COLLECTED deposit: status is explicitly UNRESOLVED
  await t.test('3. PARTIALLY_COLLECTED deposit terminates lease with UNRESOLVED status', async () => {
    const f = await createMoveOutFixture({
      suffix: 'part_coll',
      depositRequiredAmount: 1000000,
      depositRecord: { recordedAmount: '400000', releasedAmount: '0', status: 'PARTIALLY_COLLECTED' }
    });

    const result = await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });
    assert.strictEqual(result.depositReconciliationStatus, 'UNRESOLVED');

    const [dbLease] = await db.select().from(leases).where(eq(leases.id, f.leaseId)).limit(1);
    assert.strictEqual(dbLease.status, LeaseStatus.TERMINATED);
    assert.strictEqual(dbLease.depositReconciliationStatus, 'UNRESOLVED');

    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED')))
      .limit(1);
    assert.ok(audit);
    assert.strictEqual((audit.changes as any).depositDetails.unresolvedReason, 'DEPOSIT_PARTIALLY_COLLECTED');
    assert.strictEqual((audit.changes as any).depositDetails.recordedAmount, '400000');
  });

  // 4. Move-out approval with fully HELD deposit: status is explicitly UNRESOLVED
  await t.test('4. HELD deposit terminates lease with UNRESOLVED status', async () => {
    const f = await createMoveOutFixture({
      suffix: 'held_dep',
      depositRequiredAmount: 1000000,
      depositRecord: { recordedAmount: '1000000', releasedAmount: '0', status: 'HELD' }
    });

    const result = await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });
    assert.strictEqual(result.depositReconciliationStatus, 'UNRESOLVED');

    const [dbLease] = await db.select().from(leases).where(eq(leases.id, f.leaseId)).limit(1);
    assert.strictEqual(dbLease.status, LeaseStatus.TERMINATED);
    assert.strictEqual(dbLease.depositReconciliationStatus, 'UNRESOLVED');

    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED')))
      .limit(1);
    assert.ok(audit);
    assert.strictEqual((audit.changes as any).depositDetails.unresolvedReason, 'DEPOSIT_CUSTODIAL_FUNDS_HELD');
    assert.strictEqual((audit.changes as any).depositDetails.heldBalance, '1000000');
  });

  // 5. Move-out approval when an outstanding custodial balance exists (PARTIALLY_REFUNDED)
  await t.test('5. PARTIALLY_REFUNDED deposit with held balance terminates with UNRESOLVED status', async () => {
    const f = await createMoveOutFixture({
      suffix: 'part_rel',
      depositRequiredAmount: 1000000,
      depositRecord: { recordedAmount: '1000000', releasedAmount: '300000', status: 'PARTIALLY_REFUNDED' }
    });

    const result = await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });
    assert.strictEqual(result.depositReconciliationStatus, 'UNRESOLVED');

    const [dbLease] = await db.select().from(leases).where(eq(leases.id, f.leaseId)).limit(1);
    assert.strictEqual(dbLease.depositReconciliationStatus, 'UNRESOLVED');

    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED')))
      .limit(1);
    assert.ok(audit);
    assert.strictEqual((audit.changes as any).depositDetails.heldBalance, '700000');
  });

  // 6. Move-out approval with fully accounted-for deposit (REFUNDED)
  await t.test('6. Fully REFUNDED deposit completes move-out with RECONCILED status', async () => {
    const f = await createMoveOutFixture({
      suffix: 'full_ref',
      depositRequiredAmount: 1000000,
      depositRecord: { recordedAmount: '1000000', releasedAmount: '1000000', status: 'REFUNDED' }
    });

    const result = await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });
    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.depositReconciliationStatus, 'RECONCILED');

    const [dbLease] = await db.select().from(leases).where(eq(leases.id, f.leaseId)).limit(1);
    assert.strictEqual(dbLease.status, LeaseStatus.TERMINATED);
    assert.strictEqual(dbLease.depositReconciliationStatus, 'RECONCILED');

    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED')))
      .orderBy(desc(auditLogs.timestamp)).limit(1);
    assert.ok(audit);
    assert.strictEqual((audit.changes as any).depositReconciliationStatus, 'RECONCILED');
  });

  // 7. Agreed deposit in lease contract but deposit row missing from security_deposits
  await t.test('7. Agreed deposit missing from deposit table terminates with UNRESOLVED status', async () => {
    const f = await createMoveOutFixture({
      suffix: 'missing_row',
      depositRequiredAmount: 500000,
      depositRecord: null // Missing row
    });

    const result = await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });
    assert.strictEqual(result.depositReconciliationStatus, 'UNRESOLVED');

    const [dbLease] = await db.select().from(leases).where(eq(leases.id, f.leaseId)).limit(1);
    assert.strictEqual(dbLease.depositReconciliationStatus, 'UNRESOLVED');

    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED')))
      .limit(1);
    assert.ok(audit);
    assert.strictEqual((audit.changes as any).depositDetails.unresolvedReason, 'DEPOSIT_AGREED_BUT_UNCOLLECTED');
  });

  // 8. Inconsistent deposit data fails safe to UNRESOLVED
  await t.test('8. Inconsistent deposit data (released > recorded) fails safe to UNRESOLVED', async () => {
    const f = await createMoveOutFixture({
      suffix: 'inconsist',
      depositRequiredAmount: 500000,
      depositRecord: { recordedAmount: '500000', releasedAmount: '800000', status: 'REFUNDED' } // Inconsistent: released > recorded
    });

    const result = await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });
    assert.strictEqual(result.depositReconciliationStatus, 'UNRESOLVED');

    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED')))
      .limit(1);
    assert.ok(audit);
    assert.strictEqual((audit.changes as any).depositDetails.unresolvedReason, 'DEPOSIT_DATA_INCONSISTENT');
  });

  // 9. Repeated approval does not duplicate audit events or produce contradictory states
  await t.test('9. Repeated approval is rejected and does not duplicate audit events', async () => {
    const f = await createMoveOutFixture({
      suffix: 'repeated',
      depositRequiredAmount: 1000000,
      depositRecord: { recordedAmount: '1000000', releasedAmount: '0', status: 'HELD' }
    });

    // First call succeeds
    await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });

    // Second call must fail
    await assert.rejects(
      async () => {
        await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER });
      },
      /Cannot approve move-out: request is not pending review or not found/
    );

    // Verify exactly 1 audit log exists for this lease
    const audits = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED')));
    assert.strictEqual(audits.length, 1, 'Exactly one audit log must be recorded across repeated approval attempts');
  });

  // 10. Concurrent approval does not produce duplicate or inconsistent transitions
  await t.test('10. Concurrent move-out approval calls serialize cleanly with exactly one success', async () => {
    const f = await createMoveOutFixture({
      suffix: 'concur',
      depositRequiredAmount: 1000000,
      depositRecord: { recordedAmount: '1000000', releasedAmount: '0', status: 'HELD' }
    });

    const results = await Promise.allSettled([
      leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER }),
      leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER }),
      leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER }),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    assert.strictEqual(successes.length, 1, 'Exactly one concurrent call must succeed');
    assert.strictEqual(failures.length, 2, 'Two concurrent calls must be rejected');

    const audits = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED')));
    assert.strictEqual(audits.length, 1, 'Exactly one audit log must be persisted under concurrency');
  });

  // 11. Failure rollback when transaction encounters an error
  await t.test('11. Database transition rolls back cleanly on error', async () => {
    const f = await createMoveOutFixture({
      suffix: 'rollback',
      depositRequiredAmount: null,
      depositRecord: null
    });

    await assert.rejects(
      async () => {
        await leaseRepository.approveMoveOut(f.moveOutId, { id: ownerId, role: UserRole.PROPERTY_OWNER, simulateFailure: true });
      },
      /SIMULATED_TRANSACTION_FAILURE/
    );

    // Verify rollback: move-out request must still be PENDING_REVIEW
    const [moReq] = await db.select().from(moveOutRequests).where(eq(moveOutRequests.id, f.moveOutId));
    assert.strictEqual(moReq.status, 'PENDING_REVIEW', 'Move-out request status must remain PENDING_REVIEW on rollback');

    // Verify lease remains ACTIVE
    const [dbLease] = await db.select().from(leases).where(eq(leases.id, f.leaseId));
    assert.strictEqual(dbLease.status, 'ACTIVE', 'Lease status must remain ACTIVE on rollback');

    // Verify 0 audit logs created
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, f.leaseId));
    assert.strictEqual(audits.length, 0, 'Zero audit logs must be persisted on rollback');
  });

  // 12. Route-level HTTP authorization via POST /api/leases/move-out/:id/approve
  await t.test('12. Route authorization enforces MANAGE_LEASES and records authenticated actor in audit log', async () => {
    const f = await createMoveOutFixture({
      suffix: 'route_auth',
      depositRequiredAmount: 1000000,
      depositRecord: { recordedAmount: '1000000', releasedAmount: '0', status: 'HELD' }
    });

    // 12a. Unauthenticated request -> 401
    const unauthRes = await request(app)
      .post(`/api/leases/move-out/${f.moveOutId}/approve`)
      .send();
    assert.strictEqual(unauthRes.status, 401);

    // 12b. Tenant without MANAGE_LEASES -> 403
    const forbiddenTenantRes = await request(app)
      .post(`/api/leases/move-out/${f.moveOutId}/approve`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send();
    assert.strictEqual(forbiddenTenantRes.status, 403);

    // 12c. Authorized lease manager with MANAGE_LEASES -> 200 OK
    const successRes = await request(app)
      .post(`/api/leases/move-out/${f.moveOutId}/approve`)
      .set('Authorization', `Bearer ${leaseManagerToken}`)
      .send();
    assert.strictEqual(successRes.status, 200);
    assert.strictEqual(successRes.body.depositReconciliationStatus, 'UNRESOLVED');

    // 12d. Verify audit log captures the lease manager's actorUserId and role
    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, f.leaseId), eq(auditLogs.action, 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED')))
      .limit(1);
    assert.ok(audit);
    assert.strictEqual(audit.actorUserId, leaseManagerId);
    assert.strictEqual(audit.actorRole, UserRole.COMPANY);
  });

  // 13. Teardown
  await t.test('13. Deterministic teardown cleans up test data cleanly', async () => {
    // Delete test audit logs
    await db.delete(auditLogs).where(eq(auditLogs.actorUserId, ownerId));
    await db.delete(auditLogs).where(eq(auditLogs.actorUserId, leaseManagerId));
    await db.delete(auditLogs).where(eq(auditLogs.actorUserId, 'SYSTEM'));

    // Find and delete test properties and cascading entities via ownershipRecords
    const ownerRecs = await db.select().from(ownershipRecords).where(eq(ownershipRecords.ownerId, ownerId));
    const testPropIds = ownerRecs.map(r => r.propertyId);

    for (const pId of testPropIds) {
      const testLeases = await db.select().from(leases).where(eq(leases.propertyId, pId));
      const leaseIds = testLeases.map(l => l.id);
      if (leaseIds.length > 0) {
        await db.delete(moveOutRequests).where(inArray(moveOutRequests.leaseId, leaseIds));
        await db.delete(securityDeposits).where(inArray(securityDeposits.leaseId, leaseIds));
        await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, leaseIds));
        await db.delete(leases).where(inArray(leases.id, leaseIds));
      }
      await db.delete(moveOutRequests).where(eq(moveOutRequests.propertyId, pId));
      await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, pId));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, pId));
      await db.delete(properties).where(eq(properties.id, pId));
    }

    // Delete members, orgs, users
    await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(inArray(users.id, [ownerId, tenantId, leaseManagerId, finManagerId, viewOnlyId]));
    await db.delete(chartOfAccounts).where(inArray(chartOfAccounts.id, [`coa_1010_${runId}`, `coa_2100_${runId}`]));

    assert.ok(true, 'Teardown completed successfully');
  });
});
