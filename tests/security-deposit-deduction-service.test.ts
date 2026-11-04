import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  leaseTenants,
  moveOutRequests,
  securityDeposits,
  ownershipRecords,
  managementAgreements,
  organizationMembers,
  organizations,
  leaseMoveOutInspections,
  leaseMoveOutInspectionItems,
  securityDepositDeductions,
  auditLogs,
  notifications,
  notificationDeliveries,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { DeliveryStatus } from '../src/types/communications-crm.js';
import {
  securityDepositDeductionService,
  DeductionActor,
  VALID_DEDUCTION_CATEGORIES,
} from '../src/server/services/security-deposit-deduction.js';

test('Phase 44 — Move-Out Security Deposit Deduction Service Suite', async (t) => {
  const runId = `p44_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const ownerId = `owner_${runId}`;
  const otherOwnerId = `other_owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const otherTenantId = `other_tenant_${runId}`;
  const managerUserId = `mgr_${runId}`;
  const companyOrgId = `org_${runId}`;
  const prop1Id = `prop1_${runId}`;
  const prop2Id = `prop2_${runId}`;
  const lease1Id = `lease1_${runId}`;
  const lease2Id = `lease2_${runId}`;
  const deposit1Id = `dep1_${runId}`;
  const deposit2Id = `dep2_${runId}`;
  const moveOutReq1Id = `mor1_${runId}`;
  const moveOutReq2Id = `mor2_${runId}`;

  const ownerActor: DeductionActor = {
    id: ownerId,
    role: 'PROPERTY_OWNER',
    roles: ['PROPERTY_OWNER'],
  };

  const otherOwnerActor: DeductionActor = {
    id: otherOwnerId,
    role: 'PROPERTY_OWNER',
    roles: ['PROPERTY_OWNER'],
  };

  const tenantActor: DeductionActor = {
    id: tenantId,
    role: 'TENANT',
    roles: ['TENANT'],
  };

  const otherTenantActor: DeductionActor = {
    id: otherTenantId,
    role: 'TENANT',
    roles: ['TENANT'],
  };

  const managerActor: DeductionActor = {
    id: managerUserId,
    role: 'COMPANY_MEMBER',
    roles: ['COMPANY_MEMBER', 'PROPERTY_MANAGER'],
    organizationId: companyOrgId,
  };

  // 0. Setup test users, organizations, properties, ownership, management agreements, leases, tenants, deposits
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
      id: otherTenantId,
      email: `${otherTenantId}@test.com`,
      roles: ['TENANT'],
      firstName: 'OtherTenant',
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
      status: 'OCCUPIED',
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

  await db.insert(leaseTenants).values([
    {
      id: `lt1_${runId}`,
      leaseId: lease1Id,
      tenantId: tenantId,
      isPrimary: true,
    },
    {
      id: `lt2_${runId}`,
      leaseId: lease2Id,
      tenantId: otherTenantId,
      isPrimary: true,
    },
  ]);

  // Primary test deposit for lease 1: 1,200,000 IQD held
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
    {
      id: deposit2Id,
      leaseId: lease2Id,
      propertyId: prop2Id,
      tenantId: otherTenantId,
      requiredAmount: '900000',
      recordedAmount: '900000',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'HELD',
    },
  ]);

  // Create move-out inspection and inspection items for lease 1
  const completedInsp1Id = `insp1_${runId}`;
  const scheduledInsp2Id = `insp2_${runId}`;

  await db.insert(leaseMoveOutInspections).values([
    {
      id: completedInsp1Id,
      leaseId: lease1Id,
      propertyId: prop1Id,
      inspectorId: ownerId,
      status: 'COMPLETED',
      hasMoveInBaseline: false,
      completedAt: new Date(),
    },
    {
      id: scheduledInsp2Id,
      leaseId: lease1Id,
      propertyId: prop1Id,
      inspectorId: ownerId,
      status: 'SCHEDULED',
      hasMoveInBaseline: false,
    },
  ]);

  const validInspectionItemId = `item1_${runId}`;
  const incompleteInspectionItemId = `item2_${runId}`;

  await db.insert(leaseMoveOutInspectionItems).values([
    {
      id: validInspectionItemId,
      inspectionId: completedInsp1Id,
      area: 'LIVING_ROOM',
      component: 'WALLS',
      condition: 'DAMAGED',
      damageDescription: 'Wall gouge from moving furniture',
      isTenantCaused: true,
      estimatedRepairCost: '150000',
      currency: 'IQD',
    },
    {
      id: incompleteInspectionItemId,
      inspectionId: scheduledInsp2Id,
      area: 'KITCHEN',
      component: 'SINK',
      condition: 'DIRTY',
      damageDescription: 'Needs chemical descale',
      isTenantCaused: true,
      estimatedRepairCost: '50000',
      currency: 'IQD',
    },
  ]);

  // Create an inspection item on lease 2 for cross-lease testing
  const completedInspLease2Id = `insp_l2_${runId}`;
  const crossLeaseInspectionItemId = `item_l2_${runId}`;

  await db.insert(leaseMoveOutInspections).values({
    id: completedInspLease2Id,
    leaseId: lease2Id,
    propertyId: prop2Id,
    inspectorId: otherOwnerId,
    status: 'COMPLETED',
    hasMoveInBaseline: false,
    completedAt: new Date(),
  });

  await db.insert(leaseMoveOutInspectionItems).values({
    id: crossLeaseInspectionItemId,
    inspectionId: completedInspLease2Id,
    area: 'BATHROOM',
    component: 'TILE',
    condition: 'DAMAGED',
    damageDescription: 'Cracked floor tile',
    isTenantCaused: true,
    estimatedRepairCost: '80000',
    currency: 'IQD',
  });

  // ==========================================
  // TEST CASES
  // ==========================================

  // 1. Authorized proposal against a valid held deposit
  await t.test('1. Authorized proposal against a valid held deposit creates row and audit log', async () => {
    const deduction = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      inspectionItemId: validInspectionItemId,
      amount: 150000,
      currency: 'IQD',
      category: 'DAMAGE',
      description: 'Living room wall drywall patching and repainting',
      evidenceRefs: ['inspections/wall_damage_1.jpg', 'inspections/wall_damage_2.png'],
    }, ownerActor);

    assert.ok(deduction.id);
    assert.strictEqual(deduction.depositId, deposit1Id);
    assert.strictEqual(deduction.leaseId, lease1Id);
    assert.strictEqual(deduction.inspectionItemId, validInspectionItemId);
    assert.strictEqual(Number(deduction.amount), 150000);
    assert.strictEqual(deduction.currency, 'IQD');
    assert.strictEqual(deduction.category, 'DAMAGE');
    assert.strictEqual(deduction.status, 'PROPOSED');
    // Phase 46 Invariant: Proposal creation does NOT start the dispute window
    assert.strictEqual(deduction.disputeDeadline, null, 'Dispute deadline must not start on draft proposal creation');
    assert.strictEqual(deduction.tenantNotifiedAt, null, 'Tenant notified timestamp must not be set on draft proposal creation');
    assert.strictEqual(deduction.noticeDeliveryStatus, 'NOT_SENT');

    // Verify audit log
    const [audit] = await db.select().from(auditLogs).where(and(
      eq(auditLogs.resourceId, deduction.id),
      eq(auditLogs.action, 'PROPOSE_SECURITY_DEPOSIT_DEDUCTION')
    ));
    assert.ok(audit, 'Audit log must be created for deduction proposal');
    assert.strictEqual(audit.actorUserId, ownerId);
    assert.strictEqual(audit.resourceType, 'SecurityDepositDeduction');

    // Notice dispatch verifiably delivers and establishes the 30-day deadline
    const notified = await securityDepositDeductionService.dispatchDeductionNotice(deduction.id, ownerActor);
    assert.ok(notified.tenantNotifiedAt, 'Tenant notified timestamp must be set upon verified notice delivery');
    assert.ok(notified.disputeDeadline, 'Dispute deadline must be established upon verified notice delivery');
    assert.strictEqual(notified.noticeDeliveryStatus, 'DELIVERED');
    const expectedDeadline = new Date(notified.tenantNotifiedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
    const actualDeadline = new Date(notified.disputeDeadline).getTime();
    assert.ok(Math.abs(actualDeadline - expectedDeadline) < 5000, 'Deadline must be deliveredAt + 30 days');
  });

  // 2. Reject missing or ineligible deposit
  await t.test('2. Reject missing or ineligible deposit', async () => {
    // Missing deposit
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: 'non_existent_deposit',
          leaseId: lease1Id,
          amount: 50000,
          category: 'CLEANING',
          description: 'Cleaning fee',
        }, ownerActor);
      },
      /NOT_FOUND.*deposit not found/i
    );

    // Ineligible deposit: status PENDING
    const pendingDepId = `dep_pending_${runId}`;
    await db.insert(securityDeposits).values({
      id: pendingDepId,
      leaseId: lease1Id,
      propertyId: prop1Id,
      tenantId: tenantId,
      requiredAmount: '500000',
      recordedAmount: '0',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'PENDING',
    });

    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: pendingDepId,
          leaseId: lease1Id,
          amount: 50000,
          category: 'CLEANING',
          description: 'Cleaning fee',
        }, ownerActor);
      },
      /INVALID_STATE.*not in an eligible held custodial state/i
    );

    // Ineligible deposit: status REFUNDED (held balance 0)
    const refundedDepId = `dep_refunded_${runId}`;
    await db.insert(securityDeposits).values({
      id: refundedDepId,
      leaseId: lease1Id,
      propertyId: prop1Id,
      tenantId: tenantId,
      requiredAmount: '500000',
      recordedAmount: '500000',
      releasedAmount: '500000',
      currency: 'IQD',
      status: 'REFUNDED',
    });

    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: refundedDepId,
          leaseId: lease1Id,
          amount: 50000,
          category: 'CLEANING',
          description: 'Cleaning fee',
        }, ownerActor);
      },
      /INVALID_STATE.*not in an eligible held custodial state/i
    );
  });

  // 3. Reject deposit/lease mismatch for authorized caller (preserves validation detail)
  await t.test('3. Reject deposit/lease mismatch for authorized caller (preserves validation detail)', async () => {
    // deposit1Id belongs to lease1Id, caller specifies lease2Id
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease2Id,
          amount: 50000,
          category: 'CLEANING',
          description: 'Cleaning fee mismatch',
        }, ownerActor);
      },
      /VALIDATION_ERROR.*belongs to lease/i
    );
  });

  // 3b. Reject unauthorized deposit/lease mismatch without disclosing real lease identifiers (Finding E-01)
  await t.test('3b. Reject unauthorized deposit/lease mismatch without disclosing real lease identifiers (Finding E-01)', async () => {
    // Other owner (not owner/manager of prop1) probes deposit1 with wrong lease2Id
    try {
      await securityDepositDeductionService.proposeDeduction({
        depositId: deposit1Id,
        leaseId: lease2Id,
        amount: 50000,
        category: 'CLEANING',
        description: 'Unauthorized probing of deposit-lease relationship',
      }, otherOwnerActor);
      assert.fail('Should have rejected with FORBIDDEN');
    } catch (err: any) {
      assert.match(err.message, /FORBIDDEN/i, 'Must return consistent FORBIDDEN error');
      assert.ok(!err.message.includes(lease1Id), 'Must NOT disclose real lease1Id to unauthorized actor');
      assert.ok(!err.message.includes('belongs to lease'), 'Must NOT disclose relational detail before authorization');
    }

    // Tenant probes deposit1 with mismatched lease2Id
    try {
      await securityDepositDeductionService.proposeDeduction({
        depositId: deposit1Id,
        leaseId: lease2Id,
        amount: 50000,
        category: 'CLEANING',
        description: 'Tenant probing unauthorized mismatch',
      }, tenantActor);
      assert.fail('Should have rejected with FORBIDDEN');
    } catch (err: any) {
      assert.match(err.message, /FORBIDDEN/i, 'Must return FORBIDDEN to tenant');
      assert.ok(!err.message.includes(lease1Id), 'Must NOT disclose real lease1Id to tenant');
    }
  });

  // 4. Reject inspection item belonging to another lease
  await t.test('4. Reject inspection item belonging to another lease', async () => {
    // crossLeaseInspectionItemId belongs to lease 2, but proposal is for lease 1
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          inspectionItemId: crossLeaseInspectionItemId,
          amount: 50000,
          category: 'DAMAGE',
          description: 'Attempting to link item from another lease',
        }, ownerActor);
      },
      /VALIDATION_ERROR.*Linked inspection item belongs to lease/i
    );
  });

  // 5. Reject item from an incomplete or cancelled inspection
  await t.test('5. Reject item from an incomplete or cancelled inspection', async () => {
    // incompleteInspectionItemId belongs to scheduled inspection
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          inspectionItemId: incompleteInspectionItemId,
          amount: 50000,
          category: 'CLEANING',
          description: 'Attempting to link item from scheduled inspection',
        }, ownerActor);
      },
      /INVALID_STATE.*Deductions can only be linked to items from COMPLETED inspections/i
    );
  });

  // 6. Reject invalid category, currency mismatch, zero/negative amount, and invalid evidence references
  await t.test('6. Reject invalid category, currency mismatch, zero/negative amount, and invalid evidence references', async () => {
    // Invalid category
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: 50000,
          category: 'INVALID_CATEGORY' as any,
          description: 'Invalid category test',
        }, ownerActor);
      },
      /VALIDATION_ERROR.*Invalid deduction category/i
    );

    // Currency mismatch (deposit is IQD, proposal requests USD)
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: 100,
          currency: 'USD',
          category: 'CLEANING',
          description: 'Currency mismatch test',
        }, ownerActor);
      },
      /CURRENCY_MISMATCH/i
    );

    // Zero amount
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: 0,
          category: 'CLEANING',
          description: 'Zero amount test',
        }, ownerActor);
      },
      /VALIDATION_ERROR.*positive finite number/i
    );

    // Negative amount
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: -50000,
          category: 'CLEANING',
          description: 'Negative amount test',
        }, ownerActor);
      },
      /VALIDATION_ERROR.*positive finite number/i
    );

    // Path traversal in evidence reference
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: 50000,
          category: 'CLEANING',
          description: 'Evidence traversal test',
          evidenceRefs: ['../secrets/passwords.txt.jpg'],
        }, ownerActor);
      },
      /INVALID_EVIDENCE_REFERENCE.*Path traversal/i
    );

    // External URL in evidence reference
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: 50000,
          category: 'CLEANING',
          description: 'Evidence URL test',
          evidenceRefs: ['https://malicious.com/exploit.jpg'],
        }, ownerActor);
      },
      /INVALID_EVIDENCE_REFERENCE.*External URL schemes/i
    );

    // Disallowed file extension (.exe)
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: 50000,
          category: 'CLEANING',
          description: 'Evidence extension test',
          evidenceRefs: ['malware.exe'],
        }, ownerActor);
      },
      /INVALID_EVIDENCE_REFERENCE.*Unsupported file extension/i
    );
  });

  // 7. Enforce the deduction ceiling across existing proposed/approved deductions
  await t.test('7. Enforce the deduction ceiling across existing proposed/approved deductions', async () => {
    // Create dedicated deposit with 1,000,000 IQD held balance
    const ceilingDepId = `dep_ceiling_${runId}`;
    const ceilingLeaseId = `lease_ceiling_${runId}`;

    await db.insert(leases).values({
      id: ceilingLeaseId,
      propertyId: prop1Id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1000000',
      currency: 'IQD',
      depositAmount: '1000000',
    });

    await db.insert(securityDeposits).values({
      id: ceilingDepId,
      leaseId: ceilingLeaseId,
      propertyId: prop1Id,
      tenantId: tenantId,
      requiredAmount: '1000000',
      recordedAmount: '1000000',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'HELD',
    });

    // Proposal 1: 600,000 IQD -> should succeed (remaining: 400,000)
    const p1 = await securityDepositDeductionService.proposeDeduction({
      depositId: ceilingDepId,
      leaseId: ceilingLeaseId,
      amount: 600000,
      category: 'DAMAGE',
      description: 'Ceiling test p1: 600k',
    }, ownerActor);
    assert.strictEqual(Number(p1.amount), 600000);

    // Proposal 2: 500,000 IQD -> exceeds remaining 400,000 -> must reject
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: ceilingDepId,
          leaseId: ceilingLeaseId,
          amount: 500000,
          category: 'DAMAGE',
          description: 'Ceiling test p2: 500k (exceeds)',
        }, ownerActor);
      },
      /DEDUCTION_EXCEEDS_AVAILABLE_BALANCE/i
    );

    // Proposal 3: 400,000 IQD -> exactly reaches 1,000,000 -> should succeed
    const p3 = await securityDepositDeductionService.proposeDeduction({
      depositId: ceilingDepId,
      leaseId: ceilingLeaseId,
      amount: 400000,
      category: 'CLEANING',
      description: 'Ceiling test p3: exactly remaining 400k',
    }, ownerActor);
    assert.strictEqual(Number(p3.amount), 400000);

    // Proposal 4: 10,000 IQD -> deposit is fully reserved -> must reject
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: ceilingDepId,
          leaseId: ceilingLeaseId,
          amount: 10000,
          category: 'KEY_REPLACEMENT',
          description: 'Ceiling test p4: 10k after full exhaustion',
        }, ownerActor);
      },
      /DEDUCTION_EXCEEDS_AVAILABLE_BALANCE/i
    );

    // Reject Proposal 1 (600,000) -> releases 600,000 reservation
    await securityDepositDeductionService.rejectDeduction(p1.id, 'Damage found to be pre-existing', ownerActor);

    // Now Proposal 5: 500,000 IQD -> should succeed because 600k was unreserved!
    const p5 = await securityDepositDeductionService.proposeDeduction({
      depositId: ceilingDepId,
      leaseId: ceilingLeaseId,
      amount: 500000,
      category: 'UNPAID_UTILITIES',
      description: 'Ceiling test p5: 500k following p1 rejection',
    }, ownerActor);
    assert.strictEqual(Number(p5.amount), 500000);
  });

  // 8. Ensure concurrent proposals cannot exceed the available deposit amount
  await t.test('8. Ensure concurrent proposals cannot exceed the available deposit amount', async () => {
    // Create dedicated deposit with 500,000 IQD held balance
    const concDepId = `dep_conc_${runId}`;
    const concLeaseId = `lease_conc_${runId}`;

    await db.insert(leases).values({
      id: concLeaseId,
      propertyId: prop1Id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '500000',
      currency: 'IQD',
      depositAmount: '500000',
    });

    await db.insert(securityDeposits).values({
      id: concDepId,
      leaseId: concLeaseId,
      propertyId: prop1Id,
      tenantId: tenantId,
      requiredAmount: '500000',
      recordedAmount: '500000',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'HELD',
    });

    // Fire 5 concurrent proposals each requesting 300,000 IQD (300k * 2 = 600k > 500k)
    // Under row-locking serialize, exactly 1 must succeed and 4 must fail
    const promises = Array.from({ length: 5 }, (_, i) =>
      securityDepositDeductionService.proposeDeduction({
        depositId: concDepId,
        leaseId: concLeaseId,
        amount: 300000,
        category: 'OTHER',
        description: `Concurrent proposal attempt ${i + 1}`,
      }, ownerActor)
    );

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent proposal should succeed');
    assert.strictEqual(rejected.length, 4, 'Four concurrent proposals should fail due to ceiling enforcement');

    // Confirm total active reserved deductions in DB does not exceed 500,000
    const inDb = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.depositId, concDepId));
    const totalReserved = inDb.reduce((sum, d) => sum + parseFloat(d.amount || '0'), 0);
    assert.strictEqual(totalReserved, 300000, 'Total reserved amount must be exactly 300,000 IQD');
  });

  // 9. Allow a verified owner to approve a valid proposal
  await t.test('9. Allow a verified owner to approve a valid proposal', async () => {
    const deduction = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 200000,
      category: 'CLEANING',
      description: 'End of tenancy deep clean',
    }, ownerActor);

    assert.strictEqual(deduction.status, 'PROPOSED');

    const approved = await securityDepositDeductionService.approveDeduction(deduction.id, ownerActor);
    assert.strictEqual(approved.status, 'OWNER_APPROVED');
    assert.strictEqual(approved.approvedById, ownerId);
    assert.ok(approved.approvedAt);

    // Verify audit log
    const [audit] = await db.select().from(auditLogs).where(and(
      eq(auditLogs.resourceId, deduction.id),
      eq(auditLogs.action, 'APPROVE_SECURITY_DEPOSIT_DEDUCTION')
    ));
    assert.ok(audit, 'Audit log must be created for deduction approval');
    assert.strictEqual(audit.actorUserId, ownerId);
  });

  // 10. Deny manager approval without explicit delegated authority (Decision P02)
  await t.test('10. Deny manager approval without explicit delegated authority (Decision P02)', async () => {
    const deduction = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 100000,
      category: 'KEY_REPLACEMENT',
      description: 'Security key fob replacement',
    }, ownerActor);

    // Company manager tries to approve
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.approveDeduction(deduction.id, managerActor);
      },
      /FORBIDDEN.*not authorized to approve security deposit deductions/i
    );

    // Verify status remains PROPOSED in database
    const [fresh] = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.id, deduction.id));
    assert.strictEqual(fresh.status, 'PROPOSED');
  });

  // 11. Allow delegated manager approval only if a real, explicit existing permission supports it; otherwise test fail-closed behavior and document the gap
  await t.test('11. Test fail-closed behavior for manager approval even with generic permissions (delegation gap)', async () => {
    const deduction = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 75000,
      category: 'CLEANING',
      description: 'Curtain laundry service',
    }, ownerActor);

    // Even if manager actor has elevated company roles and permissions in agreement
    const elevatedManagerActor: DeductionActor = {
      id: managerUserId,
      role: 'PROPERTY_MANAGER',
      roles: ['COMPANY_MEMBER', 'PROPERTY_MANAGER', 'FINANCIAL_APPROVER'],
      organizationId: companyOrgId,
    };

    await assert.rejects(
      async () => {
        await securityDepositDeductionService.approveDeduction(deduction.id, elevatedManagerActor);
      },
      /FORBIDDEN/i
    );
  });

  // 12. Reject duplicate or invalid approval/rejection transitions
  await t.test('12. Reject duplicate or invalid approval/rejection transitions', async () => {
    const deduction = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 50000,
      category: 'OTHER',
      description: 'Pest control treatment',
    }, ownerActor);

    // Approve once
    await securityDepositDeductionService.approveDeduction(deduction.id, ownerActor);

    // Duplicate approval must be rejected
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.approveDeduction(deduction.id, ownerActor);
      },
      /INVALID_STATE.*Cannot approve deduction with status 'OWNER_APPROVED'/i
    );

    // Rejecting an approved deduction must be rejected
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.rejectDeduction(deduction.id, 'Changed mind', ownerActor);
      },
      /INVALID_STATE.*Cannot reject deduction with status 'OWNER_APPROVED'/i
    );

    // Create another deduction and reject it
    const deduction2 = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 50000,
      category: 'OTHER',
      description: 'Second pest control proposal',
    }, ownerActor);

    await securityDepositDeductionService.rejectDeduction(deduction2.id, 'Not necessary', ownerActor);

    // Approving a rejected deduction must be rejected
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.approveDeduction(deduction2.id, ownerActor);
      },
      /INVALID_STATE.*Cannot approve deduction with status 'REJECTED'/i
    );

    // Duplicate rejection must be rejected
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.rejectDeduction(deduction2.id, 'Duplicate reject', ownerActor);
      },
      /INVALID_STATE.*Cannot reject deduction with status 'REJECTED'/i
    );
  });

  // 13. Require a rejection reason and preserve audit history
  await t.test('13. Require a rejection reason and preserve audit history', async () => {
    const deduction = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 60000,
      category: 'CLEANING',
      description: 'Balcony power washing',
    }, ownerActor);

    // Empty rejection reason
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.rejectDeduction(deduction.id, '', ownerActor);
      },
      /VALIDATION_ERROR.*Rejection reason is required/i
    );

    // Whitespace rejection reason
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.rejectDeduction(deduction.id, '   ', ownerActor);
      },
      /VALIDATION_ERROR.*Rejection reason is required/i
    );

    // Valid rejection
    const rejected = await securityDepositDeductionService.rejectDeduction(
      deduction.id,
      'Tenant already cleaned balcony before final walkthrough',
      ownerActor
    );

    assert.strictEqual(rejected.status, 'REJECTED');
    assert.strictEqual(rejected.rejectionReason, 'Tenant already cleaned balcony before final walkthrough');

    // Audit log verification
    const [audit] = await db.select().from(auditLogs).where(and(
      eq(auditLogs.resourceId, deduction.id),
      eq(auditLogs.action, 'REJECT_SECURITY_DEPOSIT_DEDUCTION')
    ));
    assert.ok(audit, 'Audit log must be created for deduction rejection');
    assert.strictEqual(audit.actorUserId, ownerId);
    assert.strictEqual((audit.changes as any).rejectionReason, 'Tenant already cleaned balcony before final walkthrough');
  });

  // 14. Enforce tenant read-only access and cross-lease/property isolation
  await t.test('14. Enforce tenant read-only access and cross-lease/property isolation', async () => {
    // Tenant reads their own lease deductions
    const deductions = await securityDepositDeductionService.getDeductionsForLease(lease1Id, tenantActor);
    assert.ok(Array.isArray(deductions));
    assert.ok(deductions.length > 0);

    // Tenant reads specific deduction on their lease
    const singleDeduction = await securityDepositDeductionService.getDeductionById(deductions[0].id, tenantActor);
    assert.strictEqual(singleDeduction.id, deductions[0].id);

    // Tenant attempting to propose a deduction must be rejected
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: 10000,
          category: 'DAMAGE',
          description: 'Tenant attempting to self-deduct',
        }, tenantActor);
      },
      /FORBIDDEN/i
    );

    // Create a fresh PROPOSED deduction to test tenant cannot approve/reject
    const tenantTestProposal = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 12000,
      category: 'CLEANING',
      description: 'Proposal for tenant authorization check',
    }, ownerActor);

    // Tenant attempting to approve must be rejected
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.approveDeduction(tenantTestProposal.id, tenantActor);
      },
      /FORBIDDEN/i
    );

    // Tenant attempting to reject must be rejected
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.rejectDeduction(tenantTestProposal.id, 'Tenant rejection', tenantActor);
      },
      /FORBIDDEN/i
    );

    // Cross-lease isolation: tenant 2 attempting to read lease 1 deductions
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.getDeductionsForLease(lease1Id, otherTenantActor);
      },
      /FORBIDDEN.*do not have permission to view deductions for this lease/i
    );

    // Cross-property isolation: owner 2 attempting to read lease 1 deductions
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.getDeductionsForLease(lease1Id, otherOwnerActor);
      },
      /FORBIDDEN.*do not have permission to view deductions for this lease/i
    );
  });

  // 15. Verify transaction rollback on audit or persistence failure
  await t.test('15. Verify transaction rollback on audit or persistence failure', async () => {
    const countBefore = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.leaseId, lease1Id));

    // Simulated audit failure on proposal
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.proposeDeduction({
          depositId: deposit1Id,
          leaseId: lease1Id,
          amount: 88888,
          category: 'CLEANING',
          description: 'Simulated rollback proposal',
        }, { ...ownerActor, simulateAuditFailure: true });
      },
      /SIMULATED_AUDIT_FAILURE/i
    );

    const countAfter = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.leaseId, lease1Id));
    assert.strictEqual(countAfter.length, countBefore.length, 'No deduction row must persist after proposal transaction failure');

    // Simulated audit failure on approval
    const proposal = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 45000,
      category: 'CLEANING',
      description: 'Simulated approval rollback proposal',
    }, ownerActor);

    await assert.rejects(
      async () => {
        await securityDepositDeductionService.approveDeduction(proposal.id, { ...ownerActor, simulateAuditFailure: true });
      },
      /SIMULATED_AUDIT_FAILURE/i
    );

    const [afterFailedApproval] = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.id, proposal.id));
    assert.strictEqual(afterFailedApproval.status, 'PROPOSED', 'Status must remain PROPOSED after approval transaction failure');
    assert.strictEqual(afterFailedApproval.approvedById, null);

    // Simulated audit failure on rejection
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.rejectDeduction(proposal.id, 'Reject rollback', { ...ownerActor, simulateAuditFailure: true });
      },
      /SIMULATED_AUDIT_FAILURE/i
    );

    const [afterFailedRejection] = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.id, proposal.id));
    assert.strictEqual(afterFailedRejection.status, 'PROPOSED', 'Status must remain PROPOSED after rejection transaction failure');
    assert.strictEqual(afterFailedRejection.rejectionReason, null);
  });

  // 16. Verify proposal/approval/rejection do not mutate deposit balances, lease status, or create financial journal entries
  await t.test('16. Verify proposal/approval/rejection do not mutate deposit balances, lease status, or create financial journal entries', async () => {
    // Snapshot initial state of lease 1 and deposit 1
    const [leaseBefore] = await db.select().from(leases).where(eq(leases.id, lease1Id));
    const [depBefore] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, deposit1Id));

    assert.strictEqual(leaseBefore.status, 'ACTIVE');
    assert.strictEqual(leaseBefore.depositReconciliationStatus, 'NOT_EVALUATED');
    assert.strictEqual(depBefore.status, 'HELD');
    assert.strictEqual(Number(depBefore.recordedAmount), 1200000);
    assert.strictEqual(Number(depBefore.releasedAmount), 0);

    // Workflow: Proposal -> Approval -> Rejection of separate deduction
    const p = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 35000,
      category: 'OTHER',
      description: 'Financial immutability test proposal',
    }, ownerActor);

    await securityDepositDeductionService.approveDeduction(p.id, ownerActor);

    const p2 = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 25000,
      category: 'OTHER',
      description: 'Financial immutability test proposal 2',
    }, ownerActor);

    await securityDepositDeductionService.rejectDeduction(p2.id, 'Rejection immutability test', ownerActor);

    // Snapshot state after
    const [leaseAfter] = await db.select().from(leases).where(eq(leases.id, lease1Id));
    const [depAfter] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, deposit1Id));

    // Verify Invariants
    assert.strictEqual(leaseAfter.status, 'ACTIVE', 'Lease status must remain ACTIVE');
    assert.strictEqual(leaseAfter.depositReconciliationStatus, 'NOT_EVALUATED', 'Deposit reconciliation status must remain NOT_EVALUATED');
    assert.strictEqual(depAfter.status, 'HELD', 'Security deposit status must remain HELD');
    assert.strictEqual(Number(depAfter.recordedAmount), 1200000, 'Security deposit recorded amount must be unchanged');
    assert.strictEqual(Number(depAfter.releasedAmount), 0, 'Security deposit released amount must remain 0');
  });

  // ============================================================================
  // PHASE 46 DEDICATED SUITE: NOTICE AND DISPUTE DEADLINE INTEGRITY
  // ============================================================================

  // 17. Proposal creation does not start the dispute clock before the required notice event
  await t.test('17. Proposal creation does not start the dispute clock before the required notice event', async () => {
    const draft = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 40000,
      category: 'CLEANING',
      description: 'Draft deduction proposal without immediate notice dispatch',
    }, ownerActor);

    assert.strictEqual(draft.status, 'PROPOSED');
    assert.strictEqual(draft.disputeDeadline, null, 'Dispute deadline must be null on proposal creation');
    assert.strictEqual(draft.tenantNotifiedAt, null, 'Tenant notified timestamp must be null on proposal creation');
    assert.strictEqual(draft.noticeDeliveryStatus, 'NOT_SENT');
    assert.strictEqual(draft.noticeNotificationId, null);
    assert.strictEqual(draft.noticeDeliveryId, null);

    // Verify database row directly
    const [inDb] = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.id, draft.id));
    assert.strictEqual(inDb.disputeDeadline, null);
    assert.strictEqual(inDb.tenantNotifiedAt, null);
    assert.strictEqual(inDb.noticeDeliveryStatus, 'NOT_SENT');
  });

  // 18. Successful verified notice establishes the correct 30-day deadline
  await t.test('18. Successful verified notice establishes the correct 30-day deadline', async () => {
    const proposal = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 30000,
      category: 'OTHER',
      description: 'Verified notice delivery test',
    }, ownerActor);

    assert.strictEqual(proposal.disputeDeadline, null);

    const notified = await securityDepositDeductionService.dispatchDeductionNotice(proposal.id, ownerActor);
    assert.strictEqual(notified.noticeDeliveryStatus, 'DELIVERED');
    assert.ok(notified.tenantNotifiedAt, 'tenantNotifiedAt must be set');
    assert.ok(notified.disputeDeadline, 'disputeDeadline must be set');
    assert.ok(notified.noticeNotificationId, 'noticeNotificationId must be set');
    assert.ok(notified.noticeDeliveryId, 'noticeDeliveryId must be set');

    // Confirm deadline is deliveredAt + 30 days
    const deliveredTime = new Date(notified.tenantNotifiedAt).getTime();
    const deadlineTime = new Date(notified.disputeDeadline).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    assert.strictEqual(deadlineTime - deliveredTime, thirtyDaysMs, 'Deadline must be exactly deliveredAt + 30 days');

    // Verify audit log
    const [audit] = await db.select().from(auditLogs).where(and(
      eq(auditLogs.resourceId, proposal.id),
      eq(auditLogs.action, 'TENANT_DEDUCTION_NOTICE_DELIVERED')
    ));
    assert.ok(audit, 'Audit log for delivered notice must exist');
    assert.strictEqual(audit.actorUserId, ownerId);
  });

  // 19. Queued or pending notification is not incorrectly treated as delivered
  await t.test('19. Queued or pending notification is not incorrectly treated as delivered', async () => {
    const proposal = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 25000,
      category: 'OTHER',
      description: 'Pending notice callback test',
    }, ownerActor);

    // Initial state: NOT_SENT, null deadline
    assert.strictEqual(proposal.disputeDeadline, null);

    // Create a mock delivery record with status SENT (queued/in-transit)
    const [mockNotif] = await db.insert(notifications).values({
      userId: tenantId,
      title: 'Deduction Notice',
      message: 'Pending delivery notice',
      category: 'DISPUTE',
      priority: 'HIGH',
      status: 'SENT',
      sourceDomain: 'SECURITY_DEPOSIT',
    }).returning();

    const [mockDelivery] = await db.insert(notificationDeliveries).values({
      notificationId: mockNotif.id,
      channel: 'EMAIL',
      provider: 'SES_MOCK',
      status: 'SENT',
      recipientAddress: 'tenant@test.com',
      sentAt: new Date(),
    }).returning();

    // Link delivery to deduction
    await db.update(securityDepositDeductions)
      .set({
        noticeNotificationId: mockNotif.id,
        noticeDeliveryId: mockDelivery.id,
        noticeDeliveryStatus: 'SENT',
      })
      .where(eq(securityDepositDeductions.id, proposal.id));

    // Callback with SENT
    const updated = await securityDepositDeductionService.handleNoticeDeliveryCallback(
      mockDelivery.id,
      DeliveryStatus.SENT
    );

    assert.strictEqual(updated.noticeDeliveryStatus, 'SENT');
    assert.strictEqual(updated.disputeDeadline, null, 'Dispute clock must NOT start on SENT / QUEUED status');
    assert.strictEqual(updated.tenantNotifiedAt, null, 'Tenant must NOT be marked notified on SENT / QUEUED status');
  });

  // 20. Failed notification does not falsely mark the tenant as notified
  await t.test('20. Failed notification does not falsely mark the tenant as notified', async () => {
    const proposal = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 20000,
      category: 'OTHER',
      description: 'Failed notice delivery test',
    }, ownerActor);

    const [mockNotif] = await db.insert(notifications).values({
      userId: tenantId,
      title: 'Deduction Notice',
      message: 'Failed delivery notice',
      category: 'DISPUTE',
      priority: 'HIGH',
      status: 'FAILED',
      sourceDomain: 'SECURITY_DEPOSIT',
    }).returning();

    const [mockDelivery] = await db.insert(notificationDeliveries).values({
      notificationId: mockNotif.id,
      channel: 'SMS',
      provider: 'MOCK_SMS',
      status: 'FAILED',
      recipientAddress: '+9647500000000',
      failureReason: 'PROVIDER_TIMEOUT',
    }).returning();

    await db.update(securityDepositDeductions)
      .set({
        noticeNotificationId: mockNotif.id,
        noticeDeliveryId: mockDelivery.id,
      })
      .where(eq(securityDepositDeductions.id, proposal.id));

    const failed = await securityDepositDeductionService.handleNoticeDeliveryCallback(
      mockDelivery.id,
      DeliveryStatus.FAILED,
      { failureReason: 'PROVIDER_TIMEOUT' }
    );

    assert.strictEqual(failed.noticeDeliveryStatus, 'FAILED');
    assert.strictEqual(failed.disputeDeadline, null, 'Failed notification must not establish dispute deadline');
    assert.strictEqual(failed.tenantNotifiedAt, null, 'Failed notification must not record tenant notified timestamp');

    // Audit log verification
    const [audit] = await db.select().from(auditLogs).where(and(
      eq(auditLogs.resourceId, proposal.id),
      eq(auditLogs.action, 'TENANT_DEDUCTION_NOTICE_DELIVERY_FAILED')
    ));
    assert.ok(audit, 'Audit log for failed delivery notice must exist');
  });

  // 21. Duplicate delivery callbacks do not reset the deadline (idempotency)
  await t.test('21. Duplicate delivery callbacks do not reset the deadline (idempotency)', async () => {
    const proposal = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 18000,
      category: 'CLEANING',
      description: 'Idempotent delivery callback test',
    }, ownerActor);

    // First confirmed notice delivery
    const delivered = await securityDepositDeductionService.dispatchDeductionNotice(proposal.id, ownerActor);
    assert.strictEqual(delivered.noticeDeliveryStatus, 'DELIVERED');
    const initialDeliveredAt = new Date(delivered.tenantNotifiedAt!).getTime();
    const initialDisputeDeadline = new Date(delivered.disputeDeadline!).getTime();

    // Simulate duplicate delivery webhook firing 5 days later with a later timestamp
    const futureDeliveredAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const replayResult = await securityDepositDeductionService.handleNoticeDeliveryCallback(
      delivered.noticeDeliveryId!,
      DeliveryStatus.DELIVERED,
      { deliveredAt: futureDeliveredAt }
    );

    const replayedDeliveredAt = new Date(replayResult.tenantNotifiedAt!).getTime();
    const replayedDisputeDeadline = new Date(replayResult.disputeDeadline!).getTime();

    assert.strictEqual(replayedDeliveredAt, initialDeliveredAt, 'Duplicate callback must NOT mutate tenantNotifiedAt');
    assert.strictEqual(replayedDisputeDeadline, initialDisputeDeadline, 'Duplicate callback must NOT reset or extend disputeDeadline');

    // Verify DB row remains unchanged
    const [dbRow] = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.id, proposal.id));
    assert.strictEqual(new Date(dbRow.tenantNotifiedAt!).getTime(), initialDeliveredAt);
    assert.strictEqual(new Date(dbRow.disputeDeadline!).getTime(), initialDisputeDeadline);
  });

  // 22. Notification retry behavior does not create duplicate or contradictory state
  await t.test('22. Notification retry behavior does not create duplicate or contradictory state', async () => {
    // Test A: Retrying an already delivered deduction returns unchanged state
    const delivered = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 15000,
      category: 'KEY_REPLACEMENT',
      description: 'Retry on delivered proposal test',
      notifyTenant: true,
    }, ownerActor);

    assert.strictEqual(delivered.noticeDeliveryStatus, 'DELIVERED');
    const origDeadline = delivered.disputeDeadline;

    const retriedAlreadyDelivered = await securityDepositDeductionService.retryNoticeDelivery(delivered.id, ownerActor);
    assert.strictEqual(retriedAlreadyDelivered.noticeDeliveryStatus, 'DELIVERED');
    assert.strictEqual(
      new Date(retriedAlreadyDelivered.disputeDeadline!).getTime(),
      new Date(origDeadline!).getTime(),
      'Retrying already delivered notice must not alter deadline'
    );

    // Test B: Retrying a proposal without initial notice attempt dispatches cleanly
    const unnotified = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 14000,
      category: 'DAMAGE',
      description: 'Retry on unnotified proposal test',
    }, ownerActor);

    assert.strictEqual(unnotified.disputeDeadline, null);
    const retryDispatched = await securityDepositDeductionService.retryNoticeDelivery(unnotified.id, ownerActor);
    assert.strictEqual(retryDispatched.noticeDeliveryStatus, 'DELIVERED');
    assert.ok(retryDispatched.disputeDeadline, 'Retry must establish dispute deadline upon confirmed delivery');
  });

  // 23. Audit or persistence failure does not leave misleading notification/deadline state
  await t.test('23. Audit or persistence failure does not leave misleading notification/deadline state', async () => {
    const proposal = await securityDepositDeductionService.proposeDeduction({
      depositId: deposit1Id,
      leaseId: lease1Id,
      amount: 12000,
      category: 'OTHER',
      description: 'Audit rollback test during notice dispatch',
    }, ownerActor);

    assert.strictEqual(proposal.disputeDeadline, null);
    assert.strictEqual(proposal.tenantNotifiedAt, null);

    // Trigger dispatch with simulated audit failure
    await assert.rejects(
      async () => {
        await securityDepositDeductionService.dispatchDeductionNotice(proposal.id, ownerActor, {
          simulateAuditFailure: true,
        });
      },
      /SIMULATED_AUDIT_FAILURE/i
    );

    // Verify DB deduction state rolled back cleanly
    const [rolledBack] = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.id, proposal.id));
    assert.strictEqual(rolledBack.disputeDeadline, null, 'disputeDeadline must remain null after rollback');
    assert.strictEqual(rolledBack.tenantNotifiedAt, null, 'tenantNotifiedAt must remain null after rollback');
    assert.strictEqual(rolledBack.noticeDeliveryStatus, 'NOT_SENT', 'noticeDeliveryStatus must remain NOT_SENT after rollback');
  });

  // Teardown
  t.after(async () => {
    try {
      await db.delete(notificationDeliveries).where(
        sql`recipient_address IN (${tenantId}, ${otherTenantId}) OR notification_id IN (SELECT id FROM notifications WHERE recipient_user_id IN (${tenantId}, ${otherTenantId}))`
      );
      await db.delete(notifications).where(
        sql`recipient_user_id IN (${tenantId}, ${otherTenantId})`
      );
      await db.delete(auditLogs).where(
        sql`actor_user_id IN (${ownerId}, ${otherOwnerId}, ${managerUserId}, ${tenantId}, ${otherTenantId})`
      );
      await db.delete(securityDepositDeductions).where(
        sql`deposit_id IN (SELECT id FROM security_deposits WHERE property_id IN (${prop1Id}, ${prop2Id}))`
      );
      await db.delete(leaseMoveOutInspectionItems).where(
        sql`inspection_id IN (SELECT id FROM lease_move_out_inspections WHERE property_id IN (${prop1Id}, ${prop2Id}))`
      );
      await db.delete(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.propertyId, prop1Id));
      await db.delete(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.propertyId, prop2Id));
      await db.delete(moveOutRequests).where(eq(moveOutRequests.propertyId, prop1Id));
      await db.delete(moveOutRequests).where(eq(moveOutRequests.propertyId, prop2Id));
      await db.delete(securityDeposits).where(eq(securityDeposits.propertyId, prop1Id));
      await db.delete(securityDeposits).where(eq(securityDeposits.propertyId, prop2Id));
      await db.delete(leaseTenants).where(eq(leaseTenants.tenantId, tenantId));
      await db.delete(leaseTenants).where(eq(leaseTenants.tenantId, otherTenantId));
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
      await db.delete(users).where(eq(users.id, otherTenantId));
      await db.delete(users).where(eq(users.id, managerUserId));
    } catch (_) {}
  });
});
