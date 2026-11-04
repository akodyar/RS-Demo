import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { users, organizations, properties, units, leases, rentSchedules, paymentRecords, commissions, journalEntries, ledgerLines, financialPolicies, ownershipRecords, managementAgreements, leaseTenants, moveOutRequests, leaseRenewals } from '../src/db/schema.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { Permission, LeaseStatus } from '../src/types/index.js';

const TIMESTAMP = Date.now();
const ID_PREFIX = `step16_${TIMESTAMP}`;

async function runTests() {
  console.log(`\n=== STARTING STEP 16 ADVERSARIAL VERIFICATION ===\n`);
  let passed = 0;
  let failed = 0;

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

  const propId = `${ID_PREFIX}_prop`;
  await db.insert(properties).values({
    id: propId,
    name: 'Adv Property',
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

  // Lease setup
  const leaseObj = await leaseRepository.createLease(propId, unitId, [tenantId], new Date().toISOString(), new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString(), 1000000);
  await leaseRepository.activateLease(leaseObj.id);

  // CONCURRENCY A: Renewal
  console.log('\n--- CONCURRENCY: RENEWAL ---');
  const propEndDate = new Date(leaseObj.endDate);
  propEndDate.setMonth(propEndDate.getMonth() + 6);
  await tenantRepository.requestLeaseRenewal(tenantId, { propertyId: propId, leaseId: leaseObj.id, proposedStartDate: leaseObj.endDate, proposedEndDate: propEndDate.toISOString(), proposedRentAmount: 1100000 });
  const [renewalReq] = await db.query.leaseRenewals.findMany({ where: eq(leaseRenewals.leaseId, leaseObj.id) });

  const renewalResults = await Promise.allSettled([
    leaseRepository.approveRenewal(renewalReq.id),
    leaseRepository.approveRenewal(renewalReq.id),
    leaseRepository.approveRenewal(renewalReq.id)
  ]);

  const renewalSuccesses = renewalResults.filter(r => r.status === 'fulfilled').length;
  const renewalFailures = renewalResults.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
  if (renewalSuccesses === 0) {
    console.error('All renewals failed:', renewalFailures.map(r => r.reason.message));
  }
  assertCondition(renewalSuccesses === 1, `Exactly one renewal approval succeeded (got ${renewalSuccesses})`);
  
  const schedulesAfterRenewal = await db.query.rentSchedules.findMany({ where: eq(rentSchedules.leaseId, leaseObj.id) });
  assertCondition(schedulesAfterRenewal.length === 18, `Exactly 18 schedules exist after concurrent renewals (got ${schedulesAfterRenewal.length})`);

  // CONCURRENCY B: Move-Out
  console.log('\n--- CONCURRENCY: MOVE-OUT ---');
  await tenantRepository.requestMoveOut(tenantId, { propertyId: propId, leaseId: leaseObj.id, requestedMoveOutDate: new Date().toISOString() });
  const [moveOutReq] = await db.query.moveOutRequests.findMany({ where: eq(moveOutRequests.leaseId, leaseObj.id) });

  const moveOutResults = await Promise.allSettled([
    leaseRepository.approveMoveOut(moveOutReq.id),
    leaseRepository.approveMoveOut(moveOutReq.id),
    leaseRepository.approveMoveOut(moveOutReq.id)
  ]);

  const moveOutSuccesses = moveOutResults.filter(r => r.status === 'fulfilled').length;
  assertCondition(moveOutSuccesses === 1, `Exactly one move-out approval succeeded (got ${moveOutSuccesses})`);
  
  const finalLease = await db.query.leases.findFirst({ where: eq(leases.id, leaseObj.id) });
  assertCondition(finalLease!.status === 'TERMINATED', `Lease is TERMINATED`);

  // ADVERSARIAL: Renew a terminated lease
  console.log('\n--- ADVERSARIAL: TERMINATED LEASE ---');
  await tenantRepository.requestLeaseRenewal(tenantId, { propertyId: propId, leaseId: leaseObj.id, proposedStartDate: leaseObj.endDate, proposedEndDate: propEndDate.toISOString(), proposedRentAmount: 1100000 });
  const [badRenewalReq] = await db.query.leaseRenewals.findMany({ where: and(eq(leaseRenewals.leaseId, leaseObj.id), eq(leaseRenewals.status, 'REQUESTED')) });
  
  let renewTerminatedSuccess = false;
  try {
    await leaseRepository.approveRenewal(badRenewalReq.id);
    renewTerminatedSuccess = true;
  } catch(e) {}
  assertCondition(!renewTerminatedSuccess, `Cannot approve renewal on a TERMINATED lease`);

  console.log(`\nTests completed. Passed: ${passed}, Failed: ${failed}`);
  process.exit(0);
}

runTests().catch(console.error);
