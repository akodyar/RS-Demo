const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, leaseRenewals } = require('./src/db/schema.js');
const { eq } = require('drizzle-orm');
const { LeaseRepository } = require('./src/server/repositories/leases.js');

async function run() {
  const leaseRepository = new LeaseRepository();
  const tId = 'tenant-reversal-1';
  await db.insert(users).values({ id: tId, firstName: 'T', lastName: '1', email: 'trev1@t.com', roles: ['TENANT'] }).onConflictDoNothing();
  const pId = 'prop-reversal-1';
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
  const augSchedule = schedules.find(s => new Date(s.periodStart).toISOString() === '2026-08-01T00:00:00.000Z');

  // Simulate a payment that was recorded...
  const [payment] = await db.insert(paymentRecords).values({
    propertyId: pId, leaseId: lease.id, rentScheduleId: augSchedule.id, payerId: tId,
    amount: '1000', recordedDate: new Date().toISOString(), status: 'RECORDED'
  }).returning();

  // ...and then reversed
  await db.update(rentSchedules).set({ status: 'UPCOMING', paidAmount: '0' }).where(eq(rentSchedules.id, augSchedule.id));
  await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, payment.id));

  // Now propose and approve a mid-lease renewal starting August 1st
  const [renewal] = await db.insert(leaseRenewals).values({
    leaseId: lease.id, propertyId: pId, tenantId: tId,
    proposedStartDate: '2026-08-01T00:00:00.000Z',
    proposedEndDate: '2027-12-31T00:00:00.000Z',
    proposedRentAmount: '2000', status: 'REQUESTED'
  }).returning();

  try {
    await leaseRepository.approveRenewal(renewal.id);
    console.log("SUCCESS: Renewal approved despite reversed payment!");
  } catch (err) {
    console.error("CRASHED:", err.message);
    if (err.cause) console.error("CAUSE:", err.cause.message || err.cause);
  }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
