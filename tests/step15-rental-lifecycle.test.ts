import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { users, organizations, properties, units, leases, rentSchedules, paymentRecords, commissions, journalEntries, ledgerLines, financialPolicies, ownershipRecords, managementAgreements, leaseTenants, moveOutRequests, leaseRenewals, rentalApplications } from '../src/db/schema.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { Permission } from '../src/types/index.js';
import { commissionService } from '../src/server/services/commission.js';
import { financeService } from '../src/server/services/finance.js';

process.env.SQL_HOST = process.env.SQL_HOST || 'localhost';

const TIMESTAMP = Date.now();
const ID_PREFIX = `step15_${TIMESTAMP}`;

async function runTests() {
  console.log(`\n=== STARTING STEP 15 RENTAL LIFECYCLE VERIFICATION ===\n`);
  let passed = 0;
  let failed = 0;

  function assertAllowed(result: boolean, msg: string) {
    if (result) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  function assertCondition(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  // 1. Setup Data
  const ownerId = `${ID_PREFIX}_owner`;
  const companyId = `${ID_PREFIX}_company`;
  const tenantId = `${ID_PREFIX}_tenant`;
  
  await db.insert(users).values([
    { id: ownerId, email: `${ownerId}@example.com`, firstName: 'Owner', lastName: 'User', roles: ['PROPERTY_OWNER'] },
    { id: companyId, email: `${companyId}@example.com`, firstName: 'Company', lastName: 'User', roles: ['COMPANY_ADMIN'] },
    { id: tenantId, email: `${tenantId}@example.com`, firstName: 'Tenant', lastName: 'User', roles: ['TENANT'] }
  ]);

  await db.insert(organizations).values([
    { id: companyId, name: 'Company C', type: 'PROPERTY_MANAGEMENT' }
  ]);
  await db.insert(financialPolicies).values([
    { policyType: 'PLATFORM_FEE_RATE', policyValue: '0.03', active: true, effectiveFrom: new Date() },
    { policyType: 'RENT_MANAGEMENT_COMMISSION_RATE', policyValue: '0.05', active: true, effectiveFrom: new Date() }
  ]).onConflictDoNothing();

  const propId = `${ID_PREFIX}_prop`;
  await db.insert(properties).values({
    id: propId,
    name: 'Golden Property',
    type: 'RESIDENTIAL',
    status: 'AVAILABLE'
  });

  const unitId = `${ID_PREFIX}_unit`;
  await db.insert(units).values({
    id: unitId,
    propertyId: propId,
    unitNumber: 'A1',
    status: 'AVAILABLE'
  });

  await db.insert(ownershipRecords).values({
    id: `${ID_PREFIX}_owner_rec`,
    propertyId: propId,
    ownerId: ownerId,
    status: 'VERIFIED',
    ownershipPercentage: '100'
  });

  await db.insert(managementAgreements).values({
    id: `${ID_PREFIX}_mgmt`,
    propertyId: propId,
    companyId: companyId,
    ownerId: ownerId,
    status: 'ACTIVE',
    startDate: new Date().toISOString(),
    grantedPermissions: [Permission.MANAGE_LEASES, Permission.VIEW_FINANCIALS, Permission.COLLECT_RENT, Permission.MANAGE_FINANCIALS]
  });

  // Approved Rental Application (required by createLease validation)
  const applicationId = `${ID_PREFIX}_app`;
  await db.insert(rentalApplications).values({
    id: applicationId,
    propertyId: propId,
    unitId: unitId,
    applicantUserId: tenantId,
    status: 'APPROVED',
  });

  // 10. Create lease
  const leaseObj = await leaseRepository.createLease(propId, unitId, [tenantId], new Date().toISOString(), new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString(), 1000000);
  
  // 11. Activate lease
  await leaseRepository.activateLease(leaseObj.id);

  // 12. Verify schedules generated
  const schedules = await db.query.rentSchedules.findMany({ where: eq(rentSchedules.leaseId, leaseObj.id) });
  assertCondition(schedules.length === 12, `Generated ${schedules.length} schedules, expected 12`);

  // 13. Confirm occupancy
  const dash = await ownerRepository.getAuthoritativeDashboard({ id: ownerId, roles: ['PROPERTY_OWNER'] } as any);
  assertCondition(dash.properties[0].isOccupied === true, `Property occupancy is correctly true after lease activation`);

  // 14 & 15 & 16. Record/Confirm partial rent & 5% commission
  const schedule1 = schedules[0];
  await leaseRepository.recordPayment(propId, leaseObj.id, tenantId, schedule1.id, 600000, 'BANK_TRANSFER', 'Ref1', companyId);
  const p1 = await db.query.paymentRecords.findFirst({ where: eq(paymentRecords.propertyId, propId), orderBy: (p, { desc }) => [desc(p.createdAt)] });
  await leaseRepository.confirmPayment(p1!.id, ownerId);
  await commissionService.postCommissionForPayment(p1!.id, 'SYSTEM');

  // 17 & 18. Record second partial rent & confirm
  await leaseRepository.recordPayment(propId, leaseObj.id, tenantId, schedule1.id, 400000, 'BANK_TRANSFER', 'Ref2', companyId);
  const p2 = await db.query.paymentRecords.findFirst({ where: eq(paymentRecords.propertyId, propId), orderBy: (p, { desc }) => [desc(p.createdAt)] });
  await leaseRepository.confirmPayment(p2!.id, ownerId);
  await commissionService.postCommissionForPayment(p2!.id, 'SYSTEM');

  // 19. Verify schedule PAID
  const updatedSch1 = await db.query.rentSchedules.findFirst({ where: eq(rentSchedules.id, schedule1.id) });
  assertCondition(updatedSch1!.status === 'PAID', `Schedule 1 status is PAID (paidAmount = ${updatedSch1!.paidAmount})`);

  // 20. Verify dynamic fee model and commission ledger
  const activePlatformRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
  const expectedP1Fee = Math.round(600000 * activePlatformRate);
  const expectedP2Fee = Math.round(400000 * activePlatformRate);
  const expectedTotalFee = expectedP1Fee + expectedP2Fee;

  const coms = await db.query.commissions.findMany({ where: eq(commissions.propertyId, propId) });
  const totalCommission = coms.reduce((sum, c) => sum + Number(c.commissionAmount), 0);
  assertCondition(
    coms.length === 2 &&
    totalCommission === expectedTotalFee &&
    coms.every(c => c.commissionType === 'PLATFORM_FEES' && parseFloat(c.rate) === activePlatformRate),
    `Commission calculated dynamically via 3-Fee Model (total ${totalCommission} IQD matching rate ${activePlatformRate * 100}% on 1,000,000 IQD rent)`
  );

  // --- RENEWAL TEST ---
  console.log('\n--- RENEWAL TEST ---');
  const propEndDate = new Date(leaseObj.endDate);
  propEndDate.setMonth(propEndDate.getMonth() + 6);
  await tenantRepository.requestLeaseRenewal(tenantId, { propertyId: propId, leaseId: leaseObj.id, proposedStartDate: leaseObj.endDate, proposedEndDate: propEndDate.toISOString(), proposedRentAmount: 1100000 });
  const [renewalReq] = await db.query.leaseRenewals.findMany({ where: eq(leaseRenewals.leaseId, leaseObj.id) });
  
  await leaseRepository.approveRenewal(renewalReq.id);
  
  let renewFailed = false;
  try { await leaseRepository.approveRenewal(renewalReq.id); } catch(e) { renewFailed = true; }
  assertCondition(renewFailed, `Duplicate renewal approval failed safely`);

  const updatedLease = await db.query.leases.findFirst({ where: eq(leases.id, leaseObj.id) });
  assertCondition(updatedLease!.endDate === propEndDate.toISOString(), `Lease end date extended to ${propEndDate.toISOString()}`);
  
  const allSchedules = await db.query.rentSchedules.findMany({ where: eq(rentSchedules.leaseId, leaseObj.id) });
  assertCondition(allSchedules.length === 18, `Future schedules generated correctly (expected 18, got ${allSchedules.length})`);
  assertCondition(allSchedules[12].amount === '1100000', `New schedule amount is correct: ${allSchedules[12].amount}`);

  // --- MOVE-OUT TEST ---
  console.log('\n--- MOVE-OUT TEST ---');
  await tenantRepository.requestMoveOut(tenantId, { propertyId: propId, leaseId: leaseObj.id, requestedMoveOutDate: new Date().toISOString() });
  const [moveOutReq] = await db.query.moveOutRequests.findMany({ where: eq(moveOutRequests.leaseId, leaseObj.id) });
  
  await leaseRepository.approveMoveOut(moveOutReq.id);
  
  let moveOutFailed = false;
  try { await leaseRepository.approveMoveOut(moveOutReq.id); } catch(e) { moveOutFailed = true; }
  assertCondition(moveOutFailed, `Duplicate move-out approval failed safely`);

  const finalLease = await db.query.leases.findFirst({ where: eq(leases.id, leaseObj.id) });
  assertCondition(finalLease!.status === 'TERMINATED', `Lease status is TERMINATED`);

  const finalDash = await ownerRepository.getAuthoritativeDashboard({ id: ownerId, roles: ['PROPERTY_OWNER'] } as any);
  assertCondition(finalDash.properties[0].isOccupied === false, `Property occupancy is correctly false after move-out`);

  // --- RECEIPT/AUTHORIZATION TEST ---
  console.log('\n--- RECEIPT AUTHORIZATION TEST ---');
  // Owner accesses receipt -> allow
  const hasPermOwner = await ownerRepository.verifyPropertyPermission({ id: ownerId, roles: ['PROPERTY_OWNER'] } as any, propId, Permission.VIEW_FINANCIALS);
  assertAllowed(hasPermOwner, `Owner has VIEW_FINANCIALS access to receipt`);
  
  // Unrelated user accesses receipt -> deny
  const hasPermUserX = await ownerRepository.verifyPropertyPermission({ id: 'userX', roles: [] } as any, propId, Permission.VIEW_FINANCIALS);
  assertAllowed(!hasPermUserX, `Unrelated user denied access to receipt`);

  console.log(`\nTests completed. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }

  // Cleanup
  console.log('\n--- Cleanup ---');
  await db.delete(commissions).where(eq(commissions.propertyId, propId));
  const jes = await db.select().from(journalEntries).where(eq(journalEntries.propertyId, propId));
  for (const je of jes) {
    await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id));
  }
  await db.delete(journalEntries).where(eq(journalEntries.propertyId, propId));
  await db.delete(paymentRecords).where(eq(paymentRecords.propertyId, propId));
  
  await db.delete(moveOutRequests).where(eq(moveOutRequests.leaseId, leaseObj.id));
  await db.delete(leaseRenewals).where(eq(leaseRenewals.leaseId, leaseObj.id));
  await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseObj.id));
  await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseObj.id));
  await db.delete(leases).where(eq(leases.propertyId, propId));

  await db.delete(rentalApplications).where(eq(rentalApplications.id, applicationId));
  await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, propId));
  await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
  await db.delete(units).where(eq(units.propertyId, propId));
  await db.delete(properties).where(eq(properties.id, propId));
  await db.delete(organizations).where(eq(organizations.id, companyId));
  await db.delete(users).where(and(eq(users.id, ownerId)));
  await db.delete(users).where(and(eq(users.id, companyId)));
  await db.delete(users).where(and(eq(users.id, tenantId)));

  console.log('Cleanup complete.\n');
}

runTests()
  .then(() => {
    process.exit(process.exitCode || 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
