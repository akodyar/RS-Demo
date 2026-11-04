import { db } from './src/db/index.js';
import { rentSchedules, leases, properties, users } from './src/db/schema.js';
import crypto from 'node:crypto';

async function runTest() {
  try {
    const ownerId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const propId = crypto.randomUUID();
    const leaseId = crypto.randomUUID();

    await db.insert(users).values([
      { id: ownerId, firstName: 'O', lastName: 'A', email: `o${ownerId}@test.com` },
      { id: tenantId, firstName: 'T', lastName: 'A', email: `t${tenantId}@test.com` }
    ]);
    
    await db.insert(properties).values({ id: propId, name: 'Test Prop', type: 'LAND', address: {} });
    
    await db.insert(leases).values({
      id: leaseId,
      propertyId: propId,
      startDate: new Date('2026-01-01').toISOString(),
      endDate: new Date('2026-12-31').toISOString(),
      rentAmount: '1000',
      status: 'ACTIVE'
    });

    // 1. Insert valid rent schedule
    await db.insert(rentSchedules).values({
      leaseId: leaseId,
      propertyId: propId,
      tenantId: tenantId,
      amount: '1000',
      dueDate: new Date('2026-01-01').toISOString(),
      periodStart: new Date('2026-01-01').toISOString(),
      periodEnd: new Date('2026-01-31').toISOString(),
      status: 'UPCOMING'
    });

    console.log("Inserted first rent schedule.");

    // 2. Attempt duplicate insert
    try {
      await db.insert(rentSchedules).values({
        leaseId: leaseId,
        propertyId: propId,
        tenantId: tenantId,
        amount: '1000',
        dueDate: new Date('2026-02-01').toISOString(), // different due date
        periodStart: new Date('2026-01-01').toISOString(), // SAME periodStart
        periodEnd: new Date('2026-02-28').toISOString(),
        status: 'UPCOMING'
      });
      console.error("FAIL: Duplicate insert succeeded incorrectly!");
      process.exit(1);
    } catch (e: any) {
      if (e.message.includes('duplicate key value violates unique constraint "rent_schedules_lease_period_idx"')) {
        console.log("PASS: PostgreSQL correctly rejected the duplicate periodStart for the lease.");
        process.exit(0);
      } else {
        console.error("FAIL: Failed for another reason:", e);
        process.exit(1);
      }
    }
  } catch(e) {
    console.error("Error during setup:", e);
    process.exit(1);
  }
}

runTest();
