import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { leaseRepository } from '../src/server/repositories/leases.js';

test('Tenant Assignment Authorization Audit', async (t) => {
  await t.test('Owner creating a lease for a user without TENANT role', async () => {
    const ownerId = 'user-owner-audit-unique-2';
    const nonTenantId = 'user-nontenant-audit-unique-1';
    const propId = 'prop-audit-unique-3';
    
    await db.insert(users).values({ id: ownerId, firstName: 'O', lastName: 'U', email: 'o2@o.com', roles: ['PROPERTY_OWNER'] }).onConflictDoNothing();
    await db.insert(users).values({ id: nonTenantId, firstName: 'N', lastName: 'T', email: 'nt2@nt.com', roles: ['REGISTERED_USER'] }).onConflictDoNothing();
    
    await db.insert(properties).values({
      id: propId,
      name: 'Test Prop Unique',
      type: 'APARTMENT',
      address: {},
      status: 'ACTIVE'
    }).onConflictDoNothing();

    try {
        const lease = await leaseRepository.createLease(propId, null, [nonTenantId], '2030-01-01', '2031-01-01', 1000);
        
        // Let's also check if they can just activate it
        await leaseRepository.activateLease(lease.id);
        
        assert.fail('Should not allow assigning a non-tenant user to a lease or forcibly activating it');
    } catch (e: any) {
        assert.ok(
            e.message.includes('VALIDATION_ERROR') || e.message.includes('role') || e.message.includes('consent'), 
            `Expected validation error, got: ${e.message}`
        );
    }
  });
});
