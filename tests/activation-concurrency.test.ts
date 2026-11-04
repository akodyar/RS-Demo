import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, rentSchedules } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { leaseRepository } from '../src/server/repositories/leases.js';

test('Lease Activation Concurrency Tests', async (t) => {
  await t.test('Concurrent activateLease calls produce only 1 schedule set', async () => {
    // Setup
    const [owner] = await db.insert(users).values({ id: 'owner-conc-1', firstName: 'Owner', lastName: 'C', email: 'oc@c.com', roles: ['PROPERTY_OWNER'] }).onConflictDoNothing().returning();
    const [tenant] = await db.insert(users).values({ id: 'tenant-conc-1', firstName: 'Tenant', lastName: 'C', email: 'tc@c.com', roles: ['TENANT'] }).onConflictDoNothing().returning();
    const [prop] = await db.insert(properties).values({ name: 'Conc Prop', type: 'LAND', address: {} }).returning();
    
    const [lease] = await db.insert(leases).values({
      propertyId: prop.id,
      startDate: new Date('2026-01-01').toISOString(),
      endDate: new Date('2026-12-31').toISOString(),
      rentAmount: '1000',
      status: 'PENDING_SIGNATURE'
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: lease.id,
      tenantId: 'tenant-conc-1',
      isPrimary: true
    });

    // Simulate concurrency
    const promises = [
      leaseRepository.activateLease(lease.id),
      leaseRepository.activateLease(lease.id),
      leaseRepository.activateLease(lease.id)
    ];

    const results = await Promise.allSettled(promises);
    
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one activation should succeed');
    assert.strictEqual(rejected.length, 2, 'Other concurrent requests should fail gracefully');

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    assert.ok(schedules.length > 0, 'Schedules should be generated');
    assert.strictEqual(schedules.length, 12, 'Exactly 12 monthly schedules should be generated for 1 year');

    // No duplicate periodStart
    const periods = schedules.map(s => s.periodStart);
    const uniquePeriods = new Set(periods);
    assert.strictEqual(uniquePeriods.size, periods.length, 'No duplicate periods');
  });
  await t.test('Failed activation rolls back rent schedules', async () => {
    // 1. Seed a DRAFT lease
    const [prop2] = await db.insert(properties).values({ name: 'Rollback Prop', type: 'LAND', address: {} }).returning();
    const [lease2] = await db.insert(leases).values({
      propertyId: prop2.id,
      startDate: new Date('2026-01-01').toISOString(),
      endDate: new Date('2026-12-31').toISOString(),
      rentAmount: '1000',
      depositAmount: '500', 
      status: 'DRAFT'
    }).returning();
    
    // Pick an existing tenant from the previous test
    const tenantId = 'tenant-conc-1';
    await db.insert(leaseTenants).values({
      leaseId: lease2.id,
      tenantId: tenantId,
      isPrimary: true
    });
    
    // 2. Mock or deliberately fail the activation
    const originalGenerate = leaseRepository.generateRentSchedule;
    leaseRepository.generateRentSchedule = async function(tx, lId, pId, tId, uId, start, end, rent) {
      await originalGenerate.call(this, tx, lId, pId, tId, uId, start, end, rent);
      throw new Error('Simulated failure after schedule generation');
    };

    let activationFailed = false;
    try {
      await leaseRepository.activateLease(lease2.id);
    } catch (e) {
      activationFailed = true;
    }
    
    // Restore
    leaseRepository.generateRentSchedule = originalGenerate;
    
    assert.ok(activationFailed, 'Activation should fail due to simulated rollback');
    
    // 3. Verify rollback cleaned up rentSchedules
    const orphanedSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease2.id));
    assert.strictEqual(orphanedSchedules.length, 0, `Expected 0 rent schedules after failed activation, got ${orphanedSchedules.length}`);
  });
});
