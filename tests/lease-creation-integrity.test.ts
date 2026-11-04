import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../src/db/index';
import { users, properties, leases, leaseTenants, units, rentSchedules, rentalApplications } from '../src/db/schema';
import { LeaseRepository } from '../src/server/repositories/leases';
import { eq, count } from 'drizzle-orm';

process.env.SQL_HOST = 'localhost';

describe('Lease Creation Relationship Integrity', () => {
  let leaseRepo: LeaseRepository;
  let propA: any, propB: any, unitA1: any, unitA2: any, unitB: any;
  let tenant1: any, tenant2: any, tenant3: any, tenant4: any, tenant5: any;

  beforeAll(async () => {
    leaseRepo = new LeaseRepository();
    
    // Setup test data
    [propA] = await db.insert(properties).values({ name: 'Prop A', type: 'MULTI_UNIT', status: 'PUBLISHED' }).returning();
    [propB] = await db.insert(properties).values({ name: 'Prop B', type: 'MULTI_UNIT', status: 'PUBLISHED' }).returning();
    
    [unitA1] = await db.insert(units).values({ propertyId: propA.id, unitNumber: 'A1', status: 'VACANT' }).returning();
    [unitA2] = await db.insert(units).values({ propertyId: propA.id, unitNumber: 'A2', status: 'VACANT' }).returning();
    [unitB] = await db.insert(units).values({ propertyId: propB.id, unitNumber: 'B1', status: 'VACANT' }).returning();

    [tenant1] = await db.insert(users).values({ email: `t1_${Date.now()}@test.com`, firstName: 'T1', lastName: 'T1', roles: ['TENANT'] }).returning();
    [tenant2] = await db.insert(users).values({ email: `t2_${Date.now()}@test.com`, firstName: 'T2', lastName: 'T2', roles: ['TENANT'] }).returning();
    [tenant3] = await db.insert(users).values({ email: `t3_${Date.now()}@test.com`, firstName: 'T3', lastName: 'T3', roles: ['TENANT'] }).returning();
    [tenant4] = await db.insert(users).values({ email: `t4_${Date.now()}@test.com`, firstName: 'T4', lastName: 'T4', roles: ['TENANT'] }).returning();
    [tenant5] = await db.insert(users).values({ email: `t5_${Date.now()}@test.com`, firstName: 'T5', lastName: 'T5', roles: ['TENANT'] }).returning();

    // Seed approved rental applications for tenants on propA and propB
    await db.insert(rentalApplications).values([
      { applicantUserId: tenant1.id, propertyId: propA.id, status: 'APPROVED' },
      { applicantUserId: tenant1.id, propertyId: propB.id, status: 'APPROVED' },
      { applicantUserId: tenant2.id, propertyId: propA.id, status: 'APPROVED' },
      { applicantUserId: tenant2.id, propertyId: propB.id, status: 'APPROVED' },
      { applicantUserId: tenant3.id, propertyId: propA.id, status: 'APPROVED' },
      { applicantUserId: tenant4.id, propertyId: propA.id, status: 'APPROVED' },
      { applicantUserId: tenant5.id, propertyId: propA.id, status: 'APPROVED' },
    ]);
  });

  it('1. A unit belonging to another property is rejected', async () => {
    await expect(
      leaseRepo.createLease(propA.id, unitB.id, [tenant1.id], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000)
    ).rejects.toThrow(/VALIDATION_ERROR/i);
  });

  it('2. A nonexistent unit is rejected', async () => {
    await expect(
      leaseRepo.createLease(propA.id, '00000000-0000-0000-0000-000000000000', [tenant1.id], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000)
    ).rejects.toThrow(/VALIDATION_ERROR/i);
  });

  it('3. Overlapping leases are rejected for the same property when unitId is null', async () => {
    // Create first lease
    const lease1 = await leaseRepo.createLease(propA.id, null, [tenant1.id], '2027-01-01T00:00:00.000Z', '2027-12-31T00:00:00.000Z', 1000);
    await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.id, lease1.id));

    // Attempt overlapping lease
    await expect(
      leaseRepo.createLease(propA.id, null, [tenant2.id], '2027-06-01T00:00:00.000Z', '2028-05-31T00:00:00.000Z', 1200)
    ).rejects.toThrow(/overlaps/i);
  });

  it('4. Non-overlapping leases remain allowed', async () => {
    // Create lease AFTER the previous one ends
    const lease = await leaseRepo.createLease(propA.id, null, [tenant3.id], '2028-01-01T00:00:00.000Z', '2028-12-31T00:00:00.000Z', 1200);
    expect(lease).toHaveProperty('id');
  });

  it('5. Overlapping leases for the same unit remain rejected', async () => {
    const lease1 = await leaseRepo.createLease(propB.id, unitB.id, [tenant1.id], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.id, lease1.id));

    await expect(
      leaseRepo.createLease(propB.id, unitB.id, [tenant2.id], '2026-06-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z', 1200)
    ).rejects.toThrow(/overlaps/i);
  });

  it('6. Leases for distinct units remain allowed when the domain model permits them', async () => {
    const l1 = await leaseRepo.createLease(propA.id, unitA1.id, [tenant4.id], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.id, l1.id));

    const l2 = await leaseRepo.createLease(propA.id, unitA2.id, [tenant5.id], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1200);
    expect(l2).toHaveProperty('id');
  });

  it('7. Rejected lease creation leaves no lease or rent-schedule side effects', async () => {
    // Get count before
    const [{ leaseCountBefore }] = await db.select({ leaseCountBefore: count() }).from(leases);
    const [{ scheduleCountBefore }] = await db.select({ scheduleCountBefore: count() }).from(rentSchedules);

    await expect(
      leaseRepo.createLease(propB.id, unitA1.id, [tenant1.id], '2029-01-01T00:00:00.000Z', '2029-12-31T00:00:00.000Z', 1000)
    ).rejects.toThrow(/VALIDATION_ERROR/i);

    // Get count after
    const [{ leaseCountAfter }] = await db.select({ leaseCountAfter: count() }).from(leases);
    const [{ scheduleCountAfter }] = await db.select({ scheduleCountAfter: count() }).from(rentSchedules);

    expect(leaseCountAfter).toBe(leaseCountBefore);
    expect(scheduleCountAfter).toBe(scheduleCountBefore);
  });
});
