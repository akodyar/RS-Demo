const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, leaseRenewals, rentSchedules, paymentRecords } = require('./src/db/schema.js');
const { eq } = require('drizzle-orm');
const { leaseRepository } = require('./src/server/repositories/leases.js');

async function run() {
  const tId = 'tenant-part-2';
  await db.insert(users).values({ id: tId, firstName: 'T', lastName: 'P', email: 'ttp2@t.com', roles: ['TENANT'] }).onConflictDoNothing();
  const pId = 'prop-part-2';
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

  // Get the July schedule
  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
  const julySchedule = schedules.find(s => s.periodStart === '2026-07-01T00:00:00.000Z');

  // Tenant partially pays for July (manual DB update to simulate)
  await db.update(rentSchedules).set({ status: 'PARTIALLY_PAID', paidAmount: '500' }).where(eq(rentSchedules.id, julySchedule.id));

  const [renewal] = await db.insert(leaseRenewals).values({
    leaseId: lease.id, propertyId: pId, tenantId: tId,
    proposedStartDate: '2026-07-01T00:00:00.000Z',
    proposedEndDate: '2027-12-31T00:00:00.000Z',
    proposedRentAmount: '2000',
    status: 'REQUESTED'
  }).returning();

  try {
    await leaseRepository.approveRenewal(renewal.id);
    console.log('SUCCESS');
  } catch (err) {
    console.error('CRASHED:', err.message);
  }

  process.exit(0);
}
run().catch(console.error);
