const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, leaseRenewals, rentSchedules } = require('./src/db/schema.js');
const { eq } = require('drizzle-orm');
const { leaseRepository } = require('./src/server/repositories/leases.js');

async function run() {
  const tId = 'tenant-renew-1';
  await db.insert(users).values({ id: tId, firstName: 'T', lastName: 'T', email: 'tt@t.com', roles: ['TENANT'] }).onConflictDoNothing();
  const pId = 'prop-renew-1';
  await db.insert(properties).values({ id: pId, name: 'P', type: 'LAND', address: {} }).onConflictDoNothing();
  
  const [lease] = await db.insert(leases).values({
    propertyId: pId,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    rentAmount: '1000',
    status: 'ACTIVE'
  }).returning();

  await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

  // Generate initial schedules
  await leaseRepository.generateRentSchedule(db, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);

  // Request renewal
  const [renewal] = await db.insert(leaseRenewals).values({
    leaseId: lease.id, propertyId: pId, tenantId: tId,
    proposedStartDate: '2027-01-01T00:00:00.000Z',
    proposedEndDate: '2027-12-31T00:00:00.000Z',
    proposedRentAmount: '2000',
    status: 'REQUESTED'
  }).returning();

  await leaseRepository.approveRenewal(renewal.id);

  const updatedLease = await db.select().from(leases).where(eq(leases.id, lease.id)).limit(1);
  console.log('Updated Lease rentAmount:', updatedLease[0].rentAmount); // Is it 2000 now?

  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
  console.log('Total schedules:', schedules.length);
  console.log('First renewal schedule:', schedules[12]);

  process.exit(0);
}
run().catch(console.error);
