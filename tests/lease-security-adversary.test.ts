import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, rentSchedules, ownershipRecords } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';

test('Lease Security Adversarial Tests', async (t) => {
  // A-1 / A-2: We can test the route handlers by mocking req/res or using supertest.
  // Since we don't have the full supertest setup visible, let's test the SM-1 (tenant.ts) 
  // directly and verify A-1/A-2 route logic via direct mock request.

  await t.test('SM-1: acceptLeaseOffer rejects invalid states', async () => {
    // 1. Setup a dummy lease in ACTIVE state
    const ownerId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const propId = crypto.randomUUID();

    const [owner] = await db.insert(users).values({ id: ownerId, firstName: 'Owner', lastName: 'Adv', email: `o-${ownerId}@adv.com`, roles: ['PROPERTY_OWNER'] }).returning();
    const [tenant] = await db.insert(users).values({ id: tenantId, firstName: 'Tenant', lastName: 'Adv', email: `t-${tenantId}@adv.com`, roles: ['TENANT'] }).returning();
    const [prop] = await db.insert(properties).values({ id: propId, name: 'Adv Prop', type: 'LAND', address: {} }).returning();
    
    const [lease] = await db.insert(leases).values({
      propertyId: prop.id,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      rentAmount: '1000',
      status: 'ACTIVE' // Already active
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: lease.id,
      tenantId: tenant.id,
      isPrimary: true
    });

    try {
      await tenantRepository.acceptLeaseOffer(tenant.id, lease.id);
      assert.fail('Should have thrown an error for invalid state transition');
    } catch (e: any) {
      assert.ok(e.message.includes('Cannot activate lease from status: ACTIVE') || e.message.includes('Cannot accept lease'), `Unexpected error: ${e.message}`);
    }

    // Check terminal states
    await db.update(leases).set({ status: 'TERMINATED' }).where(eq(leases.id, lease.id));
    try {
      await tenantRepository.acceptLeaseOffer(tenant.id, lease.id);
      assert.fail('Should have thrown an error for invalid state transition');
    } catch (e: any) {
      assert.ok(e.message.includes('Cannot activate lease from status: TERMINATED') || e.message.includes('Cannot accept lease'));
    }
  });
});
