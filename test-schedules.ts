import { db } from './src/db/index.js';
import { rentSchedules, leases, properties, users, leaseTenants } from './src/db/schema.js';
import crypto from 'node:crypto';
import { leaseRepository } from './src/server/repositories/leases.js';
import { eq } from 'drizzle-orm';

async function verifyLease(months: number) {
  const ownerId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const propId = crypto.randomUUID();

  await db.insert(users).values([
    { id: ownerId, firstName: 'O', lastName: 'A', email: `o${ownerId}@test.com` },
    { id: tenantId, firstName: 'T', lastName: 'A', email: `t${tenantId}@test.com` }
  ]);
  
  await db.insert(properties).values({ id: propId, name: `Prop ${months}M`, type: 'LAND', address: {} });
  
  const start = new Date('2026-01-01');
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  // Subtract one day so it's a true boundary e.g. 1 month = Jan 1 to Jan 31
  end.setDate(end.getDate() - 1);

  const [lease] = await db.insert(leases).values({
    propertyId: propId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    rentAmount: '1000',
    status: 'DRAFT'
  }).returning();

  await db.insert(leaseTenants).values({
    leaseId: lease.id,
    tenantId: tenantId,
    isPrimary: true
  });

  await leaseRepository.activateLease(lease.id);

  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
  
  console.log(`Lease ${months}M (${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}): Generated ${schedules.length} schedules`);
  if (schedules.length !== months) {
    console.error(`ERROR: Expected ${months} schedules, got ${schedules.length}`);
    process.exit(1);
  }
}

async function run() {
  await verifyLease(1);
  await verifyLease(3);
  await verifyLease(6);
  await verifyLease(12);
  console.log("PASS: Schedule counts match exactly the duration in months.");
  process.exit(0);
}

run().catch(console.error);
