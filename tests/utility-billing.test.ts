import assert from 'assert';
import { db } from '../src/db/index.js';
import { utilityBills, utilityPayments, users, properties, ownershipRecords, agentPropertyAssignments } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { utilityBillRepository } from '../src/server/repositories/utility-bills.js';
import { agentRepository } from '../src/server/repositories/agent.js';
import { ownerRepository } from '../src/server/repositories/owner.js';

async function createTestUser(email: string, roles: string[]) {
  const [user] = await db.insert(users).values({
    email,
    firstName: 'Test',
    lastName: 'User',
    roles,
    status: 'ACTIVE',
  }).returning();
  return user.id;
}

async function runTests() {
  console.log('Starting Utility Billing Test Suite...');
  try {
    const adminId = await createTestUser(`admin-${Date.now()}@test.com`, ['PLATFORM_ADMIN']);
    const ownerAId = await createTestUser(`ownera-${Date.now()}@test.com`, ['OWNER']);
    const ownerBId = await createTestUser(`ownerb-${Date.now()}@test.com`, ['OWNER']);
    const tenantAId = await createTestUser(`tenanta-${Date.now()}@test.com`, ['TENANT']);
    const tenantBId = await createTestUser(`tenantb-${Date.now()}@test.com`, ['TENANT']);
    const agentAId = await createTestUser(`agenta-${Date.now()}@test.com`, ['AGENT']);
    const agentBId = await createTestUser(`agentb-${Date.now()}@test.com`, ['AGENT']);

    const [propA] = await db.insert(properties).values({ name: 'Prop A', type: 'Apartment' }).returning();
    const [propB] = await db.insert(properties).values({ name: 'Prop B', type: 'Apartment' }).returning();

    await db.insert(ownershipRecords).values([
      { propertyId: propA.id, ownerId: ownerAId, status: 'VERIFIED', ownershipPercentage: '100' },
      { propertyId: propB.id, ownerId: ownerBId, status: 'VERIFIED', ownershipPercentage: '100' },
    ]);

    await db.insert(agentPropertyAssignments).values([
      { propertyId: propA.id, userId: agentAId, assignedBy: adminId, status: 'ACTIVE', permissions: [] }
    ]);

    // A. Bill Creation
    const bill1 = await utilityBillRepository.createBill({
      propertyId: propA.id,
      tenantId: tenantAId,
      type: 'WATER',
      amount: 100,
      billingDate: new Date().toISOString(),
    }, adminId);
    
    assert(bill1.status === 'UNPAID', 'New bill should be UNPAID');
    assert(bill1.outstandingAmount === '100', 'Outstanding amount should be full');
    console.log('✅ A. Bill creation verified');

    // B. Tenant Visibility
    const tenantABills = await utilityBillRepository.getTenantBills(tenantAId);
    assert(tenantABills.length === 1 && tenantABills[0].id === bill1.id, 'Tenant A sees their bill');
    const tenantBBills = await utilityBillRepository.getTenantBills(tenantBId);
    assert(tenantBBills.length === 0, 'Tenant B does not see Tenant A bills');
    console.log('✅ B. Tenant visibility verified');

    // C. Direct Payment & Rejection of invalid amount
    try {
      await utilityBillRepository.payBill(bill1.id, 200, 'SYSTEM', tenantAId);
      throw new Error('Should have rejected overpayment');
    } catch (e: any) {
      assert(e.message === 'Payment exceeds outstanding amount', 'Overpayment correctly rejected');
    }

    // F. Partial Payment
    await utilityBillRepository.payBill(bill1.id, 40, 'SYSTEM', tenantAId);
    const [partialBill] = await db.select().from(utilityBills).where(eq(utilityBills.id, bill1.id));
    assert(partialBill.status === 'PARTIAL', 'Status should be PARTIAL');
    assert(partialBill.outstandingAmount === '60', 'Outstanding amount should be 60');
    console.log('✅ F. Partial payment verified');

    // D. Cash Collection (HomeHub Admin)
    await utilityBillRepository.payBill(bill1.id, 60, 'CASH', tenantAId, adminId);
    const [paidBill] = await db.select().from(utilityBills).where(eq(utilityBills.id, bill1.id));
    assert(paidBill.status === 'PAID', 'Status should be PAID');
    assert(paidBill.outstandingAmount === '0', 'Outstanding amount should be 0');
    
    // G. Full payment drops it from unpaid query
    const unpaidA = await utilityBillRepository.getOwnerPropertyBills(propA.id, ownerAId);
    assert(unpaidA.length === 0, 'Paid bills should not appear in unpaid query');
    console.log('✅ D & G. Cash collection (Admin) and Full Payment verified');

    // E. Agent Cash Collection
    const bill2 = await utilityBillRepository.createBill({
      propertyId: propA.id,
      tenantId: tenantAId,
      type: 'ELECTRICITY',
      amount: 50,
      billingDate: new Date().toISOString(),
    }, adminId);

    // Agent B (unrelated) tries to collect
    const agentBAssigned = await agentRepository.getAssignedPropertyIds(agentBId);
    assert(!agentBAssigned.includes(bill2.propertyId), 'Agent B should have no access');
    
    // Agent A (authorized) collects
    const agentAAssigned = await agentRepository.getAssignedPropertyIds(agentAId);
    assert(agentAAssigned.includes(bill2.propertyId), 'Agent A should have access');
    await utilityBillRepository.payBill(bill2.id, 50, 'CASH', tenantAId, agentAId);
    console.log('✅ E. Agent employee cash collection verified');

    // H. Owner Visibility & Cross-Owner Isolation
    const bill3 = await utilityBillRepository.createBill({
      propertyId: propA.id,
      tenantId: tenantAId,
      type: 'OTHER',
      amount: 25,
      billingDate: new Date().toISOString(),
    }, adminId);

    const ownerAUnpaid = await utilityBillRepository.getOwnerPropertyBills(propA.id, ownerAId);
    assert(ownerAUnpaid.length === 1 && ownerAUnpaid[0].id === bill3.id, 'Owner A sees their unpaid bill');
    
    const ownerBAccessList = await ownerRepository.getAuthorizedPropertyAccess({ id: ownerBId, roles: ['OWNER'] });
    const ownerBAccess = ownerBAccessList.some(a => a.propertyId === propA.id);
    assert(!ownerBAccess, 'Owner B isolated from Owner A properties');
    console.log('✅ H. Owner visibility & isolation verified');

    // L. Audit Trail
    const payments = await db.select().from(utilityPayments).where(inArray(utilityPayments.billId, [bill1.id, bill2.id, bill3.id]));
    assert(payments.length === 3, 'All payments recorded');
    console.log('✅ L. Audit Trail and Payment Persistence verified');

    console.log('====================================');
    console.log('ALL UTILITY BILLING TESTS PASSED SUCCESSFULLY');
    console.log('====================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Utility Billing test failed:', error);
    process.exit(1);
  }
}

runTests();
