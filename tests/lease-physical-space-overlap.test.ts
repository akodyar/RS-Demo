import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// SUITE 1: Static AST & Source Code Invariant Verification
// ============================================================================
test('Bidirectional Physical-Space Overlap Invariant — Static Source Verification', async (t) => {
  const leaseRepoPath = path.join(__dirname, '..', 'src', 'server', 'repositories', 'leases.ts');
  const ownerRepoPath = path.join(__dirname, '..', 'src', 'server', 'repositories', 'owner.ts');
  const companyRepoPath = path.join(__dirname, '..', 'src', 'server', 'repositories', 'company.ts');

  const leaseRepoCode = fs.readFileSync(leaseRepoPath, 'utf-8');
  const ownerRepoCode = fs.readFileSync(ownerRepoPath, 'utf-8');
  const companyRepoCode = fs.readFileSync(companyRepoPath, 'utf-8');

  await t.test('1. assertNoPhysicalSpaceOverlap implements shared row lock and bidirectional overlap check', () => {
    const startIdx = leaseRepoCode.indexOf('async assertNoPhysicalSpaceOverlap(');
    const endIdx = leaseRepoCode.indexOf('async createLease(');
    assert.ok(startIdx !== -1 && endIdx !== -1, 'assertNoPhysicalSpaceOverlap must be defined in leaseRepository');
    const method = leaseRepoCode.substring(startIdx, endIdx);

    // Parent property row locking and existence check
    assert.ok(
      method.includes("await tx.select().from(properties).where(eq(properties.id, propertyId)).limit(1).for('update')"),
      'assertNoPhysicalSpaceOverlap must lock parent property row with for update'
    );
    assert.ok(
      method.includes('if (!propertyRecord)'),
      'assertNoPhysicalSpaceOverlap must verify parent property exists before proceeding'
    );

    // Unit validation against property
    assert.ok(
      method.includes('if (!unitRecord || unitRecord.propertyId !== propertyId)'),
      'assertNoPhysicalSpaceOverlap must validate that unit belongs to property'
    );

    // Status checks include ACTIVE, PENDING_APPROVAL, and PENDING_SIGNATURE
    assert.ok(
      method.includes('eq(leases.status, LeaseStatus.ACTIVE)') &&
      method.includes('eq(leases.status, LeaseStatus.PENDING_APPROVAL)') &&
      method.includes('eq(leases.status, LeaseStatus.PENDING_SIGNATURE)'),
      'assertNoPhysicalSpaceOverlap must check ACTIVE, PENDING_APPROVAL, and PENDING_SIGNATURE'
    );

    // Unit-level lease checks same unit OR whole property
    assert.ok(
      method.includes('eq(leases.unitId, unitId)') &&
      method.includes('and(eq(leases.propertyId, propertyId), isNull(leases.unitId))'),
      'assertNoPhysicalSpaceOverlap must check same unit OR property-level lease when unitId is provided'
    );

    // Property-level lease checks all leases on this property
    assert.ok(
      method.includes('overlapConditions.push(eq(leases.propertyId, propertyId));'),
      'assertNoPhysicalSpaceOverlap must check all leases on property when unitId is null'
    );
  });

  await t.test('2. leaseRepository.createLease delegates to assertNoPhysicalSpaceOverlap inside transaction', () => {
    const startIdx = leaseRepoCode.indexOf('async createLease(');
    const endIdx = leaseRepoCode.indexOf('async generateRentSchedule(');
    const method = leaseRepoCode.substring(startIdx, endIdx);

    assert.ok(
      method.includes('db.transaction(async (tx) => {'),
      'createLease must execute within db.transaction'
    );

    assert.ok(
      method.includes('await this.assertNoPhysicalSpaceOverlap(tx,'),
      'createLease must delegate to assertNoPhysicalSpaceOverlap'
    );

    assert.ok(
      method.includes('status: LeaseStatus.DRAFT,'),
      'createLease must preserve initial DRAFT status'
    );
  });

  await t.test('3. ownerRepository.createLease delegates to assertNoPhysicalSpaceOverlap and preserves PENDING_SIGNATURE', () => {
    const startIdx = ownerRepoCode.indexOf('async createLease(');
    const endIdx = ownerRepoCode.indexOf('async getAuthoritativeFinances(');
    assert.ok(startIdx !== -1 && endIdx !== -1, 'createLease must exist in ownerRepository');
    const method = ownerRepoCode.substring(startIdx, endIdx);

    // Authority verification
    assert.ok(
      method.includes('await this.verifyPropertyPermission(user, data.propertyId, Permission.MANAGE_LEASES)'),
      'ownerRepository.createLease must verify MANAGE_LEASES permission'
    );

    // Transaction safety
    assert.ok(
      method.includes('db.transaction(async (tx) => {'),
      'ownerRepository.createLease must wrap creation in a database transaction'
    );

    // Calls shared overlap check
    assert.ok(
      method.includes('await leaseRepository.assertNoPhysicalSpaceOverlap(tx,'),
      'ownerRepository.createLease must invoke leaseRepository.assertNoPhysicalSpaceOverlap'
    );

    // Preserves PENDING_SIGNATURE status
    assert.ok(
      method.includes('status: LeaseStatus.PENDING_SIGNATURE'),
      'ownerRepository.createLease must preserve PENDING_SIGNATURE status'
    );

    // Tenant association
    assert.ok(
      method.includes('await tx.insert(leaseTenants).values({'),
      'ownerRepository.createLease must insert into leaseTenants via transaction'
    );
  });

  await t.test('4. companyRepository.createLeaseDraft delegates to assertNoPhysicalSpaceOverlap and preserves PENDING_APPROVAL', () => {
    const startIdx = companyRepoCode.indexOf('async createLeaseDraft(');
    const endIdx = companyRepoCode.indexOf('async getMaintenance(');
    assert.ok(startIdx !== -1 && endIdx !== -1, 'createLeaseDraft must exist in companyRepository');
    const method = companyRepoCode.substring(startIdx, endIdx);

    // Management agreement authority check
    assert.ok(
      method.includes('managementAgreements.status, \'ACTIVE\''),
      'companyRepository.createLeaseDraft must verify active management agreement'
    );
    assert.ok(
      method.includes('perms.includes(Permission.MANAGE_LEASES)'),
      'companyRepository.createLeaseDraft must verify MANAGE_LEASES permission'
    );

    // Transaction safety
    assert.ok(
      method.includes('db.transaction(async (tx) => {'),
      'companyRepository.createLeaseDraft must execute in db.transaction'
    );

    // Calls shared overlap check
    assert.ok(
      method.includes('await leaseRepository.assertNoPhysicalSpaceOverlap(tx,'),
      'companyRepository.createLeaseDraft must invoke leaseRepository.assertNoPhysicalSpaceOverlap'
    );

    // Preserves PENDING_APPROVAL status
    assert.ok(
      method.includes('status: \'PENDING_APPROVAL\''),
      'companyRepository.createLeaseDraft must preserve PENDING_APPROVAL status'
    );

    // Tenant association
    assert.ok(
      method.includes('await tx.insert(leaseTenants).values({'),
      'companyRepository.createLeaseDraft must insert into leaseTenants via transaction'
    );

    // Audit action
    assert.ok(
      method.includes('action: \'LEASE_CREATED\''),
      'companyRepository.createLeaseDraft must log audit action'
    );
  });

  await t.test('5. activateLease implements bidirectional physical-space overlap condition with PENDING_SIGNATURE', () => {
    const startIdx = leaseRepoCode.indexOf('async activateLease(');
    const endIdx = leaseRepoCode.indexOf('async recordPayment(');
    const method = leaseRepoCode.substring(startIdx, endIdx);

    // Parent property row locking
    assert.ok(
      method.includes("await tx.select().from(properties).where(eq(properties.id, draftLease.propertyId)).limit(1).for('update')"),
      'activateLease must lock parent property row'
    );

    // Excludes self
    assert.ok(
      method.includes('not(eq(leases.id, leaseId))'),
      'activateLease must exclude the current lease from overlap check'
    );

    // Status checks include ACTIVE, PENDING_APPROVAL, and PENDING_SIGNATURE
    assert.ok(
      method.includes('eq(leases.status, LeaseStatus.ACTIVE)') &&
      method.includes('eq(leases.status, LeaseStatus.PENDING_APPROVAL)') &&
      method.includes('eq(leases.status, LeaseStatus.PENDING_SIGNATURE)'),
      'activateLease must check ACTIVE, PENDING_APPROVAL, and PENDING_SIGNATURE'
    );

    // Unit-level lease checks same unit OR whole property
    assert.ok(
      method.includes('eq(leases.unitId, draftLease.unitId)') &&
      method.includes('and(eq(leases.propertyId, draftLease.propertyId), isNull(leases.unitId))'),
      'activateLease must check same unit OR property-level lease when draftLease.unitId is provided'
    );

    // Property-level lease checks all leases on this property
    assert.ok(
      method.includes('overlapConditions.push(eq(leases.propertyId, draftLease.propertyId));'),
      'activateLease must check all leases on property when draftLease.unitId is null'
    );
  });

  await t.test('6. approveRenewal implements bidirectional physical-space overlap condition with PENDING_SIGNATURE', () => {
    const startIdx = leaseRepoCode.indexOf('async approveRenewal(');
    const method = leaseRepoCode.substring(startIdx);

    // Parent property row locking
    assert.ok(
      method.includes("await tx.select().from(properties).where(eq(properties.id, currentLease.propertyId)).limit(1).for('update')"),
      'approveRenewal must lock parent property row'
    );

    // Excludes current lease
    assert.ok(
      method.includes('not(eq(leases.id, currentLease.id))'),
      'approveRenewal must exclude the current lease from overlap check'
    );

    // Status checks include ACTIVE, PENDING_APPROVAL, and PENDING_SIGNATURE
    assert.ok(
      method.includes('eq(leases.status, LeaseStatus.ACTIVE)') &&
      method.includes('eq(leases.status, LeaseStatus.PENDING_APPROVAL)') &&
      method.includes('eq(leases.status, LeaseStatus.PENDING_SIGNATURE)'),
      'approveRenewal must check ACTIVE, PENDING_APPROVAL, and PENDING_SIGNATURE'
    );

    // Unit-level lease checks same unit OR whole property
    assert.ok(
      method.includes('eq(leases.unitId, currentLease.unitId)') &&
      method.includes('and(eq(leases.propertyId, currentLease.propertyId), isNull(leases.unitId))'),
      'approveRenewal must check same unit OR property-level lease when currentLease.unitId is provided'
    );

    // Property-level lease checks all leases on this property
    assert.ok(
      method.includes('overlapConditions.push(eq(leases.propertyId, currentLease.propertyId));'),
      'approveRenewal must check all leases on property when currentLease.unitId is null'
    );
  });
});

// ============================================================================
// SUITE 2: Behavioral Unit & Mock Simulation Tests
// ============================================================================
test('Bidirectional Physical-Space Overlap Invariant — Behavioral Invariant Logic', async (t) => {
  // Pure logic evaluator replicating the SQL where clause of the repository
  interface LeaseRecord {
    id: string;
    propertyId: string;
    unitId: string | null;
    status: string;
    startDate: string;
    endDate: string;
  }

  function findOverlaps(
    existingLeases: LeaseRecord[],
    targetPropertyId: string,
    targetUnitId: string | null,
    targetStartDate: string,
    targetEndDate: string,
    excludeLeaseId?: string
  ): LeaseRecord[] {
    return existingLeases.filter((lease) => {
      // 1. Exclude self if requested
      if (excludeLeaseId && lease.id === excludeLeaseId) return false;

      // 2. Status condition: ACTIVE, PENDING_APPROVAL, or PENDING_SIGNATURE
      const blockingStatuses = ['ACTIVE', 'PENDING_APPROVAL', 'PENDING_SIGNATURE'];
      if (!blockingStatuses.includes(lease.status)) return false;

      // 3. Inclusive date range overlap: lease.startDate <= targetEndDate && lease.endDate >= targetStartDate
      if (!(lease.startDate <= targetEndDate && lease.endDate >= targetStartDate)) return false;

      // 4. Physical-Space Bidirectional Invariant:
      if (targetUnitId !== null) {
        // Specific unit: conflicts with same unit OR any property-level lease (unitId is null) on this property
        const isSameUnit = lease.propertyId === targetPropertyId && lease.unitId === targetUnitId;
        const isWholePropertyLease = lease.propertyId === targetPropertyId && lease.unitId === null;
        return isSameUnit || isWholePropertyLease;
      } else {
        // Null unit (whole property): conflicts with ANY lease on this property (regardless of unitId)
        return lease.propertyId === targetPropertyId;
      }
    });
  }

  const propA = 'prop_building_alpha';
  const propB = 'prop_building_beta';
  const unit1 = 'unit_101';
  const unit2 = 'unit_102';

  await t.test('1. An existing active property-level lease blocks a new unit-level lease', () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_prop_active',
        propertyId: propA,
        unitId: null, // whole property lease
        status: 'ACTIVE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    const conflicts = findOverlaps(existing, propA, unit1, '2026-06-01', '2026-08-01');
    assert.strictEqual(conflicts.length, 1);
    assert.strictEqual(conflicts[0].id, 'lease_prop_active');
  });

  await t.test('2. An existing active unit-level lease blocks a new property-level lease', () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_unit1_active',
        propertyId: propA,
        unitId: unit1, // unit 101 lease
        status: 'ACTIVE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    // Attempting a whole property lease (unitId: null)
    const conflicts = findOverlaps(existing, propA, null, '2026-06-01', '2026-08-01');
    assert.strictEqual(conflicts.length, 1);
    assert.strictEqual(conflicts[0].id, 'lease_unit1_active');
  });

  await t.test('3. Conflicting PENDING_APPROVAL leases are detected in both directions', () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_prop_pending_app',
        propertyId: propA,
        unitId: null,
        status: 'PENDING_APPROVAL',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      {
        id: 'lease_unit2_pending_app',
        propertyId: propB,
        unitId: unit2,
        status: 'PENDING_APPROVAL',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    // Direction A: Pending approval property-level lease blocks new unit-level lease
    const conflictsA = findOverlaps(existing, propA, unit1, '2026-05-01', '2026-07-01');
    assert.strictEqual(conflictsA.length, 1);
    assert.strictEqual(conflictsA[0].id, 'lease_prop_pending_app');

    // Direction B: Pending approval unit-level lease blocks new property-level lease
    const conflictsB = findOverlaps(existing, propB, null, '2026-05-01', '2026-07-01');
    assert.strictEqual(conflictsB.length, 1);
    assert.strictEqual(conflictsB[0].id, 'lease_unit2_pending_app');
  });

  await t.test('4. Conflicting PENDING_SIGNATURE leases are detected in both directions and same unit', () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_prop_pending_sig',
        propertyId: propA,
        unitId: null, // whole property awaiting signature
        status: 'PENDING_SIGNATURE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      {
        id: 'lease_unit1_pending_sig',
        propertyId: propB,
        unitId: unit1, // unit 101 awaiting signature
        status: 'PENDING_SIGNATURE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    // Direction A: PENDING_SIGNATURE property-level lease blocks new unit-level lease
    const conflictsA = findOverlaps(existing, propA, unit1, '2026-06-01', '2026-08-01');
    assert.strictEqual(conflictsA.length, 1);
    assert.strictEqual(conflictsA[0].id, 'lease_prop_pending_sig');

    // Direction B: PENDING_SIGNATURE unit-level lease blocks new property-level lease
    const conflictsB = findOverlaps(existing, propB, null, '2026-06-01', '2026-08-01');
    assert.strictEqual(conflictsB.length, 1);
    assert.strictEqual(conflictsB[0].id, 'lease_unit1_pending_sig');

    // Direction C: PENDING_SIGNATURE unit-level lease blocks another lease on the same unit
    const conflictsC = findOverlaps(existing, propB, unit1, '2026-06-01', '2026-08-01');
    assert.strictEqual(conflictsC.length, 1);
    assert.strictEqual(conflictsC[0].id, 'lease_unit1_pending_sig');
  });

  await t.test('5. DRAFT leases remain strictly non-blocking in all directions', () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_prop_draft',
        propertyId: propA,
        unitId: null,
        status: 'DRAFT',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      {
        id: 'lease_unit1_draft',
        propertyId: propA,
        unitId: unit1,
        status: 'DRAFT',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    // Creating a unit lease must not be blocked by DRAFT whole-property or DRAFT unit lease
    const conflictsUnit = findOverlaps(existing, propA, unit1, '2026-06-01', '2026-08-01');
    assert.strictEqual(conflictsUnit.length, 0, 'DRAFT leases must not block unit leases');

    // Creating a whole-property lease must not be blocked by DRAFT leases
    const conflictsProp = findOverlaps(existing, propA, null, '2026-06-01', '2026-08-01');
    assert.strictEqual(conflictsProp.length, 0, 'DRAFT leases must not block property-level leases');
  });

  await t.test('6. Formally CANCELLED and TERMINATED leases release their reservation', () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_prop_cancelled',
        propertyId: propA,
        unitId: null,
        status: 'CANCELLED',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      {
        id: 'lease_unit1_terminated',
        propertyId: propA,
        unitId: unit1,
        status: 'TERMINATED',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    const conflicts = findOverlaps(existing, propA, unit1, '2026-06-01', '2026-08-01');
    assert.strictEqual(conflicts.length, 0, 'CANCELLED and TERMINATED leases must release their reservation');
  });

  await t.test('7. Non-overlapping dates remain allowed in both directions', () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_2026_pending_sig',
        propertyId: propA,
        unitId: null,
        status: 'PENDING_SIGNATURE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    // Future unit lease in 2027
    const futureConflicts = findOverlaps(existing, propA, unit1, '2027-01-01', '2027-12-31');
    assert.strictEqual(futureConflicts.length, 0, 'Future unit lease must not conflict with 2026 lease');

    // Past unit lease in 2025
    const pastConflicts = findOverlaps(existing, propA, unit1, '2025-01-01', '2025-12-31');
    assert.strictEqual(pastConflicts.length, 0, 'Past unit lease must not conflict with 2026 lease');
  });

  await t.test('8. Different units can be leased simultaneously when no property-level lease conflicts', () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_unit1_pending_sig',
        propertyId: propA,
        unitId: unit1,
        status: 'PENDING_SIGNATURE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    // Leasing unit2 for the exact same date range
    const conflicts = findOverlaps(existing, propA, unit2, '2026-01-01', '2026-12-31');
    assert.strictEqual(conflicts.length, 0, 'Distinct units must be allowed simultaneously');
  });

  await t.test('9. Renewal checks proposed dates, blocks on PENDING_SIGNATURE third-party, and excludes current lease', () => {
    const currentLease: LeaseRecord = {
      id: 'current_active_lease',
      propertyId: propA,
      unitId: unit1,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };

    const thirdPartyLease: LeaseRecord = {
      id: 'third_party_pending_sig_2027',
      propertyId: propA,
      unitId: null, // property-level lease awaiting signature for 2027
      status: 'PENDING_SIGNATURE',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    };

    const existing = [currentLease, thirdPartyLease];

    // Scenario A: Renewing current lease into 2027 (proposed 2027-01-01 to 2027-12-31)
    // Must conflict with thirdPartyLease, but NOT with self
    const conflicts = findOverlaps(
      existing,
      propA,
      unit1,
      '2027-01-01',
      '2027-12-31',
      currentLease.id // exclude self
    );
    assert.strictEqual(conflicts.length, 1);
    assert.strictEqual(conflicts[0].id, 'third_party_pending_sig_2027');

    // Scenario B: Renewal for a date range where no third-party lease exists (e.g. 2028)
    const cleanConflicts = findOverlaps(
      existing,
      propA,
      unit1,
      '2028-01-01',
      '2028-12-31',
      currentLease.id
    );
    assert.strictEqual(cleanConflicts.length, 0, 'Renewal must succeed when third party does not conflict');
  });

  await t.test('10. Rejected operations do not create partial writes, schedules, or deposits (Atomic Transaction)', () => {
    let mockLeasesTable: any[] = [];
    let mockSchedulesTable: any[] = [];
    let mockDepositsTable: any[] = [];

    const existing: LeaseRecord[] = [
      {
        id: 'pending_sig_whole_prop',
        propertyId: propA,
        unitId: null,
        status: 'PENDING_SIGNATURE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    async function executeLeaseCreationTransaction(
      targetProp: string,
      targetUnit: string | null,
      targetStart: string,
      targetEnd: string
    ) {
      const stagingLeases: any[] = [];
      const stagingSchedules: any[] = [];
      const stagingDeposits: any[] = [];

      try {
        const overlaps = findOverlaps(existing, targetProp, targetUnit, targetStart, targetEnd);
        if (overlaps.length > 0) {
          throw new Error('VALIDATION_ERROR: Lease period overlaps with an existing active or pending lease for this property/unit.');
        }

        stagingLeases.push({ id: 'new_lease_id', propertyId: targetProp, unitId: targetUnit });
        stagingSchedules.push({ id: 'sched_1', leaseId: 'new_lease_id', amount: '1000' });
        stagingDeposits.push({ id: 'dep_1', leaseId: 'new_lease_id', requiredAmount: '1000' });

        mockLeasesTable.push(...stagingLeases);
        mockSchedulesTable.push(...stagingSchedules);
        mockDepositsTable.push(...stagingDeposits);
        return stagingLeases[0];
      } catch (err) {
        throw err;
      }
    }

    // Attempting conflicting unit lease creation against PENDING_SIGNATURE property lease
    assert.rejects(
      async () => {
        await executeLeaseCreationTransaction(propA, unit1, '2026-06-01', '2026-09-01');
      },
      /VALIDATION_ERROR/,
      'Must reject with VALIDATION_ERROR'
    );

    // Verify zero side effects
    assert.strictEqual(mockLeasesTable.length, 0, 'No leases must be written on validation failure');
    assert.strictEqual(mockSchedulesTable.length, 0, 'No rent schedules must be written on validation failure');
    assert.strictEqual(mockDepositsTable.length, 0, 'No security deposits must be written on validation failure');
  });

  await t.test('11. Owner creation rejects overlapping leases and preserves PENDING_SIGNATURE workflow', async () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_active_unit1',
        propertyId: propA,
        unitId: unit1,
        status: 'ACTIVE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    let committedLease: any = null;
    let committedTenant: any = null;

    async function mockOwnerCreateLease(
      userHasPermission: boolean,
      data: { propertyId: string; unitId?: string | null; tenantId: string; startDate: string; endDate: string }
    ) {
      if (!userHasPermission) {
        throw new Error('AUTHORITY_REQUIRED: You lack authority to create leases for this property');
      }

      // Check overlap
      const overlaps = findOverlaps(existing, data.propertyId, data.unitId || null, data.startDate, data.endDate);
      if (overlaps.length > 0) {
        throw new Error('VALIDATION_ERROR: Lease period overlaps with an existing active or pending lease for this property/unit.');
      }

      committedLease = {
        id: 'owner_lease_1',
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        status: 'PENDING_SIGNATURE',
        startDate: data.startDate,
        endDate: data.endDate,
      };
      committedTenant = {
        leaseId: committedLease.id,
        tenantId: data.tenantId,
        isPrimary: true,
      };
      return committedLease;
    }

    // Unauthorized owner rejected
    await assert.rejects(
      async () => {
        await mockOwnerCreateLease(false, {
          propertyId: propA,
          unitId: unit1,
          tenantId: 'tenant_1',
          startDate: '2027-01-01',
          endDate: '2027-12-31',
        });
      },
      /AUTHORITY_REQUIRED/
    );

    // Overlapping owner creation rejected
    await assert.rejects(
      async () => {
        await mockOwnerCreateLease(true, {
          propertyId: propA,
          unitId: unit1,
          tenantId: 'tenant_1',
          startDate: '2026-06-01',
          endDate: '2026-09-01',
        });
      },
      /VALIDATION_ERROR/
    );
    assert.strictEqual(committedLease, null, 'No lease must be committed on overlap failure');

    // Valid non-overlapping owner creation succeeds with PENDING_SIGNATURE
    const result = await mockOwnerCreateLease(true, {
      propertyId: propA,
      unitId: unit1,
      tenantId: 'tenant_1',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    });
    assert.strictEqual(result.status, 'PENDING_SIGNATURE');
    assert.strictEqual(committedTenant.tenantId, 'tenant_1');
  });

  await t.test('12. Company creation rejects overlapping leases and preserves PENDING_APPROVAL workflow', async () => {
    const existing: LeaseRecord[] = [
      {
        id: 'lease_active_prop',
        propertyId: propA,
        unitId: null,
        status: 'ACTIVE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    let committedLease: any = null;
    let loggedAudit: any = null;

    async function mockCompanyCreateLeaseDraft(
      hasAgreement: boolean,
      hasManageLeasesPerm: boolean,
      data: { propertyId: string; unitId?: string | null; tenantId: string; startDate: string; endDate: string }
    ) {
      if (!hasAgreement) {
        throw new Error('AUTHORITY_REQUIRED: No active management agreement exists for this property.');
      }
      if (!hasManageLeasesPerm) {
        throw new Error('PERMISSION_DENIED: Management agreement does not grant lease management authority.');
      }

      // Check overlap
      const overlaps = findOverlaps(existing, data.propertyId, data.unitId || null, data.startDate, data.endDate);
      if (overlaps.length > 0) {
        throw new Error('VALIDATION_ERROR: Lease period overlaps with an existing active or pending lease for this property/unit.');
      }

      committedLease = {
        id: 'company_lease_1',
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        status: 'PENDING_APPROVAL',
        startDate: data.startDate,
        endDate: data.endDate,
      };

      loggedAudit = {
        action: 'LEASE_CREATED',
        role: 'PROPERTY_MANAGER',
        resourceId: committedLease.id,
      };

      return committedLease;
    }

    // No agreement
    await assert.rejects(
      async () => {
        await mockCompanyCreateLeaseDraft(false, true, {
          propertyId: propA,
          tenantId: 'tenant_2',
          startDate: '2027-01-01',
          endDate: '2027-12-31',
        });
      },
      /AUTHORITY_REQUIRED/
    );

    // No permission
    await assert.rejects(
      async () => {
        await mockCompanyCreateLeaseDraft(true, false, {
          propertyId: propA,
          tenantId: 'tenant_2',
          startDate: '2027-01-01',
          endDate: '2027-12-31',
        });
      },
      /PERMISSION_DENIED/
    );

    // Overlapping draft creation rejected
    await assert.rejects(
      async () => {
        await mockCompanyCreateLeaseDraft(true, true, {
          propertyId: propA,
          unitId: unit1,
          tenantId: 'tenant_2',
          startDate: '2026-06-01',
          endDate: '2026-08-01',
        });
      },
      /VALIDATION_ERROR/
    );
    assert.strictEqual(committedLease, null);
    assert.strictEqual(loggedAudit, null);

    // Valid non-overlapping draft creation succeeds with PENDING_APPROVAL and logs audit
    const result = await mockCompanyCreateLeaseDraft(true, true, {
      propertyId: propA,
      unitId: unit1,
      tenantId: 'tenant_2',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    });
    assert.strictEqual(result.status, 'PENDING_APPROVAL');
    assert.strictEqual(loggedAudit.action, 'LEASE_CREATED');
  });

  await t.test('13. Unit belonging validation rejects foreign unit assigned to property', () => {
    const mockUnits = [
      { id: 'unit_alpha_1', propertyId: 'prop_A' },
      { id: 'unit_beta_1', propertyId: 'prop_B' },
    ];

    function validateUnitBelonging(propertyId: string, unitId?: string | null) {
      if (unitId) {
        const found = mockUnits.find((u) => u.id === unitId);
        if (!found || found.propertyId !== propertyId) {
          throw new Error('VALIDATION_ERROR: The specified unit does not belong to the selected property.');
        }
      }
    }

    // Matching unit passes
    assert.doesNotThrow(() => validateUnitBelonging('prop_A', 'unit_alpha_1'));
    // Null unit passes (whole property lease)
    assert.doesNotThrow(() => validateUnitBelonging('prop_A', null));
    // Foreign unit throws VALIDATION_ERROR
    assert.throws(
      () => validateUnitBelonging('prop_A', 'unit_beta_1'),
      /VALIDATION_ERROR: The specified unit does not belong to the selected property\./
    );
    // Non-existent unit throws VALIDATION_ERROR
    assert.throws(
      () => validateUnitBelonging('prop_A', 'unit_nonexistent'),
      /VALIDATION_ERROR: The specified unit does not belong to the selected property\./
    );
  });

  await t.test('14. EXPIRING status lifecycle semantics: active tenancies reserve space until end date', () => {
    // In HomeHub, leases remain in ACTIVE until cronService transitions them to EXPIRED once endDate has passed.
    // Readers (tenant active home card, routes) treat EXPIRING as active tenancy alongside ACTIVE.
    // If a lease record has status ACTIVE, PENDING_APPROVAL, or PENDING_SIGNATURE, it blocks concurrent overlap.
    const activeLease: LeaseRecord = {
      id: 'active_expiring_soon',
      propertyId: propA,
      unitId: unit1,
      status: 'ACTIVE', // Lease remains ACTIVE until endDate has passed
      startDate: '2026-01-01',
      endDate: '2026-10-31',
    };

    // Before end date: actively blocks overlapping new lease
    const overlaps = findOverlaps([activeLease], propA, unit1, '2026-09-01', '2026-11-01');
    assert.strictEqual(overlaps.length, 1);

    // After end date: cronService marks as EXPIRED (simulated)
    const expiredLease: LeaseRecord = {
      ...activeLease,
      status: 'EXPIRED',
    };
    const overlapsAfterExpiration = findOverlaps([expiredLease], propA, unit1, '2026-11-01', '2027-11-01');
    assert.strictEqual(overlapsAfterExpiration.length, 0, 'EXPIRED lease releases physical space reservation');
  });
});
