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
  leaseMoveOutInspections,
  leaseMoveOutInspectionItems,
  securityDepositDeductions,
} from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';

const isForeignKeyError = (err: any) => {
  const msg = `${err?.message || ''} ${err?.cause?.message || ''}`;
  return /foreign key/i.test(msg);
};

const isCheckConstraintError = (err: any) => {
  const msg = `${err?.message || ''} ${err?.cause?.message || ''}`;
  return /check constraint/i.test(msg);
};

test('Phase 40 — Move-Out Inspection & Deposit Deduction Schema Suite', async (t) => {
  const runId = `p40_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const ownerId = `owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const inspectorId = `inspector_${runId}`;
  const propId = `prop_${runId}`;
  const prop2Id = `prop2_${runId}`;
  const lease1Id = `lease1_${runId}`;
  const lease2Id = `lease2_${runId}`;
  const deposit1Id = `dep1_${runId}`;
  const moveOutReq1Id = `mor1_${runId}`;

  // 0. Setup test actors, properties, leases, deposit, and move-out request
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
      id: tenantId,
      email: `${tenantId}@test.com`,
      roles: ['TENANT'],
      firstName: 'Tenant',
      lastName: runId,
      isActive: true,
    },
    {
      id: inspectorId,
      email: `${inspectorId}@test.com`,
      roles: ['PROPERTY_MANAGER'],
      firstName: 'Inspector',
      lastName: runId,
      isActive: true,
    },
  ]).onConflictDoNothing();

  await db.insert(properties).values([
    {
      id: propId,
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
      createdBy: ownerId,
    },
  ]).onConflictDoNothing();

  await db.insert(leases).values([
    {
      id: lease1Id,
      propertyId: propId,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1000000',
      currency: 'IQD',
      depositAmount: '1000000',
      depositReconciliationStatus: 'NOT_EVALUATED',
    },
    {
      id: lease2Id,
      propertyId: prop2Id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '800000',
      currency: 'IQD',
      depositAmount: '800000',
      depositReconciliationStatus: 'NOT_EVALUATED',
    },
  ]);

  await db.insert(securityDeposits).values({
    id: deposit1Id,
    leaseId: lease1Id,
    propertyId: propId,
    tenantId: tenantId,
    requiredAmount: '1000000',
    recordedAmount: '1000000',
    releasedAmount: '0',
    currency: 'IQD',
    status: 'HELD',
  });

  await db.insert(moveOutRequests).values({
    id: moveOutReq1Id,
    leaseId: lease1Id,
    propertyId: propId,
    tenantId: tenantId,
    requestedMoveOutDate: '2026-12-31',
    status: 'PENDING_REVIEW',
  });

  // Scenario 1: Inspection rows must reference valid leases
  await t.test('1. Inspection rows must reference valid leases and fail on non-existent lease', async () => {
    // Valid lease reference should succeed
    const inspId = `insp1_${runId}`;
    const [insp] = await db.insert(leaseMoveOutInspections).values({
      id: inspId,
      leaseId: lease1Id,
      propertyId: propId,
      inspectorId: inspectorId,
      status: 'SCHEDULED',
      hasMoveInBaseline: false,
    }).returning();
    assert.strictEqual(insp.id, inspId);
    assert.strictEqual(insp.leaseId, lease1Id);
    assert.strictEqual(insp.status, 'SCHEDULED');

    // Invalid lease reference must fail FK constraint
    await assert.rejects(
      async () => {
        await db.insert(leaseMoveOutInspections).values({
          id: `insp_fail_${runId}`,
          leaseId: 'non_existent_lease_id',
          propertyId: propId,
          inspectorId: inspectorId,
          status: 'SCHEDULED',
        });
      },
      isForeignKeyError,
      'Inserting an inspection with a non-existent leaseId must throw a foreign key error'
    );
  });

  // Scenario 2: Inspection-to-move-out-request relationships cannot silently cross leases
  await t.test('2. Inspection-to-move-out-request relationships cannot silently cross leases', async () => {
    const inspCrossId = `insp_cross_${runId}`;
    // moveOutReq1Id belongs to lease1Id. Trying to link it under lease2Id must fail the composite FK constraint!
    await assert.rejects(
      async () => {
        await db.insert(leaseMoveOutInspections).values({
          id: inspCrossId,
          leaseId: lease2Id, // Mismatched lease!
          moveOutRequestId: moveOutReq1Id, // Belongs to lease1Id
          propertyId: prop2Id,
          inspectorId: inspectorId,
          status: 'SCHEDULED',
        });
      },
      isForeignKeyError,
      'Linking a moveOutRequestId belonging to lease1 to an inspection on lease2 must fail FK'
    );

    // Linking matching moveOutRequestId and leaseId succeeds
    const inspMatchId = `insp_match_${runId}`;
    const [matched] = await db.insert(leaseMoveOutInspections).values({
      id: inspMatchId,
      leaseId: lease1Id,
      moveOutRequestId: moveOutReq1Id,
      propertyId: propId,
      inspectorId: inspectorId,
      status: 'SCHEDULED',
    }).returning();
    assert.strictEqual(matched.moveOutRequestId, moveOutReq1Id);
  });

  // Scenario 3: Missing move-in baseline is representable without a fake baseline record
  await t.test('3. Missing move-in baseline is explicitly representable and rejected if spurious reference is provided', async () => {
    const inspNoBaseId = `insp_nobase_${runId}`;
    const [noBaseline] = await db.insert(leaseMoveOutInspections).values({
      id: inspNoBaseId,
      leaseId: lease1Id,
      propertyId: propId,
      inspectorId: inspectorId,
      status: 'SCHEDULED',
      hasMoveInBaseline: false,
      moveInBaselineReference: null,
    }).returning();

    assert.strictEqual(noBaseline.hasMoveInBaseline, false);
    assert.strictEqual(noBaseline.moveInBaselineReference, null);

    // Check constraint lease_move_out_inspections_baseline_check prevents storing a baseline reference when has_move_in_baseline = false
    await assert.rejects(
      async () => {
        await db.insert(leaseMoveOutInspections).values({
          id: `insp_invalid_base_${runId}`,
          leaseId: lease1Id,
          propertyId: propId,
          inspectorId: inspectorId,
          status: 'SCHEDULED',
          hasMoveInBaseline: false,
          moveInBaselineReference: 'fake_baseline_doc_ref', // Invalid: baseline is false!
        });
      },
      isCheckConstraintError,
      'Supplying a moveInBaselineReference when hasMoveInBaseline is false must fail check constraint'
    );

    // When hasMoveInBaseline = true, baseline reference is accepted
    const inspWithBaseId = `insp_withbase_${runId}`;
    const [withBaseline] = await db.insert(leaseMoveOutInspections).values({
      id: inspWithBaseId,
      leaseId: lease1Id,
      propertyId: propId,
      inspectorId: inspectorId,
      status: 'SCHEDULED',
      hasMoveInBaseline: true,
      moveInBaselineReference: 'doc_move_in_report_2026',
    }).returning();

    assert.strictEqual(withBaseline.hasMoveInBaseline, true);
    assert.strictEqual(withBaseline.moveInBaselineReference, 'doc_move_in_report_2026');
  });

  // Scenario 4: Inspection items and evidence references preserve their intended parent relationships
  await t.test('4. Inspection items support room/area damage details and cascade delete on inspection deletion', async () => {
    const parentInspId = `insp_cascade_${runId}`;
    await db.insert(leaseMoveOutInspections).values({
      id: parentInspId,
      leaseId: lease1Id,
      propertyId: propId,
      inspectorId: inspectorId,
      status: 'IN_PROGRESS',
    });

    const itemId = `item1_${runId}`;
    const [item] = await db.insert(leaseMoveOutInspectionItems).values({
      id: itemId,
      inspectionId: parentInspId,
      area: 'KITCHEN',
      component: 'CABINET_DOOR',
      condition: 'DAMAGED',
      damageDescription: 'Hinges broken and panel scratched',
      isTenantCaused: true,
      estimatedRepairCost: '75000',
      currency: 'IQD',
      evidenceRefs: ['evidence/kitchen_cabinet_scratch_01.jpg', 'evidence/kitchen_cabinet_hinge_02.jpg'],
    }).returning();

    assert.strictEqual(item.id, itemId);
    assert.strictEqual(item.area, 'KITCHEN');
    assert.strictEqual(item.condition, 'DAMAGED');
    assert.strictEqual(item.isTenantCaused, true);
    assert.strictEqual(Number(item.estimatedRepairCost), 75000);
    assert.strictEqual(item.currency, 'IQD');
    assert.deepStrictEqual(item.evidenceRefs, [
      'evidence/kitchen_cabinet_scratch_01.jpg',
      'evidence/kitchen_cabinet_hinge_02.jpg',
    ]);

    // Deleting parent inspection must cascade delete child inspection items
    await db.delete(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.id, parentInspId));
    const [foundItem] = await db.select().from(leaseMoveOutInspectionItems).where(eq(leaseMoveOutInspectionItems.id, itemId));
    assert.strictEqual(foundItem, undefined, 'Child inspection item must be deleted on cascade');
  });

  // Scenario 5: Deduction proposals require valid deposit/lease relationships
  await t.test('5. Deduction proposals require valid deposit/lease relationships', async () => {
    const parentInspId = `insp_ded_${runId}`;
    await db.insert(leaseMoveOutInspections).values({
      id: parentInspId,
      leaseId: lease1Id,
      propertyId: propId,
      inspectorId: inspectorId,
      status: 'COMPLETED',
    });

    const itemId = `item_ded_${runId}`;
    await db.insert(leaseMoveOutInspectionItems).values({
      id: itemId,
      inspectionId: parentInspId,
      area: 'LIVING_ROOM',
      component: 'WALL_PAINT',
      condition: 'DAMAGED',
      damageDescription: 'Severe wall gouge requiring repainting',
      isTenantCaused: true,
      estimatedRepairCost: '150000',
      currency: 'IQD',
    });

    // Valid deduction proposal on deposit1Id and lease1Id succeeds
    const dedValidId = `ded_val_${runId}`;
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [ded] = await db.insert(securityDepositDeductions).values({
      id: dedValidId,
      depositId: deposit1Id,
      leaseId: lease1Id, // Matches deposit1Id.leaseId
      inspectionItemId: itemId,
      amount: '150000',
      currency: 'IQD',
      category: 'DAMAGE',
      description: 'Wall gouge repair in living room',
      proposedById: inspectorId,
      status: 'PROPOSED',
      disputeDeadline: deadline,
    }).returning();

    assert.strictEqual(ded.id, dedValidId);
    assert.strictEqual(ded.category, 'DAMAGE');
    assert.strictEqual(Number(ded.amount), 150000);

    // Mismatched leaseId (deposit1Id belongs to lease1Id, but claiming lease2Id) must fail composite FK
    await assert.rejects(
      async () => {
        await db.insert(securityDepositDeductions).values({
          id: `ded_mismatch_${runId}`,
          depositId: deposit1Id, // Belongs to lease1Id
          leaseId: lease2Id,    // Mismatch!
          amount: '50000',
          currency: 'IQD',
          category: 'DAMAGE',
          description: 'Mismatched deduction test',
          proposedById: inspectorId,
          status: 'PROPOSED',
          disputeDeadline: deadline,
        });
      },
      isForeignKeyError,
      'Deduction with depositId on lease1 but leaseId on lease2 must fail foreign key constraint'
    );
  });

  // Scenario 6: Invalid negative or zero deduction amounts are rejected by check constraint
  await t.test('6. Invalid negative, zero, or structurally invalid deduction amounts are rejected', async () => {
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Amount = 0 must fail check constraint (sec_dep_deductions_amount_check)
    await assert.rejects(
      async () => {
        await db.insert(securityDepositDeductions).values({
          id: `ded_zero_${runId}`,
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: '0',
          currency: 'IQD',
          category: 'CLEANING',
          description: 'Zero amount deduction',
          proposedById: inspectorId,
          status: 'PROPOSED',
          disputeDeadline: deadline,
        });
      },
      isCheckConstraintError,
      'Deduction with amount = 0 must violate sec_dep_deductions_amount_check'
    );

    // Amount < 0 must fail check constraint
    await assert.rejects(
      async () => {
        await db.insert(securityDepositDeductions).values({
          id: `ded_neg_${runId}`,
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: '-50000',
          currency: 'IQD',
          category: 'CLEANING',
          description: 'Negative amount deduction',
          proposedById: inspectorId,
          status: 'PROPOSED',
          disputeDeadline: deadline,
        });
      },
      isCheckConstraintError,
      'Deduction with negative amount must violate sec_dep_deductions_amount_check'
    );

    // Invalid currency must fail check constraint
    await assert.rejects(
      async () => {
        await db.insert(securityDepositDeductions).values({
          id: `ded_curr_${runId}`,
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: '50000',
          currency: 'EUR', // Only IQD and USD allowed
          category: 'CLEANING',
          description: 'Invalid currency deduction',
          proposedById: inspectorId,
          status: 'PROPOSED',
          disputeDeadline: deadline,
        });
      },
      isCheckConstraintError,
      'Deduction with unsupported currency must violate sec_dep_deductions_currency_check'
    );
  });

  // Scenario 7: Lifecycle status values follow check constraints
  await t.test('7. Deduction status transitions adhere to valid enum check constraints', async () => {
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Invalid status must be rejected
    await assert.rejects(
      async () => {
        await db.insert(securityDepositDeductions).values({
          id: `ded_bad_status_${runId}`,
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: '100000',
          currency: 'IQD',
          category: 'KEY_REPLACEMENT',
          description: 'Key replacement',
          proposedById: inspectorId,
          status: 'INVALID_STATUS_VALUE',
          disputeDeadline: deadline,
        });
      },
      isCheckConstraintError,
      'Deduction with invalid status must fail sec_dep_deductions_status_check'
    );

    // Valid statuses: PROPOSED, OWNER_APPROVED, REJECTED, DISPUTED, SETTLED, CANCELLED
    const validStatuses = ['PROPOSED', 'OWNER_APPROVED', 'REJECTED', 'DISPUTED', 'SETTLED', 'CANCELLED'];
    for (const st of validStatuses) {
      const [record] = await db.insert(securityDepositDeductions).values({
        id: `ded_st_${st.toLowerCase()}_${runId}`,
        depositId: deposit1Id,
        leaseId: lease1Id,
        amount: '10000',
        currency: 'IQD',
        category: 'OTHER',
        description: `Status test for ${st}`,
        proposedById: inspectorId,
        status: st,
        disputeDeadline: deadline,
      }).returning();
      assert.strictEqual(record.status, st);
    }
  });

  // Scenario 8: 30-day dispute deadline can be persisted deterministically
  await t.test('8. The 30-day dispute deadline can be persisted and queried deterministically', async () => {
    const proposedAt = new Date('2026-11-01T12:00:00Z');
    const deadline = new Date(proposedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const ded30Id = `ded_30d_${runId}`;
    const [ded] = await db.insert(securityDepositDeductions).values({
      id: ded30Id,
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: '80000',
      currency: 'IQD',
      category: 'CLEANING',
      description: 'End-of-lease deep cleaning',
      proposedById: inspectorId,
      proposedAt: proposedAt,
      status: 'PROPOSED',
      disputeDeadline: deadline,
    }).returning();

    assert.strictEqual(ded.disputeDeadline.toISOString(), deadline.toISOString());

    // Check querying by deadline index
    const [found] = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.id, ded30Id));
    assert.ok(found);
    assert.strictEqual(found.disputeDeadline.getTime(), deadline.getTime());
  });

  // Scenario 9: Disputed deduction represented without marking deposit settled or refunded
  await t.test('9. A disputed deduction is represented with reason while custodial deposit remains HELD', async () => {
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const dedDisputeId = `ded_disp_${runId}`;

    const [disputed] = await db.insert(securityDepositDeductions).values({
      id: dedDisputeId,
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: '200000',
      currency: 'IQD',
      category: 'DAMAGE',
      description: 'Water stain on parquet flooring',
      proposedById: inspectorId,
      status: 'DISPUTED',
      disputedAt: new Date(),
      disputeReason: 'Water stain existed prior to move-in as noted in verbal agreement',
      disputeDeadline: deadline,
    }).returning();

    assert.strictEqual(disputed.status, 'DISPUTED');
    assert.ok(disputed.disputeReason);

    // Crucial check: Authoritative security deposit record must remain HELD with 0 released amount!
    const [dep] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, deposit1Id));
    assert.strictEqual(dep.status, 'HELD', 'Security deposit status must remain HELD during deduction dispute');
    assert.strictEqual(Number(dep.releasedAmount), 0, 'Released amount must remain 0 during deduction dispute');
    assert.strictEqual(Number(dep.recordedAmount), 1000000, 'Recorded amount must remain intact');
  });

  // Teardown
  t.after(async () => {
    try {
      await db.delete(securityDepositDeductions).where(eq(securityDepositDeductions.depositId, deposit1Id));
      await db.delete(leaseMoveOutInspectionItems).where(
        sql`inspection_id IN (SELECT id FROM lease_move_out_inspections WHERE property_id IN (${propId}, ${prop2Id}))`
      );
      await db.delete(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.propertyId, propId));
      await db.delete(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.propertyId, prop2Id));
      await db.delete(moveOutRequests).where(eq(moveOutRequests.propertyId, propId));
      await db.delete(securityDeposits).where(eq(securityDeposits.propertyId, propId));
      await db.delete(leases).where(eq(leases.propertyId, propId));
      await db.delete(leases).where(eq(leases.propertyId, prop2Id));
      await db.delete(properties).where(eq(properties.id, propId));
      await db.delete(properties).where(eq(properties.id, prop2Id));
      await db.delete(users).where(eq(users.id, ownerId));
      await db.delete(users).where(eq(users.id, tenantId));
      await db.delete(users).where(eq(users.id, inspectorId));
    } catch (_) {}
  });
});
