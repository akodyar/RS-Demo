const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, rentSchedules, paymentRecords } = require('./src/db/schema.js');
const { eq } = require('drizzle-orm');
const { LeaseRepository } = require('./src/server/repositories/leases.js');
const { TenantRepository } = require('./src/server/repositories/tenant.js');

async function run() {
  const leaseRepository = new LeaseRepository();
  const tenantRepository = new TenantRepository();
  const tId = 'tenant-partially-paid-bug';
  await db.insert(users).values({ id: tId, firstName: 'T', lastName: 'bug', email: 'tbug@t.com', roles: ['TENANT'] }).onConflictDoNothing();
  const pId = 'prop-partially-paid-bug';
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
  const janSchedule = schedules.find(s => new Date(s.periodStart).toISOString() === '2026-01-01T00:00:00.000Z');

  // Let's check outstanding balance BEFORE partial payment
  let dashboard = await tenantRepository.getAuthoritativeDashboard(tId);
  console.log(`Before payment: Outstanding = ${dashboard.financialSummary.outstanding}`);
  
  // Apply a PARTIAL PAYMENT of 200 (leaving 800 outstanding)
  await db.insert(paymentRecords).values({
    propertyId: pId, leaseId: lease.id, rentScheduleId: janSchedule.id, payerId: tId,
    amount: '200', recordedDate: new Date().toISOString(), status: 'RECORDED'
  }).returning();
  
  await db.update(rentSchedules).set({ status: 'PARTIALLY_PAID', paidAmount: '200' }).where(eq(rentSchedules.id, janSchedule.id));

  // Check outstanding balance AFTER partial payment
  dashboard = await tenantRepository.getAuthoritativeDashboard(tId);
  console.log(`After partial payment (200 paid on 1000 rent):`);
  console.log(`Expected Outstanding = 800 (from Jan) + other months = ...`);
  console.log(`Actual Outstanding   = ${dashboard.financialSummary.outstanding}`);
  
  // Compare outstanding drops. If the full 1000 disappeared, it's a bug.
  // There are 12 schedules of 1000. Before: 12000. After: 11000 instead of 11800!
  
  if (dashboard.financialSummary.outstanding % 1000 === 0) {
      console.log('DEFECT CONFIRMED: PARTIALLY_PAID schedule is completely excluded from outstanding balance!');
  } else {
      console.log('NO DEFECT: Outstanding balance correctly includes the 800 partial remainder.');
  }

  const rentDue = dashboard.rentDue;
  if (!rentDue || rentDue.scheduleId !== janSchedule.id) {
      console.log('DEFECT CONFIRMED: PARTIALLY_PAID schedule disappeared from Rent Due (nextSchedule)!');
  }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
