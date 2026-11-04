import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { users, organizations, properties, units, leases, rentSchedules, paymentRecords, commissions, journalEntries, ledgerLines, financialPolicies, ownershipRecords, managementAgreements, leaseTenants, moveOutRequests, leaseRenewals, organizationMembers } from '../src/db/schema.js';
import { companyRepository } from '../src/server/repositories/company.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { Permission, LeaseStatus } from '../src/types/index.js';

const TIMESTAMP = Date.now();
const ID_PREFIX = `step17_${TIMESTAMP}`;

async function runTests() {
  console.log(`\n=== STARTING STEP 17 COMPANY DASHBOARD & REGRESSION ===\n`);
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
  const companyId = `${ID_PREFIX}_company`;
  
  await db.insert(users).values([
    { id: `${ID_PREFIX}_owner`, email: `${ID_PREFIX}_owner@example.com`, firstName: 'Owner', lastName: 'User', roles: ['PROPERTY_OWNER'] },
    { id: `${ID_PREFIX}_user_A`, email: `${ID_PREFIX}_user_A@example.com`, firstName: 'A', lastName: 'User', roles: ['COMPANY_ADMIN'] },
    { id: `${ID_PREFIX}_tenant`, email: `${ID_PREFIX}_tenant@example.com`, firstName: 'T', lastName: 'User', roles: ['TENANT'] }
  ]);

  await db.insert(organizations).values([
    { id: companyId, name: 'Company C', type: 'PROPERTY_MANAGEMENT' },
    { id: `${ID_PREFIX}_other_company`, name: 'Company D', type: 'PROPERTY_MANAGEMENT' }
  ]);

  await db.insert(organizationMembers).values([
    { organizationId: companyId, userId: `${ID_PREFIX}_user_A`, role: 'ADMIN', status: 'ACTIVE' }
  ]);

  // Insert Properties A and B
  const propAId = `${ID_PREFIX}_propA`;
  const propBId = `${ID_PREFIX}_propB`;
  
  await db.insert(properties).values([
    { id: propAId, name: 'Prop A', type: 'RESIDENTIAL', status: 'AVAILABLE' },
    { id: propBId, name: 'Prop B', type: 'RESIDENTIAL', status: 'AVAILABLE' }
  ]);

  // Insert Units
  // Prop A gets Units 1-6
  await db.insert(units).values([
    { id: `${propAId}_u1`, propertyId: propAId, unitNumber: '1', status: 'AVAILABLE' },
    { id: `${propAId}_u2`, propertyId: propAId, unitNumber: '2', status: 'AVAILABLE' },
    { id: `${propAId}_u3`, propertyId: propAId, unitNumber: '3', status: 'AVAILABLE' },
    { id: `${propAId}_u4`, propertyId: propAId, unitNumber: '4', status: 'AVAILABLE' },
    { id: `${propAId}_u5`, propertyId: propAId, unitNumber: '5', status: 'OCCUPIED' }, // Case E
    { id: `${propAId}_u6`, propertyId: propAId, unitNumber: '6', status: 'AVAILABLE' }  // Case F
  ]);

  // Prop B gets Unit 1
  await db.insert(units).values([
    { id: `${propBId}_u1`, propertyId: propBId, unitNumber: '1', status: 'AVAILABLE' }
  ]);

  await db.insert(managementAgreements).values([
    { id: `${ID_PREFIX}_mgmtA`, propertyId: propAId, companyId: companyId, ownerId: `${ID_PREFIX}_owner`, status: 'ACTIVE', startDate: new Date().toISOString(), grantedPermissions: [Permission.MANAGE_LEASES] }
  ]);

  // Case A: Unit 1 has ACTIVE lease
  await leaseRepository.createLease(propAId, `${propAId}_u1`, [`${ID_PREFIX}_tenant`], new Date().toISOString(), new Date().toISOString(), 100);
  await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.unitId, `${propAId}_u1`));

  // Case B: Unit 2 has no lease (setup above)

  // Case C: Unit 3 has TERMINATED lease
  await leaseRepository.createLease(propAId, `${propAId}_u3`, [`${ID_PREFIX}_tenant`], new Date().toISOString(), new Date().toISOString(), 100);
  await db.update(leases).set({ status: 'TERMINATED' }).where(eq(leases.unitId, `${propAId}_u3`));

  // Case D: Unit 4 has EXPIRED lease (status EXPIRED not explicitly in enum, let's use TERMINATED or just end date past. We'll use TERMINATED since enum only has ACTIVE/TERMINATED/etc)
  await leaseRepository.createLease(propAId, `${propAId}_u4`, [`${ID_PREFIX}_tenant`], new Date().toISOString(), new Date().toISOString(), 100);
  await db.update(leases).set({ status: 'TERMINATED' }).where(eq(leases.unitId, `${propAId}_u4`));

  // Case E: Unit 5 has static OCCUPIED but no active lease
  
  // Case F: Unit 6 has static AVAILABLE but ACTIVE lease
  await leaseRepository.createLease(propAId, `${propAId}_u6`, [`${ID_PREFIX}_tenant`], new Date().toISOString(), new Date().toISOString(), 100);
  await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.unitId, `${propAId}_u6`));

  // Verify dashboard
  console.log('\n--- VERIFY COMPANY DASHBOARD ---');
  const dashA = await companyRepository.getManagedProperties(companyId, `${ID_PREFIX}_user_A`, 'COMPANY_ADMIN');
  
  // Company A should only see Prop A (Case I)
  assertCondition(dashA.length === 1 && dashA[0].id === propAId, `Company only sees authorized Property A`);
  
  const propADash = dashA[0];
  assertCondition(propADash.unitsCount === 6, `Property A has 6 units`);
  assertCondition(propADash.occupiedUnitsCount === 2, `Property A has exactly 2 occupied units (Case A and Case F)`);
  assertCondition(propADash.activeLeasesCount === 2, `Property A has exactly 2 active leases`);

  // Verify unrelated company (Case J)
  const dashOther = await companyRepository.getManagedProperties(`${ID_PREFIX}_other_company`, 'user', 'COMPANY_ADMIN');
  assertCondition(dashOther.length === 0, `Unrelated company sees no occupancy data`);

  // Verify Single-unit logic
  const propSingleId = `${ID_PREFIX}_propS`;
  await db.insert(properties).values({ id: propSingleId, name: 'Prop S', type: 'RESIDENTIAL', status: 'AVAILABLE' });
  await db.insert(managementAgreements).values({ id: `${ID_PREFIX}_mgmtS`, propertyId: propSingleId, companyId: companyId, ownerId: `${ID_PREFIX}_owner`, status: 'ACTIVE', startDate: new Date().toISOString(), grantedPermissions: [] });
  await leaseRepository.createLease(propSingleId, null, [`${ID_PREFIX}_tenant`], new Date().toISOString(), new Date().toISOString(), 100);
  await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.propertyId, propSingleId));

  const dashWithSingle = await companyRepository.getManagedProperties(companyId, `${ID_PREFIX}_user_A`, 'COMPANY_ADMIN');
  const singleDash = dashWithSingle.find(p => p.id === propSingleId);
  assertCondition(singleDash!.unitsCount === 0, `Single property has 0 units`);
  assertCondition(singleDash!.occupiedUnitsCount === 1, `Single property is 1 occupied based on active lease`);

  // Cleanup
  console.log('\n--- Cleanup ---');
  await db.delete(leases).where(inArray(leases.propertyId, [propAId, propBId, propSingleId]));
  await db.delete(units).where(inArray(units.propertyId, [propAId, propBId, propSingleId]));
  await db.delete(managementAgreements).where(inArray(managementAgreements.propertyId, [propAId, propBId, propSingleId]));
  await db.delete(properties).where(inArray(properties.id, [propAId, propBId, propSingleId]));
  await db.delete(organizations).where(inArray(organizations.id, [companyId, `${ID_PREFIX}_other_company`]));
  await db.delete(users).where(inArray(users.id, [`${ID_PREFIX}_owner`, `${ID_PREFIX}_user_A`, `${ID_PREFIX}_tenant`]));
  
  console.log(`\nTests completed. Passed: ${passed}, Failed: ${failed}`);
  process.exit(0);
}

runTests().catch(console.error);
