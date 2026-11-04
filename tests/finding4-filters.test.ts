import { injectPgliteMock } from './setup-pglite.js';
import { db } from '../src/db/index.js';
import { commissions, paymentRecords, properties, users, organizations } from '../src/db/schema.js';
import { commissionService } from '../src/server/services/commission.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, description: string) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`);
    failed++;
  }
}

async function runFinding4() {
  console.log('================================================================');
  console.log('  FINDING 4 — COMMISSION SUMMARY FILTER RUNTIME TEST (REAL DB)');
  console.log('================================================================\n');

  await injectPgliteMock();
  
  // Seed the DB with real records
  await db.insert(users).values([
    { id: 'owner_A', uid: 'uid_A', email: 'ownerA@test.com', firstName: 'Owner', lastName: 'A', roles: ['PROPERTY_OWNER'] },
    { id: 'owner_B', uid: 'uid_B', email: 'ownerB@test.com', firstName: 'Owner', lastName: 'B', roles: ['PROPERTY_OWNER'] }
  ]).onConflictDoNothing();

  await db.insert(organizations).values([
    { id: 'comp_A', name: 'Company A', type: 'PROPERTY_MANAGEMENT' },
    { id: 'comp_B', name: 'Company B', type: 'PROPERTY_MANAGEMENT' }
  ]).onConflictDoNothing();

  await db.insert(properties).values([
    { id: 'prop_A', name: 'Prop A', type: 'APARTMENT', status: 'AVAILABLE', acquisitionCost: '1000' },
    { id: 'prop_B', name: 'Prop B', type: 'VILLA', status: 'AVAILABLE', acquisitionCost: '2000' }
  ]).onConflictDoNothing();

  await db.insert(paymentRecords).values([
    { id: 'pay_1', propertyId: 'prop_A', payerId: 'owner_A', amount: '1000', currency: 'IQD', status: 'CONFIRMED', recordedDate: new Date().toISOString() },
    { id: 'pay_2', propertyId: 'prop_B', payerId: 'owner_B', amount: '2000', currency: 'IQD', status: 'CONFIRMED', recordedDate: new Date().toISOString() },
    { id: 'pay_3', propertyId: 'prop_A', payerId: 'owner_A', amount: '500', currency: 'IQD', status: 'CONFIRMED', recordedDate: new Date().toISOString() }
  ]).onConflictDoNothing();

  await db.insert(commissions).values([
    { id: 'comm_1', paymentRecordId: 'pay_1', propertyId: 'prop_A', tenantId: 'owner_A', ownerId: 'owner_A', companyId: 'comp_A', commissionType: 'RENT_MANAGEMENT', rate: '0.05', baseAmount: '1000', commissionAmount: '50', currency: 'IQD', status: 'POSTED', policyVersion: 'v1.0' },
    { id: 'comm_2', paymentRecordId: 'pay_2', propertyId: 'prop_B', tenantId: 'owner_B', ownerId: 'owner_B', companyId: 'comp_B', commissionType: 'RENT_MANAGEMENT', rate: '0.05', baseAmount: '2000', commissionAmount: '100', currency: 'IQD', status: 'POSTED', policyVersion: 'v1.0' },
    { id: 'comm_3', paymentRecordId: 'pay_3', propertyId: 'prop_A', tenantId: 'owner_A', ownerId: 'owner_A', companyId: 'comp_A', commissionType: 'RENT_MANAGEMENT', rate: '0.05', baseAmount: '500', commissionAmount: '25', currency: 'IQD', status: 'POSTED', policyVersion: 'v1.0' }
  ]).onConflictDoNothing();

  // 1. Property A filter -> A only
  const resPropA = await commissionService.getCommissionSummary({ propertyId: 'prop_A' });
  assert(
    resPropA.recordsCount === 2 && resPropA.totalHomeHubFees === 75,
    'FINDING-04-01',
    'Property A filter -> A only'
  );

  // 2. Property B filter -> B only
  const resPropB = await commissionService.getCommissionSummary({ propertyId: 'prop_B' });
  assert(
    resPropB.recordsCount === 1 && resPropB.totalHomeHubFees === 100,
    'FINDING-04-02',
    'Property B filter -> B only'
  );

  // 3. Owner A filter -> A only
  const resOwnerA = await commissionService.getCommissionSummary({ ownerId: 'owner_A' });
  assert(
    resOwnerA.recordsCount === 2 && resOwnerA.totalHomeHubFees === 75,
    'FINDING-04-03',
    'Owner A filter -> A only'
  );

  // 4. Company A filter -> A only
  const resCompA = await commissionService.getCommissionSummary({ companyId: 'comp_A' });
  assert(
    resCompA.recordsCount === 2 && resCompA.totalHomeHubFees === 75,
    'FINDING-04-04',
    'Company A filter -> A only'
  );
  
  // 5. Combined filters -> correct intersection (Owner A + Property B -> no payments)
  const resCombined1 = await commissionService.getCommissionSummary({ ownerId: 'owner_A', propertyId: 'prop_B' });
  assert(
    resCombined1.recordsCount === 0 && resCombined1.totalHomeHubFees === 0,
    'FINDING-04-05',
    'Combined filters (Owner A + Property B) -> Empty intersection'
  );

  // 6. Combined filters -> correct intersection (Company B + Property B -> B payments)
  const resCombined2 = await commissionService.getCommissionSummary({ companyId: 'comp_B', propertyId: 'prop_B' });
  assert(
    resCombined2.recordsCount === 1 && resCombined2.totalHomeHubFees === 100,
    'FINDING-04-06',
    'Combined filters (Company B + Property B) -> Valid intersection'
  );

  // 7. Unauthorized organization -> denied (Simulate what auth would do by filtering on unauth company)
  const resUnauthorized = await commissionService.getCommissionSummary({ companyId: 'comp_UNAUTH' });
  assert(
    resUnauthorized.recordsCount === 0 && resUnauthorized.totalHomeHubFees === 0,
    'FINDING-04-07',
    'Unauthorized/Unrelated organization filter -> Empty result'
  );

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('✅ ALL FINDING 4 TESTS PASSED (REAL DB).');
  } else {
    process.exit(1);
  }
}

runFinding4().catch(e => {
  console.error(e);
  process.exit(1);
});
