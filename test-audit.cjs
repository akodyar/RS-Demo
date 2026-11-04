process.env.SQL_HOST = 'localhost';
const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, leaseRenewals, ownershipRecords, managementAgreements, organizations } = require('./src/db/schema.js');
const { eq, and, asc } = require('drizzle-orm');
const { tenantRepository } = require('./src/server/repositories/tenant.js');
const { leaseRepository } = require('./src/server/repositories/leases.js');
const { commissionService } = require('./src/server/services/commission.js');

async function run() {
  const runId = Date.now().toString(36) + Math.floor(Math.random() * 10000);
  const tId = `t-aud-${runId}`;
  const pId = `p-aud-${runId}`;
  
  await db.insert(users).values([
    { id: tId, firstName: 'T', lastName: 'Aud', email: `${tId}@test.com`, roles: ['TENANT'] }
  ]).onConflictDoNothing();
  
  await db.insert(properties).values({ id: pId, name: 'Prop Aud', type: 'LAND', address: {}, operatingModel: 'AGENT_OPERATED' });

  // 1-year lease
  const [lease] = await db.insert(leases).values({ propertyId: pId, startDate: '2026-01-01', endDate: '2027-01-01', rentAmount: '1000', status: 'ACTIVE' }).returning();
  await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

  await db.transaction(async (tx) => {
    await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01', '2027-01-01', 1000);
  });

  let schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id)).orderBy(asc(rentSchedules.dueDate));
  const targetSchedule = schedules[6]; // Month 7 (July)

  // 1. Pay partially on Month 7 (e.g. 500 out of 1000)
  const p1 = await tenantRepository.recordRentPayment(tId, {
     propertyId: pId,
     leaseId: lease.id,
     scheduleId: targetSchedule.id,
     amount: 500,
     currency: 'IQD',
     paymentMethod: 'CASH',
  });

  // 2. Shorten lease to end in June (Month 6)
  const [renewal] = await db.insert(leaseRenewals).values({
    leaseId: lease.id,
    propertyId: pId,
    tenantId: tId,
    proposedStartDate: '2026-01-01',
    proposedEndDate: '2026-07-01', // ends exactly before Month 7
    proposedRentAmount: '1000',
    status: 'REQUESTED'
  }).returning();

  await leaseRepository.approveRenewal(renewal.id);

  // 3. Now Reverse the Payment
  // Emulate reversal logic from routes/leases.ts
  await db.transaction(async (tx) => {
    const [updated] = await tx.update(paymentRecords)
        .set({ status: 'REVERSED' })
        .where(and(eq(paymentRecords.id, p1.payment.id)))
        .returning();

    const [schedule] = await tx.select().from(rentSchedules).where(eq(rentSchedules.id, updated.rentScheduleId)).limit(1);
    
    // Exact logic from route:
    const newPaidAmount = Math.max(0, Number(schedule.paidAmount || 0) - Number(updated.amount));
    let newStatus = schedule.status === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING';
    
    if (schedule.status !== 'CANCELLED') {
        if (newPaidAmount > 0) {
            newStatus = newPaidAmount >= Number(schedule.amount) ? 'PAID' : 'PARTIALLY_PAID';
        } else {
            const now = new Date();
            const dueDate = new Date(schedule.dueDate);
            newStatus = dueDate < now ? 'OVERDUE' : 'UPCOMING';
        }
    }
    
    await tx.update(rentSchedules)
      .set({ paidAmount: newPaidAmount.toString(), status: newStatus })
      .where(eq(rentSchedules.id, schedule.id));
  });

  schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id)).orderBy(asc(rentSchedules.dueDate));
  const checkSched = schedules.find(s => s.id === targetSchedule.id);
  console.log(`\nMonth 7 Schedule AFTER Reversal:`);
  console.log(`Amount: ${checkSched.amount}`);
  console.log(`Paid: ${checkSched.paidAmount}`);
  console.log(`Status: ${checkSched.status}`);
  console.log(`Remaining: ${Number(checkSched.amount) - Number(checkSched.paidAmount)}`);
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
