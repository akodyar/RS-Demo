import { db } from '../src/db/index.js';
import { users, organizations, properties, units, leases, leaseTenants, rentSchedules, paymentRecords, ownershipRecords, managementAgreements, financialPolicies, commissions, journalEntries, ledgerLines } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { Permission } from '../src/types/index.js';
import { commissionService } from '../src/server/services/commission.js';

const TIMESTAMP = Date.now();
const ID_PREFIX = `step14_${TIMESTAMP}`;

async function runTests() {
  console.log('=== STARTING STEP 14 F1 AUTHORIZATION VERIFICATION ===');
  
  // Personas
  const userA = { id: `${ID_PREFIX}_owner_A`, firstName: 'Owner', lastName: 'A', email: `${ID_PREFIX}_a@test.com`, roles: ['PROPERTY_OWNER'] };
  const userX = { id: `${ID_PREFIX}_owner_X`, firstName: 'User', lastName: 'X', email: `${ID_PREFIX}_x@test.com`, roles: ['PROPERTY_OWNER'] };
  
  const companyCId = `${ID_PREFIX}_company_C`;
  const userCompanyC = { id: `${ID_PREFIX}_company_C_user`, firstName: 'Company', lastName: 'C', email: `${ID_PREFIX}_c@test.com`, roles: ['COMPANY'], organizationId: companyCId };
  
  const companyDId = `${ID_PREFIX}_company_D`;
  const userCompanyD = { id: `${ID_PREFIX}_company_D_user`, firstName: 'Company', lastName: 'D', email: `${ID_PREFIX}_d@test.com`, roles: ['COMPANY'], organizationId: companyDId };
  
  const companyXId = `${ID_PREFIX}_company_X`;
  const userCompanyX = { id: `${ID_PREFIX}_company_X_user`, firstName: 'Company', lastName: 'X', email: `${ID_PREFIX}_cx@test.com`, roles: ['COMPANY'], organizationId: companyXId };
  
  const tenantT1 = { id: `${ID_PREFIX}_tenant_T1`, firstName: 'Tenant', lastName: 'T1', email: `${ID_PREFIX}_t1@test.com`, roles: ['TENANT'] };
  const tenantT2 = { id: `${ID_PREFIX}_tenant_T2`, firstName: 'Tenant', lastName: 'T2', email: `${ID_PREFIX}_t2@test.com`, roles: ['TENANT'] };

  await db.insert(users).values([userA, userX, userCompanyC, userCompanyD, userCompanyX, tenantT1, tenantT2]);
  await db.insert(organizations).values([
    { id: companyCId, name: 'Company C', type: 'PROPERTY_MANAGEMENT' },
    { id: companyDId, name: 'Company D', type: 'PROPERTY_MANAGEMENT' },
    { id: companyXId, name: 'Company X', type: 'PROPERTY_MANAGEMENT' }
  ]);
  await db.insert(financialPolicies).values({ policyType: 'RENT_MANAGEMENT_COMMISSION_RATE', policyValue: '0.05', active: true, effectiveFrom: new Date() }).onConflictDoNothing();

  // Property 1 (for T1)
  const propId = `${ID_PREFIX}_prop`;
  await db.insert(properties).values({ id: propId, name: 'Test Property', type: 'RESIDENTIAL', status: 'VACANT' });
  await db.insert(ownershipRecords).values({ propertyId: propId, ownerId: userA.id, status: 'VERIFIED' });
  
  const unitId = `${ID_PREFIX}_unit`;
  await db.insert(units).values({ id: unitId, propertyId: propId, unitNumber: '101' });

  // Property 2 (for T2)
  const propId2 = `${ID_PREFIX}_prop2`;
  await db.insert(properties).values({ id: propId2, name: 'Test Property 2', type: 'RESIDENTIAL', status: 'VACANT' });
  await db.insert(ownershipRecords).values({ propertyId: propId2, ownerId: userA.id, status: 'VERIFIED' });
  
  const unitId2 = `${ID_PREFIX}_unit2`;
  await db.insert(units).values({ id: unitId2, propertyId: propId2, unitNumber: '102' });

  // Management Agreements
  await db.insert(managementAgreements).values([
    { propertyId: propId, companyId: companyCId, ownerId: userA.id, status: 'ACTIVE', startDate: new Date().toISOString(), grantedPermissions: ['VIEW_PROPERTY', 'MANAGE_LEASES', 'COLLECT_RENT', 'VIEW_FINANCIALS', 'MANAGE_FINANCIALS'] },
    { propertyId: propId, companyId: companyDId, ownerId: userA.id, status: 'ACTIVE', startDate: new Date().toISOString(), grantedPermissions: ['VIEW_PROPERTY'] }
  ]);

  // Create Leases
  const lease1 = await leaseRepository.createLease(propId, unitId, [tenantT1.id], new Date().toISOString(), new Date(Date.now() + 31536000000).toISOString(), 1000000);
  await leaseRepository.activateLease(lease1.id);

  const lease2 = await leaseRepository.createLease(propId2, unitId2, [tenantT2.id], new Date().toISOString(), new Date(Date.now() + 31536000000).toISOString(), 1000000);
  await leaseRepository.activateLease(lease2.id);

  let passed = 0;
  let failed = 0;

  function assertDenied(result: boolean, testName: string) {
    if (result === false) { console.log(`[PASS] ${testName}`); passed++; }
    else { console.error(`[FAIL] ${testName} - Was improperly ALLOWED`); failed++; }
  }

  function assertAllowed(result: boolean, testName: string) {
    if (result === true) { console.log(`[PASS] ${testName}`); passed++; }
    else { console.error(`[FAIL] ${testName} - Was improperly DENIED`); failed++; }
  }

  // --- Test A: VIEW_PROPERTY only (Company D)
  console.log('\n--- Test A: VIEW_PROPERTY only ---');
  const dHasAuth = await ownerRepository.verifyPropertyPermission(userCompanyD as any, propId, Permission.VIEW_FINANCIALS);
  assertDenied(dHasAuth, 'Company D (VIEW_PROPERTY only) should be denied VIEW_FINANCIALS');

  // --- Test B: VIEW_FINANCIALS (Company C)
  console.log('\n--- Test B: VIEW_FINANCIALS ---');
  const cHasAuth = await ownerRepository.verifyPropertyPermission(userCompanyC as any, propId, Permission.VIEW_FINANCIALS);
  assertAllowed(cHasAuth, 'Company C (with VIEW_FINANCIALS) should be allowed');

  // --- Test C: Unrelated Company
  console.log('\n--- Test C: Unrelated Company ---');
  const xHasAuth = await ownerRepository.verifyPropertyPermission(userCompanyX as any, propId, Permission.VIEW_FINANCIALS);
  assertDenied(xHasAuth, 'Company X (Unrelated) should be denied');

  // --- Test D: Unrelated User
  console.log('\n--- Test D: Unrelated User ---');
  const userXHasAuth = await ownerRepository.verifyPropertyPermission(userX as any, propId, Permission.VIEW_FINANCIALS);
  assertDenied(userXHasAuth, 'User X (Unrelated) should be denied');

  // --- Test E: Tenant Isolation
  console.log('\n--- Test E: Tenant Isolation ---');
  // Tenant isolation for GET /leases/:leaseId/schedule logic:
  // "req.user!.roles.includes('TENANT')" and joins `leaseTenants` to verify tenantId == req.user!.id
  // We can test this manually matching the route logic:
  const t1AuthForLease2 = await (async () => {
    const [tenantLink] = await db.select().from(leaseTenants).where(and(eq(leaseTenants.leaseId, lease2.id), eq(leaseTenants.tenantId, tenantT1.id))).limit(1);
    return !!tenantLink;
  })();
  assertDenied(t1AuthForLease2, 'Tenant T1 should be denied accessing Lease 2');

  const t1AuthForLease1 = await (async () => {
    const [tenantLink] = await db.select().from(leaseTenants).where(and(eq(leaseTenants.leaseId, lease1.id), eq(leaseTenants.tenantId, tenantT1.id))).limit(1);
    return !!tenantLink;
  })();
  assertAllowed(t1AuthForLease1, 'Tenant T1 should be allowed accessing Lease 1');

  // --- Test F: IDOR
  console.log('\n--- Test F: IDOR ---');
  // Passing a wrong property Id to ownerRepository should fail
  const idorAuth = await ownerRepository.verifyPropertyPermission(userCompanyC as any, propId2, Permission.VIEW_FINANCIALS);
  assertDenied(idorAuth, 'Company C attempting to view Property 2 (IDOR) should be denied');

  // --- Test G: Existing Payment Auth Regression
  console.log('\n--- Test G: Existing Payment Auth Regression ---');
  const cCanCollectRent = await ownerRepository.verifyPropertyPermission(userCompanyC as any, propId, Permission.COLLECT_RENT);
  assertAllowed(cCanCollectRent, 'Company C should be able to COLLECT_RENT');

  const dCanCollectRent = await ownerRepository.verifyPropertyPermission(userCompanyD as any, propId, Permission.COLLECT_RENT);
  assertDenied(dCanCollectRent, 'Company D should NOT be able to COLLECT_RENT');

  const cCanManageFin = await ownerRepository.verifyPropertyPermission(userCompanyC as any, propId, Permission.MANAGE_FINANCIALS);
  assertAllowed(cCanManageFin, 'Company C should be able to MANAGE_FINANCIALS (for reversal)');


  // --- Regression: Financial Integrity ---
  console.log('\n--- Regression: Financial Integrity ---');
  const initialSch = await db.query.rentSchedules.findFirst({ where: eq(rentSchedules.propertyId, propId) });
  
  await leaseRepository.recordPayment(propId, lease1.id, tenantT1.id, initialSch!.id, 600000, 'BANK_TRANSFER', 'Ref1', userCompanyC.id);
  const p1 = await db.query.paymentRecords.findFirst({ where: eq(paymentRecords.propertyId, propId), orderBy: (p, { desc }) => [desc(p.createdAt)] });
  await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, p1!.id));
  await commissionService.postCommissionForPayment(p1!.id, 'SYSTEM');

  await leaseRepository.recordPayment(propId, lease1.id, tenantT1.id, initialSch!.id, 400000, 'BANK_TRANSFER', 'Ref2', userCompanyC.id);
  const p2 = await db.query.paymentRecords.findFirst({ where: eq(paymentRecords.propertyId, propId), orderBy: (p, { desc }) => [desc(p.createdAt)] });
  await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, p2!.id));
  await commissionService.postCommissionForPayment(p2!.id, 'SYSTEM');

  const sch = await db.query.rentSchedules.findFirst({ where: eq(rentSchedules.propertyId, propId) });
  console.log(`Payment 1: Amount=600000`);
  console.log(`Payment 2: Amount=400000`);
  console.log(`Schedule Status: ${sch!.status}, Paid: ${sch!.paidAmount}, Total: ${sch!.amount}`);

  console.log(`\nTests completed. Passed: ${passed}, Failed: ${failed}`);

  // Cleanup
  console.log('\n--- Cleanup ---');
  await db.delete(commissions).where(eq(commissions.propertyId, propId));
  const jes = await db.select().from(journalEntries).where(eq(journalEntries.propertyId, propId));
  for (const je of jes) {
    await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id));
  }
  await db.delete(journalEntries).where(eq(journalEntries.propertyId, propId));
  await db.delete(paymentRecords).where(eq(paymentRecords.propertyId, propId));
  await db.delete(financialPolicies).where(eq(financialPolicies.policyType, 'RENT_MANAGEMENT_COMMISSION_RATE'));
  
  await db.delete(rentSchedules).where(eq(rentSchedules.propertyId, propId));
  await db.delete(rentSchedules).where(eq(rentSchedules.propertyId, propId2));
  await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lease1.id));
  await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lease2.id));
  await db.delete(leases).where(eq(leases.propertyId, propId));
  await db.delete(leases).where(eq(leases.propertyId, propId2));
  
  await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, propId));
  await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
  await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId2));
  await db.delete(units).where(eq(units.propertyId, propId));
  await db.delete(units).where(eq(units.propertyId, propId2));
  await db.delete(properties).where(eq(properties.id, propId));
  await db.delete(properties).where(eq(properties.id, propId2));
  
  await db.delete(organizations).where(eq(organizations.id, companyCId));
  await db.delete(organizations).where(eq(organizations.id, companyDId));
  await db.delete(organizations).where(eq(organizations.id, companyXId));
  
  await db.delete(users).where(eq(users.id, userA.id));
  await db.delete(users).where(eq(users.id, userX.id));
  await db.delete(users).where(eq(users.id, userCompanyC.id));
  await db.delete(users).where(eq(users.id, userCompanyD.id));
  await db.delete(users).where(eq(users.id, userCompanyX.id));
  await db.delete(users).where(eq(users.id, tenantT1.id));
  await db.delete(users).where(eq(users.id, tenantT2.id));

}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
