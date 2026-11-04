import { db } from './src/db/index.js';
import { users, properties, leases, leaseTenants, units } from './src/db/schema.js';
import { LeaseRepository } from './src/server/repositories/leases.js';

async function run() {
  const leaseRepo = new LeaseRepository();
  
  // 1. Create Property A
  const [propA] = await db.insert(properties).values({
    name: 'Property A',
    type: 'MULTI_UNIT',
    status: 'PUBLISHED'
  }).returning();

  // 2. Create Property B
  const [propB] = await db.insert(properties).values({
    name: 'Property B',
    type: 'MULTI_UNIT',
    status: 'PUBLISHED'
  }).returning();

  // 3. Create Unit in Property B
  const [unitB] = await db.insert(units).values({
    propertyId: propB.id,
    unitNumber: 'B1',
    status: 'VACANT'
  }).returning();

  // 4. Create dummy tenant
  const [tenant] = await db.insert(users).values({
    email: 'tenant_cross@example.com',
    firstName: 'T',
    lastName: 'C',
    role: 'TENANT'
  }).returning();

  console.log('Created Property A:', propA.id);
  console.log('Created Property B:', propB.id);
  console.log('Created Unit B (in Prop B):', unitB.id);
  
  // 5. Create Lease: Link Prop A to Unit B!
  try {
    const lease = await leaseRepo.createLease(
      propA.id, 
      unitB.id, // unit from B!
      [tenant.id], 
      '2026-01-01T00:00:00.000Z', 
      '2026-12-31T00:00:00.000Z', 
      1000
    );
    console.log('Lease created linking Prop A to Unit B! Defect confirmed.', lease.id);
  } catch(e: any) {
    console.error('Failed to create Lease:', e.message);
  }

  process.exit(0);
}

run().catch(console.error);
