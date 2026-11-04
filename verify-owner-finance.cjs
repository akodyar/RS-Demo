process.env.SQL_HOST = 'localhost';
const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, ownershipRecords, managementAgreements, organizations, commissions, journalEntries, ledgerLines } = require('./src/db/schema.js');
const { eq, and, asc } = require('drizzle-orm');
const { tenantRepository } = require('./src/server/repositories/tenant.js');
const { ownerRepository } = require('./src/server/repositories/owner.js');
const { leaseRepository } = require('./src/server/repositories/leases.js');
const { commissionService } = require('./src/server/services/commission.js');

async function dumpState(label, oId, pId, leaseId, scheduleId) {
  console.log(`\n=== STATE: ${label} ===`);
  const [schedule] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
  const remaining = Number(schedule.amount) - Number(schedule.paidAmount || 0);
  console.log(`1. Tenant Schedule -> Amount: ${schedule.amount}, Paid: ${schedule.paidAmount}, Status: ${schedule.status}, Remaining: ${remaining}`);
  
  const ownerDash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
  console.log(`2. Owner Collected Rent (Dashboard Actual): ${ownerDash.rentalIncome.totalActualIqd}`);
  console.log(`   KPI Monthly Revenue: ${ownerDash.kpis.monthlyRevenueIqd}`);
  
  const finances = await ownerRepository.getAuthoritativeFinances({ id: oId, roles: ['PROPERTY_OWNER'] }, pId);
  console.log(`3 & 5. Owner Finances Net: ${finances.summary.net}, Total Fees: ${finances.summary.managementFees}`);
  console.log(`   Expected: ${finances.summary.expected}, Paid: ${finances.summary.paid}, Outstanding: ${finances.summary.outstanding}, Overdue: ${finances.summary.overdue}`);
  
  const allComms = await db.select().from(commissions).where(eq(commissions.propertyId, pId));
  console.log(`4. Commissions count: ${allComms.length}`);
  for (const c of allComms) {
     console.log(`   Commission ID: ${c.id}, Amount: ${c.commissionAmount}, Status: ${c.status}`);
     const ledgers = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, c.journalEntryId));
     console.log(`   Ledger Lines for this commission journal entry:`);
     for (const l of ledgers) {
       console.log(`     Account: ${l.accountId}, Debit: ${l.debit}, Credit: ${l.credit}`);
     }
  }
}

async function run() {
  const runId = Date.now().toString(36) + Math.floor(Math.random() * 10000);
  const tId = `t-v-${runId}`;
  const pId = `p-v-${runId}`;
  const pId2 = `p-v2-${runId}`; // Second property
  const oId = `o-v-${runId}`;
  const cId = `c-v-${runId}`;
  const adminId = `admin-v-${runId}`;
  
  await db.insert(users).values([
    { id: tId, firstName: 'T', lastName: 'Ver', email: `${tId}@test.com`, roles: ['TENANT'] },
    { id: oId, firstName: 'O', lastName: 'Ver', email: `${oId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: adminId, firstName: 'Admin', lastName: 'Ver', email: `${adminId}@test.com`, roles: ['PLATFORM_ADMIN'] }
  ]);
  
  await db.insert(organizations).values({ id: cId, name: 'Mgmt Co', type: 'MANAGEMENT_COMPANY' });
  
  // Property 1
  await db.insert(properties).values({ id: pId, name: 'Prop Ver 1', type: 'LAND', address: {}, operatingModel: 'FULLY_MANAGED', managementFee: '0.05', rentFee: '0.05' });
  await db.insert(ownershipRecords).values({ propertyId: pId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
  await db.insert(managementAgreements).values({ propertyId: pId, ownerId: oId, companyId: cId, startDate: '2026-01-01', status: 'ACTIVE', grantedPermissions: [] });

  // Property 2 (to detect leakage)
  await db.insert(properties).values({ id: pId2, name: 'Prop Ver 2', type: 'LAND', address: {}, operatingModel: 'AGENT_OPERATED' });
  await db.insert(ownershipRecords).values({ propertyId: pId2, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });

  const [lease] = await db.insert(leases).values({ propertyId: pId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000', status: 'ACTIVE' }).returning();
  await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

  await db.transaction(async (tx) => {
    await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-11-01', '2027-11-01', 1000);
  });

  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id)).orderBy(asc(rentSchedules.dueDate));
  const scheduleId = schedules[0].id;

  // 1. Pending payment (partial 200)
  const resultPartial = await tenantRepository.recordRentPayment(tId, {
     propertyId: pId,
     leaseId: lease.id,
     scheduleId,
     amount: 200,
     currency: 'IQD',
     paymentMethod: 'CASH',
  });
  
  await dumpState("Pending Partial Payment (200)", oId, pId, lease.id, scheduleId);

  // 2. Confirmed partial payment
  await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, resultPartial.payment.id));
  await commissionService.postCommissionForPayment(resultPartial.payment.id, adminId);
  
  await dumpState("Confirmed Partial Payment (200)", oId, pId, lease.id, scheduleId);

  // 3. Duplicate confirmation attempt
  try {
     const dupResult = await commissionService.postCommissionForPayment(resultPartial.payment.id, adminId);
     console.log(`\nDuplicate confirmation result: alreadyPosted=${dupResult.alreadyPosted}`);
  } catch(e) {
     console.log(`\nDuplicate confirmation error: ${e.message}`);
  }

  // 4. Pending remaining payment (800)
  const resultFull = await tenantRepository.recordRentPayment(tId, {
     propertyId: pId,
     leaseId: lease.id,
     scheduleId,
     amount: 800,
     currency: 'IQD',
     paymentMethod: 'CASH',
  });

  // 5. Confirmed remaining payment
  await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, resultFull.payment.id));
  await commissionService.postCommissionForPayment(resultFull.payment.id, adminId);

  await dumpState("Confirmed Full Payment (200 + 800 = 1000)", oId, pId, lease.id, scheduleId);

  // 6. Reversed partial payment
  // Note: /api/owner/payments/:paymentId/reverse would call reverseCommissionForPayment and update paymentRecords and rentSchedules
  await db.transaction(async (tx) => {
    // Manually reproduce reversal logic from leases.ts / reverse endpoint
    await tx.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, resultPartial.payment.id));
    
    const [sched] = await tx.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    const newPaidAmount = Math.max(0, Number(sched.paidAmount || 0) - 200);
    const newStatus = newPaidAmount >= Number(sched.amount) ? 'PAID' : (newPaidAmount > 0 ? 'PARTIALLY_PAID' : 'UPCOMING');
    await tx.update(rentSchedules).set({ paidAmount: newPaidAmount.toString(), status: newStatus }).where(eq(rentSchedules.id, scheduleId));
  });
  await commissionService.reverseCommissionForPayment(resultPartial.payment.id, "Refund requested", adminId);

  await dumpState("Reversed Partial Payment (200)", oId, pId, lease.id, scheduleId);
  
  // 7. Duplicate reversal attempt
  try {
     const dupRevResult = await commissionService.reverseCommissionForPayment(resultPartial.payment.id, "Duplicate", adminId);
     console.log(`\nDuplicate reversal result: alreadyReversed=${dupRevResult.alreadyReversed}`);
  } catch(e) {
     console.log(`\nDuplicate reversal error: ${e.message}`);
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
