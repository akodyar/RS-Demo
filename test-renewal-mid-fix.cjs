const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, leaseRenewals, rentSchedules } = require('./src/db/schema.js');
const { eq } = require('drizzle-orm');
const { leaseRepository } = require('./src/server/repositories/leases.js');

async function run() {
  const tId = 'tenant-renew-mid3';
  await db.insert(users).values({ id: tId, firstName: 'T', lastName: 'T', email: 'ttmid3@t.com', roles: ['TENANT'] }).onConflictDoNothing();
  const pId = 'prop-renew-mid3';
  await db.insert(properties).values({ id: pId, name: 'P', type: 'LAND', address: {} }).onConflictDoNothing();
  
  const [lease] = await db.insert(leases).values({
    propertyId: pId,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    rentAmount: '1000',
    status: 'ACTIVE'
  }).returning();

  await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

  await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
  });

  const [renewal] = await db.insert(leaseRenewals).values({
    leaseId: lease.id, propertyId: pId, tenantId: tId,
    proposedStartDate: '2026-07-01T00:00:00.000Z',
    proposedEndDate: '2027-12-31T00:00:00.000Z',
    proposedRentAmount: '2000',
    status: 'REQUESTED'
  }).returning();

  // Call the actual fixed method!
  await leaseRepository.approveRenewal(renewal.id);

  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
  
  const julySchedules = schedules.filter(s => s.periodStart === '2026-07-01T00:00:00.000Z');
  console.log('July 2026 schedules count:', julySchedules.length);
  console.log('July 2026 schedule amount:', julySchedules[0].amount); 

  process.exit(0);
}
run().catch(console.error);
