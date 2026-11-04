process.env.SQL_HOST = 'localhost';
const { db } = require('./src/db/index.js');
const { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, ownershipRecords, managementAgreements, organizations } = require('./src/db/schema.js');
const { eq, and, asc } = require('drizzle-orm');
const { tenantRepository } = require('./src/server/repositories/tenant.js');
const { ownerRepository } = require('./src/server/repositories/owner.js');
const { leaseRepository } = require('./src/server/repositories/leases.js');
const { commissionService } = require('./src/server/services/commission.js');

async function run() {
  const runId = Date.now().toString(36);
  const tId = `t-fin-${runId}`;
  const pId = `p-fin-${runId}`;
  const oId = `o-fin-${runId}`;
  const cId = `c-fin-${runId}`;
  
  await db.insert(users).values([
    { id: tId, firstName: 'T', lastName: 'Fin', email: `${tId}@test.com`, roles: ['TENANT'] },
    { id: oId, firstName: 'O', lastName: 'Fin', email: `${oId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: 'admin', firstName: 'Admin', lastName: 'Fin', email: `admin@test.com`, roles: ['PLATFORM_ADMIN'] }
  ]).onConflictDoNothing();
  
  await db.insert(organizations).values({ id: cId, name: 'Mgmt Co', type: 'MANAGEMENT_COMPANY' });
  
  await db.insert(properties).values({ id: pId, name: 'Prop Fin', type: 'LAND', address: {}, operatingModel: 'FULLY_MANAGED', managementFee: '0.05', rentFee: '0.05' });
  await db.insert(ownershipRecords).values({ propertyId: pId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
  await db.insert(managementAgreements).values({ propertyId: pId, ownerId: oId, companyId: cId, startDate: '2026-01-01', status: 'ACTIVE', grantedPermissions: [] });

  const [lease] = await db.insert(leases).values({ propertyId: pId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000', status: 'ACTIVE' }).returning();
  await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

  await db.transaction(async (tx) => {
    await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-11-01', '2027-11-01', 1000);
  });

  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id)).orderBy(asc(rentSchedules.dueDate));
  
  // Tenant records a payment
  const result = await tenantRepository.recordRentPayment(tId, {
     propertyId: pId,
     leaseId: lease.id,
     scheduleId: schedules[0].id,
     amount: 1000,
     currency: 'IQD',
     paymentMethod: 'CASH',
  });
  
  // Admin confirms payment
  await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, result.payment.id));
  await commissionService.postCommissionForPayment(result.payment.id, 'admin');

  const finances = await ownerRepository.getAuthoritativeFinances({ id: oId, roles: ['PROPERTY_OWNER'] }, pId);
  console.log("Finances Net:", finances.summary.net);
  console.log("Finances Mgmt Fee:", finances.summary.managementFees);
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
