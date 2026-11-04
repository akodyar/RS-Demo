import test from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, leaseRenewals, rentSchedules, ownershipRecords } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { ownerRepository } from '../src/server/repositories/owner.js';

dotenv.config({ override: false });

const TARGET_TEST_DATABASE = 'homehub_test';

function assertSafeDatabaseConfig(): void {
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    throw new Error(`SAFETY GATE: SQL_DB_NAME must be '${TARGET_TEST_DATABASE}'. Got: '${targetDb}'.`);
  }
}

test('Lease Renewal Lifecycle, Validation, IDOR & Rejection Verification Suite', async (t) => {
  assertSafeDatabaseConfig();

  const runId = `ren_val_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const ownerId = `owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const otherTenantId = `other_tenant_${runId}`;
  const otherOwnerId = `other_owner_${runId}`;
  const propertyId = `prop_${runId}`;

  const createdUserIds: string[] = [ownerId, tenantId, otherTenantId, otherOwnerId];
  const createdPropertyIds: string[] = [propertyId];
  const createdLeaseIds: string[] = [];
  const createdRenewalIds: string[] = [];

  async function cleanupFixtures() {
    for (const renId of createdRenewalIds) {
      await db.delete(leaseRenewals).where(eq(leaseRenewals.id, renId));
    }
    for (const lId of createdLeaseIds) {
      await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, lId));
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lId));
      await db.delete(leases).where(eq(leases.id, lId));
    }
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propertyId));
    for (const pId of createdPropertyIds) {
      await db.delete(properties).where(eq(properties.id, pId));
    }
    for (const uId of createdUserIds) {
      await db.delete(users).where(eq(users.id, uId));
    }
  }

  t.after(async () => {
    await cleanupFixtures();
  });

  // Setup initial users and property
  await db.insert(users).values([
    { id: ownerId, firstName: 'Owner', lastName: runId, email: `owner_${runId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: tenantId, firstName: 'Tenant', lastName: runId, email: `tenant_${runId}@test.com`, roles: ['TENANT'] },
    { id: otherTenantId, firstName: 'Other', lastName: 'Tenant', email: `other_${runId}@test.com`, roles: ['TENANT'] },
    { id: otherOwnerId, firstName: 'Other', lastName: 'Owner', email: `other_owner_${runId}@test.com`, roles: ['PROPERTY_OWNER'] },
  ]);

  await db.insert(properties).values({
    id: propertyId,
    name: `Test Residence ${runId}`,
    type: 'APARTMENT',
    address: { city: 'Erbil', street: 'Gulan 100' },
  });

  await db.insert(ownershipRecords).values({
    propertyId: propertyId,
    ownerId: ownerId,
    ownershipPercentage: '100.00',
    status: 'VERIFIED',
    verificationStatus: 'VERIFIED',
  });

  // Create an active lease
  const [activeLease] = await db.insert(leases).values({
    propertyId: propertyId,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    rentAmount: '1200000',
    currency: 'IQD',
    status: 'ACTIVE',
  }).returning();
  createdLeaseIds.push(activeLease.id);

  await db.insert(leaseTenants).values({
    leaseId: activeLease.id,
    tenantId: tenantId,
    isPrimary: true,
  });

  await t.test('1. Tenant cannot request renewal with invalid date order (endDate <= startDate)', async () => {
    await assert.rejects(
      async () => {
        await tenantRepository.requestLeaseRenewal(tenantId, {
          leaseId: activeLease.id,
          propertyId: propertyId,
          proposedStartDate: '2027-01-01',
          proposedEndDate: '2026-06-01', // End is before start!
        });
      },
      (err: any) => err.message.includes('Proposed end date must be strictly after proposed start date')
    );
  });

  await t.test('2. Unrelated tenant cannot request renewal on another tenant lease (IDOR Protection)', async () => {
    await assert.rejects(
      async () => {
        await tenantRepository.requestLeaseRenewal(otherTenantId, {
          leaseId: activeLease.id,
          propertyId: propertyId,
          proposedStartDate: '2027-01-01',
          proposedEndDate: '2027-12-31',
        });
      },
      (err: any) => err.message.includes('UNAUTHORIZED_LEASE_RENEWAL_ACCESS')
    );
  });

  await t.test('3. Tenant cannot request renewal on a non-ACTIVE lease', async () => {
    const [draftLease] = await db.insert(leases).values({
      propertyId: propertyId,
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2027-05-31T00:00:00.000Z',
      rentAmount: '1500000',
      currency: 'IQD',
      status: 'DRAFT',
    }).returning();
    createdLeaseIds.push(draftLease.id);

    await db.insert(leaseTenants).values({
      leaseId: draftLease.id,
      tenantId: tenantId,
      isPrimary: true,
    });

    await assert.rejects(
      async () => {
        await tenantRepository.requestLeaseRenewal(tenantId, {
          leaseId: draftLease.id,
          propertyId: propertyId,
          proposedStartDate: '2027-06-01',
          proposedEndDate: '2028-05-31',
        });
      },
      (err: any) => err.message.includes('Only ACTIVE leases may be renewed')
    );
  });

  let createdRenewalId = '';

  await t.test('4. Authorized tenant successfully submits lease renewal request', async () => {
    const renewal = await tenantRepository.requestLeaseRenewal(tenantId, {
      leaseId: activeLease.id,
      propertyId: propertyId,
      proposedStartDate: '2027-01-01',
      proposedEndDate: '2027-12-31',
      proposedRentAmount: 1300000,
      tenantNotes: 'Requesting 1-year extension with AC maintenance inclusion',
    });

    assert.ok(renewal?.id, 'Renewal request should be created');
    assert.strictEqual(renewal.status, 'REQUESTED');
    assert.strictEqual(renewal.tenantId, tenantId);
    assert.strictEqual(renewal.proposedRentAmount, '1300000');
    assert.strictEqual(renewal.currency, 'IQD');
    createdRenewalId = renewal.id;
    createdRenewalIds.push(renewal.id);
  });

  await t.test('5. Duplicate pending renewal prevention blocks repeated request submission', async () => {
    await assert.rejects(
      async () => {
        await tenantRepository.requestLeaseRenewal(tenantId, {
          leaseId: activeLease.id,
          propertyId: propertyId,
          proposedStartDate: '2027-01-01',
          proposedEndDate: '2027-12-31',
        });
      },
      (err: any) => err.message.includes('DUPLICATE_RENEWAL_REQUEST')
    );
  });

  await t.test('6. Scoped renewals query only surfaces renewals to authorized property owners', async () => {
    // Owner of the property should see the renewal
    const ownerRenewals = await ownerRepository.getScopedRenewals({ id: ownerId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(ownerRenewals.length, 1, 'Authorized owner should see the renewal request');
    assert.strictEqual(ownerRenewals[0].id, createdRenewalId);
    assert.strictEqual(ownerRenewals[0].propertyName, `Test Residence ${runId}`);
    assert.strictEqual(ownerRenewals[0].tenantName, `Tenant ${runId}`);
    assert.strictEqual(ownerRenewals[0].proposedRentAmount, 1300000);

    // Other owner (no authority over this property) should see zero renewals
    const otherOwnerRenewals = await ownerRepository.getScopedRenewals({ id: otherOwnerId, roles: ['PROPERTY_OWNER'] });
    assert.strictEqual(otherOwnerRenewals.length, 0, 'Unauthorized owner must see 0 renewal records');
  });

  await t.test('7. Owner formally rejects renewal request: status becomes REJECTED, terms unchanged', async () => {
    const rejectedRenewal = await leaseRepository.rejectRenewal(createdRenewalId, 'Rent amount proposed is below market index for 2027', {
      actorUserId: ownerId,
      actorRole: 'PROPERTY_OWNER',
      ipAddress: '127.0.0.1',
    });

    assert.strictEqual(rejectedRenewal.status, 'REJECTED');
    assert.strictEqual(rejectedRenewal.ownerNotes, 'Rent amount proposed is below market index for 2027');

    // Verify lease remains untouched
    const [leaseAfter] = await db.select().from(leases).where(eq(leases.id, activeLease.id));
    assert.strictEqual(leaseAfter.status, 'ACTIVE');
    assert.strictEqual(leaseAfter.endDate, '2026-12-31T00:00:00.000Z');
    assert.strictEqual(leaseAfter.rentAmount, '1200000');
  });

  await t.test('8. Rejection cannot be approved (Optimistic Concurrency Protection)', async () => {
    await assert.rejects(
      async () => {
        await leaseRepository.approveRenewal(createdRenewalId);
      },
      (err: any) => err.message.includes('Cannot approve renewal: renewal is not requested or not found')
    );
  });
});
