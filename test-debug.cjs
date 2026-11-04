process.env.SQL_HOST = 'localhost';
const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, ownershipRecords } = require('./src/db/schema.js');
const { eq, and, asc } = require('drizzle-orm');
const { tenantRepository } = require('./src/server/repositories/tenant.js');
const { leaseRepository } = require('./src/server/repositories/leases.js');

async function run() {
  const tId = 't-debug-1';
  const pId = 'p-debug-1';
  
  await db.insert(users).values([{ id: tId, firstName: 'T', lastName: 'Debug', roles: ['TENANT'] }]).onConflictDoNothing();
  await db.insert(properties).values({ id: pId, name: 'Prop Debug', type: 'LAND', address: {} }).onConflictDoNothing();

  const [lease] = await db.insert(leases).values({ propertyId: pId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000', status: 'ACTIVE' }).returning();
  await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

  await db.transaction(async (tx) => {
    await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-11-01', '2027-11-01', 1000);
  });

  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id)).orderBy(asc(rentSchedules.dueDate));
  
  console.log("Expected next schedule ID:", schedules[0].id);

  const dash = await tenantRepository.getAuthoritativeDashboard(tId);
  console.log("Actual rentDue schedule ID:", dash.rentDue?.scheduleId);
  console.log("Are they equal?", schedules[0].id === dash.rentDue?.scheduleId);
  
  if (dash.rentDue?.scheduleId !== schedules[0].id) {
     const actualSched = schedules.find(s => s.id === dash.rentDue?.scheduleId);
     console.log("Actual schedule is at index:", schedules.indexOf(actualSched));
     console.log("Schedules[0] details:", schedules[0]);
     console.log("Actual details:", actualSched);
  }
}
run().then(() => process.exit(0));
