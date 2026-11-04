const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, leaseRenewals } = require('./src/db/schema.js');
const { eq } = require('drizzle-orm');
const { LeaseRepository } = require('./src/server/repositories/leases.js');

async function run() {
  const leaseRepository = new LeaseRepository();
  const tId = 'tenant-reversal-2';
  await db.insert(users).values({ id: tId, firstName: 'T', lastName: '2', email: 'trev2@t.com', roles: ['TENANT'] }).onConflictDoNothing();
  const pId = 'prop-reversal-2';
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

  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
  const decSchedule = schedules.find(s => new Date(s.periodStart).toISOString() === '2026-12-01T00:00:00.000Z');

  // Simulate a payment that was recorded...
  const [payment] = await db.insert(paymentRecords).values({
    propertyId: pId, leaseId: lease.id, rentScheduleId: decSchedule.id, payerId: tId,
    amount: '1000', recordedDate: new Date().toISOString(), status: 'RECORDED'
  }).returning();
  
  // Set schedule to CANCELLED (as if the lease was shortened)
  await db.update(rentSchedules).set({ status: 'CANCELLED', amount: '0', paidAmount: '1000' }).where(eq(rentSchedules.id, decSchedule.id));

  // Now simulate a reversal of that payment...
  // In the real endpoint, this logic runs:
  const newPaidAmount = 0; // reversed
  let newStatus = 'UPCOMING';
  if (newPaidAmount > 0) {
      newStatus = newPaidAmount >= 0 ? 'PAID' : 'PARTIALLY_PAID'; // 0 is schedule.amount
  } else {
      const now = new Date();
      const dueDate = new Date(decSchedule.dueDate);
      newStatus = dueDate < now ? 'OVERDUE' : 'UPCOMING';
  }
  
  console.log(`Original status: CANCELLED`);
  console.log(`New status calculated by reversal: ${newStatus}`);
  
  if (newStatus !== 'CANCELLED') {
      console.log(`DEFECT CONFIRMED: CANCELLED schedule resurrected as ${newStatus}!`);
  }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
