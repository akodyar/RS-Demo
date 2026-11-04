import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  moveOutRequests,
  securityDeposits,
  ownershipRecords,
  managementAgreements,
  organizationMembers,
  organizations,
  leaseMoveOutInspections,
  leaseMoveOutInspectionItems,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { moveOutInspectionService, InspectionActor } from '../src/server/services/move-out-inspection.js';

test('Phase 41 — Move-Out Inspection Service Suite', async (t) => {
  const runId = `p41_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const ownerId = `owner_${runId}`;
  const otherOwnerId = `other_owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const managerUserId = `mgr_${runId}`;
  const companyOrgId = `org_${runId}`;
  const prop1Id = `prop1_${runId}`;
  const prop2Id = `prop2_${runId}`;
  const lease1Id = `lease1_${runId}`;
  const lease2Id = `lease2_${runId}`;
  const deposit1Id = `dep1_${runId}`;
  const moveOutReq1Id = `mor1_${runId}`;
  const moveOutReq2Id = `mor2_${runId}`;

  const ownerActor: InspectionActor = {
    id: ownerId,
    role: 'PROPERTY_OWNER',
    roles: ['PROPERTY_OWNER'],
  };

  const otherOwnerActor: InspectionActor = {
    id: otherOwnerId,
    role: 'PROPERTY_OWNER',
    roles: ['PROPERTY_OWNER'],
  };

  const tenantActor: InspectionActor = {
    id: tenantId,
    role: 'TENANT',
    roles: ['TENANT'],
  };

  const managerActor: InspectionActor = {
    id: managerUserId,
    role: 'COMPANY_MEMBER',
    roles: ['COMPANY_MEMBER', 'PROPERTY_MANAGER'],
    organizationId: companyOrgId,
  };

  // 0. Setup test users, organization, properties, ownership, management agreement, leases, deposits
  await db.insert(users).values([
    {
      id: ownerId,
      email: `${ownerId}@test.com`,
      roles: ['PROPERTY_OWNER'],
      firstName: 'Owner',
      lastName: runId,
      isActive: true,
    },
    {
      id: otherOwnerId,
      email: `${otherOwnerId}@test.com`,
      roles: ['PROPERTY_OWNER'],
      firstName: 'OtherOwner',
      lastName: runId,
      isActive: true,
    },
    {
      id: tenantId,
      email: `${tenantId}@test.com`,
      roles: ['TENANT'],
      firstName: 'Tenant',
      lastName: runId,
      isActive: true,
    },
    {
      id: managerUserId,
      email: `${managerUserId}@test.com`,
      roles: ['COMPANY_MEMBER'],
      firstName: 'Manager',
      lastName: runId,
      isActive: true,
    },
  ]).onConflictDoNothing();

  await db.insert(organizations).values({
    id: companyOrgId,
    name: `Management Co ${runId}`,
    type: 'PROPERTY_MANAGEMENT',
    status: 'VERIFIED',
    verified: true,
  }).onConflictDoNothing();

  await db.insert(organizationMembers).values({
    id: `mem_${runId}`,
    organizationId: companyOrgId,
    userId: managerUserId,
    role: 'PROPERTY_MANAGER',
    status: 'ACTIVE',
  }).onConflictDoNothing();

  await db.insert(properties).values([
    {
      id: prop1Id,
      name: `Property 1 ${runId}`,
      type: 'RESIDENTIAL',
      status: 'OCCUPIED',
      createdBy: ownerId,
    },
    {
      id: prop2Id,
      name: `Property 2 ${runId}`,
      type: 'RESIDENTIAL',
      status: 'AVAILABLE',
      createdBy: otherOwnerId,
    },
  ]).onConflictDoNothing();

  await db.insert(ownershipRecords).values([
    {
      id: `own1_${runId}`,
      propertyId: prop1Id,
      ownerId: ownerId,
      status: 'VERIFIED',
    },
    {
      id: `own2_${runId}`,
      propertyId: prop2Id,
      ownerId: otherOwnerId,
      status: 'VERIFIED',
    },
  ]).onConflictDoNothing();

  // Management agreement for company on Property 1
  await db.insert(managementAgreements).values({
    id: `mgmt1_${runId}`,
    propertyId: prop1Id,
    companyId: companyOrgId,
    ownerId: ownerId,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    grantedPermissions: ['MANAGE_LEASES', 'VIEW_PROPERTY'],
  }).onConflictDoNothing();

  await db.insert(leases).values([
    {
      id: lease1Id,
      propertyId: prop1Id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1200000',
      currency: 'IQD',
      depositAmount: '1200000',
      depositReconciliationStatus: 'NOT_EVALUATED',
    },
    {
      id: lease2Id,
      propertyId: prop2Id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '900000',
      currency: 'IQD',
      depositAmount: '900000',
      depositReconciliationStatus: 'NOT_EVALUATED',
    },
  ]);

  await db.insert(securityDeposits).values([
    {
      id: deposit1Id,
      leaseId: lease1Id,
      propertyId: prop1Id,
      tenantId: tenantId,
      requiredAmount: '1200000',
      recordedAmount: '1200000',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'HELD',
    },
  ]);

  await db.insert(moveOutRequests).values([
    {
      id: moveOutReq1Id,
      leaseId: lease1Id,
      propertyId: prop1Id,
      tenantId: tenantId,
      requestedMoveOutDate: '2026-12-31',
      status: 'PENDING_REVIEW',
    },
    {
      id: moveOutReq2Id,
      leaseId: lease2Id,
      propertyId: prop2Id,
      tenantId: tenantId,
      requestedMoveOutDate: '2026-12-31',
      status: 'PENDING_REVIEW',
    },
  ]);

  // Scenario 1: Authorized creation for a valid lease
  await t.test('1. Authorized creation for a valid lease emits audit log and creates inspection in SCHEDULED status', async () => {
    const inspection = await moveOutInspectionService.createInspection({
      leaseId: lease1Id,
      propertyId: prop1Id,
      moveOutRequestId: moveOutReq1Id,
      hasMoveInBaseline: false,
      generalNotes: 'Standard end-of-tenancy walkthrough',
    }, ownerActor);

    assert.ok(inspection.id);
    assert.strictEqual(inspection.leaseId, lease1Id);
    assert.strictEqual(inspection.propertyId, prop1Id);
    assert.strictEqual(inspection.moveOutRequestId, moveOutReq1Id);
    assert.strictEqual(inspection.status, 'SCHEDULED');
    assert.strictEqual(inspection.hasMoveInBaseline, false);
    assert.strictEqual(inspection.moveInBaselineReference, null);

    // Verify audit log
    const [audit] = await db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.resourceId, inspection.id),
        eq(auditLogs.action, 'MOVE_OUT_INSPECTION_CREATED')
      ));
    assert.ok(audit, 'Audit log must be created for inspection creation');
    assert.strictEqual(audit.actorUserId, ownerId);
  });

  // Scenario 2: Rejection of a nonexistent lease
  await t.test('2. Rejection of a nonexistent lease', async () => {
    await assert.rejects(
      async () => {
        await moveOutInspectionService.createInspection({
          leaseId: 'non_existent_lease_123',
          propertyId: prop1Id,
          hasMoveInBaseline: false,
        }, ownerActor);
      },
      /LEASE_NOT_FOUND/i,
      'Should throw LEASE_NOT_FOUND when lease does not exist'
    );
  });

  // Scenario 3: Rejection of a move-out request associated with another lease
  await t.test('3. Rejection of a move-out request associated with another lease', async () => {
    // moveOutReq2Id belongs to lease2Id. Trying to attach it to lease1Id must fail!
    await assert.rejects(
      async () => {
        await moveOutInspectionService.createInspection({
          leaseId: lease1Id,
          propertyId: prop1Id,
          moveOutRequestId: moveOutReq2Id, // Cross-lease violation!
          hasMoveInBaseline: false,
        }, ownerActor);
      },
      /MOVE_OUT_REQUEST_LEASE_MISMATCH/i,
      'Should throw MOVE_OUT_REQUEST_LEASE_MISMATCH when moveOutRequest belongs to a different lease'
    );
  });

  // Scenario 4: Correct property/lease consistency
  await t.test('4. Correct property/lease consistency rejection', async () => {
    // lease1Id belongs to prop1Id, but caller provides prop2Id
    await assert.rejects(
      async () => {
        await moveOutInspectionService.createInspection({
          leaseId: lease1Id,
          propertyId: prop2Id, // Mismatched property!
          hasMoveInBaseline: false,
        }, ownerActor);
      },
      /AUTHORIZATION_DENIED|PROPERTY_LEASE_MISMATCH/i,
      'Should reject when propertyId does not match lease propertyId'
    );
  });

  // Scenario 5: Standalone inspection when no move-in baseline exists
  await t.test('5. Standalone inspection is representable with hasMoveInBaseline=false and baselineRef=null', async () => {
    const inspection = await moveOutInspectionService.createInspection({
      leaseId: lease1Id,
      propertyId: prop1Id,
      hasMoveInBaseline: false,
      moveInBaselineReference: null,
      generalNotes: 'Tenancy originated before platform deployment; standalone move-out inspection',
    }, ownerActor);

    assert.strictEqual(inspection.hasMoveInBaseline, false);
    assert.strictEqual(inspection.moveInBaselineReference, null);
  });

  // Scenario 6: Explicit baseline-present and baseline-absent states
  await t.test('6. Explicit baseline-present requires valid reference; baseline-absent rejects spurious reference', async () => {
    // 6a: baseline-present with valid reference succeeds
    const inspBaseline = await moveOutInspectionService.createInspection({
      leaseId: lease1Id,
      propertyId: prop1Id,
      hasMoveInBaseline: true,
      moveInBaselineReference: 'evidence/move_in_report_2026.pdf',
    }, ownerActor);

    assert.strictEqual(inspBaseline.hasMoveInBaseline, true);
    assert.strictEqual(inspBaseline.moveInBaselineReference, 'evidence/move_in_report_2026.pdf');

    // 6b: baseline-present without reference fails
    await assert.rejects(
      async () => {
        await moveOutInspectionService.createInspection({
          leaseId: lease1Id,
          propertyId: prop1Id,
          hasMoveInBaseline: true,
          moveInBaselineReference: null,
        }, ownerActor);
      },
      /MISSING_BASELINE_REFERENCE/i,
      'Should reject baseline=true with missing reference'
    );

    // 6c: baseline-absent with spurious reference fails
    await assert.rejects(
      async () => {
        await moveOutInspectionService.createInspection({
          leaseId: lease1Id,
          propertyId: prop1Id,
          hasMoveInBaseline: false,
          moveInBaselineReference: 'evidence/spurious.pdf',
        }, ownerActor);
      },
      /SPURIOUS_BASELINE_REFERENCE/i,
      'Should reject baseline=false with spurious reference'
    );
  });

  // Scenario 7: Rejection of an invalid or unsupported evidence reference
  await t.test('7. Evidence references strictly reject path traversal, url schemes, and unsafe extensions', async () => {
    const inspection = await moveOutInspectionService.createInspection({
      leaseId: lease1Id,
      propertyId: prop1Id,
      hasMoveInBaseline: false,
    }, ownerActor);

    // Path traversal rejection
    await assert.rejects(
      async () => {
        await moveOutInspectionService.addInspectionItem(inspection.id, {
          area: 'BATHROOM',
          component: 'SINK',
          condition: 'DAMAGED',
          evidenceRefs: ['../../etc/passwd.jpg'],
        }, ownerActor);
      },
      /Path traversal/i
    );

    // URL scheme rejection
    await assert.rejects(
      async () => {
        await moveOutInspectionService.addInspectionItem(inspection.id, {
          area: 'BATHROOM',
          component: 'SINK',
          condition: 'DAMAGED',
          evidenceRefs: ['https://attacker.com/sink.jpg'],
        }, ownerActor);
      },
      /External URL schemes/i
    );

    // Executable/script extension rejection
    await assert.rejects(
      async () => {
        await moveOutInspectionService.addInspectionItem(inspection.id, {
          area: 'BATHROOM',
          component: 'SINK',
          condition: 'DAMAGED',
          evidenceRefs: ['evidence/payload.exe'],
        }, ownerActor);
      },
      /Unsupported file extension/i
    );
  });

  // Scenario 8: Invalid item conditions, currencies, and negative estimated costs
  await t.test('8. Rejects invalid conditions, currencies, and negative estimated repair costs', async () => {
    const inspection = await moveOutInspectionService.createInspection({
      leaseId: lease1Id,
      propertyId: prop1Id,
      hasMoveInBaseline: false,
    }, ownerActor);

    // Invalid condition
    await assert.rejects(
      async () => {
        await moveOutInspectionService.addInspectionItem(inspection.id, {
          area: 'KITCHEN',
          component: 'COUNTERTOP',
          condition: 'RUINED' as any,
        }, ownerActor);
      },
      /INVALID_ITEM_CONDITION/i
    );

    // Negative repair cost
    await assert.rejects(
      async () => {
        await moveOutInspectionService.addInspectionItem(inspection.id, {
          area: 'KITCHEN',
          component: 'COUNTERTOP',
          condition: 'DAMAGED',
          estimatedRepairCost: -50000,
        }, ownerActor);
      },
      /INVALID_REPAIR_COST/i
    );

    // Unsupported currency
    await assert.rejects(
      async () => {
        await moveOutInspectionService.addInspectionItem(inspection.id, {
          area: 'KITCHEN',
          component: 'COUNTERTOP',
          condition: 'DAMAGED',
          currency: 'EUR',
        }, ownerActor);
      },
      /INVALID_CURRENCY/i
    );
  });

  // Scenario 9: Completion with valid inspection data
  await t.test('9. Inspection completion transitions status to COMPLETED, records completedAt, and audits event', async () => {
    const inspection = await moveOutInspectionService.createInspection({
      leaseId: lease1Id,
      propertyId: prop1Id,
      hasMoveInBaseline: false,
    }, ownerActor);

    // Add 2 valid inspection items
    await moveOutInspectionService.addInspectionItem(inspection.id, {
      area: 'LIVING_ROOM',
      component: 'AIR_CONDITIONER',
      condition: 'GOOD',
      estimatedRepairCost: 0,
      currency: 'IQD',
    }, ownerActor);

    await moveOutInspectionService.addInspectionItem(inspection.id, {
      area: 'BEDROOM_1',
      component: 'WINDOW_BLIND',
      condition: 'DAMAGED',
      damageDescription: 'Slats bent and cord snapped',
      isTenantCaused: true,
      estimatedRepairCost: 45000,
      currency: 'IQD',
      evidenceRefs: ['evidence/blind_damage_01.jpg'],
    }, ownerActor);

    // Complete inspection
    const completed = await moveOutInspectionService.completeInspection(inspection.id, {
      generalNotes: 'Final move-out inspection completed in presence of tenant',
      tenantPresent: true,
      tenantSignatureRef: 'evidence/tenant_sign_ack.png',
    }, ownerActor);

    assert.strictEqual(completed.status, 'COMPLETED');
    assert.ok(completed.completedAt);
    assert.strictEqual(completed.tenantPresent, true);

    // Verify audit log
    const [audit] = await db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.resourceId, inspection.id),
        eq(auditLogs.action, 'MOVE_OUT_INSPECTION_COMPLETED')
      ));
    assert.ok(audit, 'MOVE_OUT_INSPECTION_COMPLETED audit log must exist');
    assert.strictEqual((audit.changes as any).totalItems, 2);
  });

  // Scenario 10: Rejection of invalid lifecycle transitions
  await t.test('10. Lifecycle integrity: Empty inspection cannot be completed; completed inspection cannot be modified or re-completed', async () => {
    const inspection = await moveOutInspectionService.createInspection({
      leaseId: lease1Id,
      propertyId: prop1Id,
      hasMoveInBaseline: false,
    }, ownerActor);

    // 10a: Cannot complete with 0 items
    await assert.rejects(
      async () => {
        await moveOutInspectionService.completeInspection(inspection.id, {}, ownerActor);
      },
      /INSPECTION_ITEMS_REQUIRED/i,
      'Cannot complete an inspection with no items'
    );

    // Add item and complete
    await moveOutInspectionService.addInspectionItem(inspection.id, {
      area: 'HALLWAY',
      component: 'SMOKE_DETECTOR',
      condition: 'GOOD',
    }, ownerActor);

    await moveOutInspectionService.completeInspection(inspection.id, {}, ownerActor);

    // 10b: Cannot re-complete already completed inspection
    await assert.rejects(
      async () => {
        await moveOutInspectionService.completeInspection(inspection.id, {}, ownerActor);
      },
      /INSPECTION_ALREADY_COMPLETED/i,
      'Cannot complete an already completed inspection'
    );

    // 10c: Cannot add items to a completed inspection
    await assert.rejects(
      async () => {
        await moveOutInspectionService.addInspectionItem(inspection.id, {
          area: 'HALLWAY',
          component: 'DOOR_LOCK',
          condition: 'GOOD',
        }, ownerActor);
      },
      /INSPECTION_IMMUTABLE/i,
      'Cannot add items to completed inspection'
    );

    // 10d: Cannot cancel a completed inspection
    await assert.rejects(
      async () => {
        await moveOutInspectionService.cancelInspection(inspection.id, 'No longer needed', ownerActor);
      },
      /INSPECTION_IMMUTABLE/i,
      'Cannot cancel completed inspection'
    );
  });

  // Scenario 11: Unauthorized and cross-property access denial
  await t.test('11. Unauthorized access denial: Tenant and unrelated owner rejected', async () => {
    // Tenant cannot create inspection
    await assert.rejects(
      async () => {
        await moveOutInspectionService.createInspection({
          leaseId: lease1Id,
          propertyId: prop1Id,
          hasMoveInBaseline: false,
        }, tenantActor);
      },
      /AUTHORIZATION_DENIED/i,
      'Tenant role must be denied inspection creation'
    );

    // Owner of Property 2 cannot create inspection on Property 1
    await assert.rejects(
      async () => {
        await moveOutInspectionService.createInspection({
          leaseId: lease1Id,
          propertyId: prop1Id,
          hasMoveInBaseline: false,
        }, otherOwnerActor);
      },
      /AUTHORIZATION_DENIED/i,
      'Owner of another property must be denied'
    );

    // Authorized Company Manager with active agreement can create inspection
    const managerInsp = await moveOutInspectionService.createInspection({
      leaseId: lease1Id,
      propertyId: prop1Id,
      hasMoveInBaseline: false,
      generalNotes: 'Created by authorized property manager',
    }, managerActor);
    assert.strictEqual(managerInsp.inspectorId, managerUserId);
  });

  // Scenario 12: Atomic rollback when a multi-row operation fails
  await t.test('12. Database operations are strictly atomic; failures trigger clean rollback', async () => {
    // Count existing inspections
    const beforeCount = await db.select({ count: sql`count(*)` }).from(leaseMoveOutInspections)
      .where(eq(leaseMoveOutInspections.leaseId, lease1Id));

    // Attempt creation with an invalid signature ref that throws during the transaction
    await assert.rejects(
      async () => {
        await moveOutInspectionService.createInspection({
          leaseId: lease1Id,
          propertyId: prop1Id,
          hasMoveInBaseline: false,
          tenantSignatureRef: '../../unsafe_signature.png', // Fails validation
        }, ownerActor);
      },
      /Path traversal/i
    );

    const afterCount = await db.select({ count: sql`count(*)` }).from(leaseMoveOutInspections)
      .where(eq(leaseMoveOutInspections.leaseId, lease1Id));

    assert.strictEqual(
      Number(afterCount[0].count),
      Number(beforeCount[0].count),
      'Inspection count must not increase when transaction rolls back'
    );
  });

  // Scenario 13: Preservation of lease termination and deposit state
  await t.test('13. Inspection creation and completion strictly preserves lease status and deposit balances', async () => {
    // Initial lease and deposit state
    const [leaseBefore] = await db.select().from(leases).where(eq(leases.id, lease1Id));
    const [depBefore] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, deposit1Id));

    assert.strictEqual(leaseBefore.status, 'ACTIVE');
    assert.strictEqual(leaseBefore.depositReconciliationStatus, 'NOT_EVALUATED');
    assert.strictEqual(depBefore.status, 'HELD');
    assert.strictEqual(Number(depBefore.recordedAmount), 1200000);
    assert.strictEqual(Number(depBefore.releasedAmount), 0);

    // Perform complete inspection workflow
    const insp = await moveOutInspectionService.createInspection({
      leaseId: lease1Id,
      propertyId: prop1Id,
      hasMoveInBaseline: false,
    }, ownerActor);

    await moveOutInspectionService.addInspectionItem(insp.id, {
      area: 'BALCONY',
      component: 'RAILING',
      condition: 'GOOD',
    }, ownerActor);

    await moveOutInspectionService.completeInspection(insp.id, {}, ownerActor);

    // Lease and deposit state after inspection completion
    const [leaseAfter] = await db.select().from(leases).where(eq(leases.id, lease1Id));
    const [depAfter] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, deposit1Id));

    assert.strictEqual(leaseAfter.status, 'ACTIVE', 'Lease status must remain ACTIVE');
    assert.strictEqual(leaseAfter.depositReconciliationStatus, 'NOT_EVALUATED', 'Deposit reconciliation status must remain unchanged');
    assert.strictEqual(depAfter.status, 'HELD', 'Deposit status must remain HELD');
    assert.strictEqual(Number(depAfter.recordedAmount), 1200000, 'Recorded amount must remain unchanged');
    assert.strictEqual(Number(depAfter.releasedAmount), 0, 'Released amount must remain 0');
  });

  // Teardown
  t.after(async () => {
    try {
      await db.delete(auditLogs).where(
        sql`actor_user_id IN (${ownerId}, ${otherOwnerId}, ${managerUserId}, ${tenantId})`
      );
      await db.delete(leaseMoveOutInspectionItems).where(
        sql`inspection_id IN (SELECT id FROM lease_move_out_inspections WHERE property_id IN (${prop1Id}, ${prop2Id}))`
      );
      await db.delete(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.propertyId, prop1Id));
      await db.delete(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.propertyId, prop2Id));
      await db.delete(moveOutRequests).where(eq(moveOutRequests.propertyId, prop1Id));
      await db.delete(moveOutRequests).where(eq(moveOutRequests.propertyId, prop2Id));
      await db.delete(securityDeposits).where(eq(securityDeposits.propertyId, prop1Id));
      await db.delete(leases).where(eq(leases.propertyId, prop1Id));
      await db.delete(leases).where(eq(leases.propertyId, prop2Id));
      await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, prop1Id));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, prop1Id));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, prop2Id));
      await db.delete(organizationMembers).where(eq(organizationMembers.userId, managerUserId));
      await db.delete(organizations).where(eq(organizations.id, companyOrgId));
      await db.delete(properties).where(eq(properties.id, prop1Id));
      await db.delete(properties).where(eq(properties.id, prop2Id));
      await db.delete(users).where(eq(users.id, ownerId));
      await db.delete(users).where(eq(users.id, otherOwnerId));
      await db.delete(users).where(eq(users.id, tenantId));
      await db.delete(users).where(eq(users.id, managerUserId));
    } catch (_) {}
  });
});
