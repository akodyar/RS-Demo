import { test } from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, ownershipRecords, managementAgreements, organizations } from '../src/db/schema.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { eq, and, asc } from 'drizzle-orm';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { commissionService } from '../src/server/services/commission.js';
import { financeService } from '../src/server/services/finance.js';

process.env.SQL_HOST = 'localhost';

test('Owner finances use confirmed payments and actual commission records', async (t) => {
  const runId = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const tId = `t-f-${runId}`;
  const pId = `p-f-${runId}`;
  const oId = `o-f-${runId}`;
  const cId = `c-f-${runId}`;
  
  await db.insert(users).values([
    { id: tId, firstName: 'T', lastName: 'Fin', email: `${tId}@test.com`, roles: ['TENANT'] },
    { id: oId, firstName: 'O', lastName: 'Fin', email: `${oId}@test.com`, roles: ['PROPERTY_OWNER'] },
    { id: `admin-${runId}`, firstName: 'Admin', lastName: 'Fin', email: `admin-${runId}@test.com`, roles: ['PLATFORM_ADMIN'] }
  ]);
  
  await db.insert(organizations).values({ id: cId, name: 'Mgmt Co', type: 'MANAGEMENT_COMPANY' });
  await db.insert(properties).values({ id: pId, name: 'Prop Fin', type: 'LAND', address: {}, currency: 'IQD', operatingModel: 'FULLY_MANAGED', managementFee: '0.05', rentFee: '0.05' });
  await db.insert(ownershipRecords).values({ propertyId: pId, ownerId: oId, ownershipPercentage: '100', status: 'VERIFIED' });
  await db.insert(managementAgreements).values({ propertyId: pId, ownerId: oId, companyId: cId, startDate: '2026-01-01', status: 'ACTIVE', grantedPermissions: [] });

  const [lease] = await db.insert(leases).values({ propertyId: pId, startDate: '2026-11-01', endDate: '2027-11-01', rentAmount: '1000', currency: 'IQD', status: 'ACTIVE' }).returning();
  await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

  await db.transaction(async (tx) => {
    await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-11-01', '2027-11-01', 1000);
  });

  const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id)).orderBy(asc(rentSchedules.dueDate));
  
  // Step 1: Tenant records an unconfirmed payment
  const result = await tenantRepository.recordRentPayment(tId, {
     propertyId: pId,
     leaseId: lease.id,
     scheduleId: schedules[0].id,
     amount: 1000,
     currency: 'IQD',
     paymentMethod: 'CASH',
  });
  
  // Verify Dashboard ignores unconfirmed payments
  let dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
  assert.strictEqual(dash.rentalIncome.totalActualIqd, 0, 'Dashboard should not include unconfirmed payments');

  // Verify Finances ignores unconfirmed payments
  let finances = await ownerRepository.getAuthoritativeFinances({ id: oId, roles: ['PROPERTY_OWNER'] }, pId);
  assert.strictEqual(finances.summary.net, 0, 'Net income should be 0 for unconfirmed payment');
  assert.strictEqual(finances.summary.managementFees, 0, 'Fees should be 0 for unconfirmed payment');

  // Step 2: Confirm payment and post commission
  await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, result.payment.id));
  await commissionService.postCommissionForPayment(result.payment.id, `admin-${runId}`);

  // Verify Dashboard now includes confirmed payment
  dash = await ownerRepository.getAuthoritativeDashboard({ id: oId, roles: ['PROPERTY_OWNER'] });
  assert.strictEqual(dash.rentalIncome.totalActualIqd, 1000, 'Dashboard must include confirmed payment');

  // Verify Finances computes actual fees dynamically from DB policy
  finances = await ownerRepository.getAuthoritativeFinances({ id: oId, roles: ['PROPERTY_OWNER'] }, pId);
  const platformRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
  const expectedPlatformFee = Math.round(1000 * platformRate);
  const expectedTotalFees = expectedPlatformFee + 50 + 50;
  assert.strictEqual(finances.summary.managementFees, expectedTotalFees, 'Total fees must include platform, rent, and mgmt derived from commission records');
  assert.strictEqual(finances.summary.net, 1000 - expectedTotalFees, 'Net income must be rent (1000) minus fees');
});
