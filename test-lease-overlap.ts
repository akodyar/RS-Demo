import { db } from './src/db/index.js';
import { users, properties, leases, leaseTenants } from './src/db/schema.js';
import { LeaseRepository } from './src/server/repositories/leases.js';
import { eq } from 'drizzle-orm';

async function run() {
  const leaseRepo = new LeaseRepository();
  
  // 1. Create a dummy property
  const [prop] = await db.insert(properties).values({
    name: 'Single Family Home',
    type: 'SINGLE_FAMILY',
    status: 'PUBLISHED'
  }).returning();

  // 2. Create dummy tenants
  const [tenant1] = await db.insert(users).values({
    email: 'tenant1@example.com',
    firstName: 'T1',
    lastName: 'T1',
    role: 'TENANT'
  }).returning();
  
  const [tenant2] = await db.insert(users).values({
    email: 'tenant2@example.com',
    firstName: 'T2',
    lastName: 'T2',
    role: 'TENANT'
  }).returning();

  console.log('Created Property:', prop.id);
  
  // 3. Create Lease 1
  try {
    const lease1 = await leaseRepo.createLease(
      prop.id, 
      null, // unitId is null!
      [tenant1.id], 
      '2026-01-01T00:00:00.000Z', 
      '2026-12-31T00:00:00.000Z', 
      1000
    );
    console.log('Lease 1 created successfully:', lease1.id);

    // Make it ACTIVE so overlap check *would* trigger if it existed
    await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.id, lease1.id));
  } catch(e: any) {
    console.error('Failed to create Lease 1:', e.message);
  }

  // 4. Create Lease 2 (Overlapping!)
  try {
    const lease2 = await leaseRepo.createLease(
      prop.id, 
      null, // unitId is null!
      [tenant2.id], 
      '2026-06-01T00:00:00.000Z', 
      '2027-05-31T00:00:00.000Z', 
      1200
    );
    console.log('Lease 2 created successfully despite overlap! Defect confirmed.', lease2.id);
  } catch(e: any) {
    console.error('Failed to create Lease 2:', e.message);
  }

  process.exit(0);
}

run().catch(console.error);
