import assert from 'assert';
import { db } from '../src/db/index.js';
import { 
  users, organizations, properties, leases, rentSchedules, 
  paymentRecords, journalEntries, ledgerLines, commissions 
} from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { commissionService } from '../src/server/services/commission.js';

async function setupTestData() {
  // Create Owner
  const [owner] = await db.insert(users).values({
    email: `owner-${Date.now()}@test.com`,
    firstName: 'Test', lastName: 'Owner', roles: ['owner'], status: 'ACTIVE'
  }).returning();

  // Create Agent Org
  const [agentOrg] = await db.insert(organizations).values({
    name: 'Test Agent Org', type: 'AGENCY', status: 'VERIFIED'
  }).returning();

  // Create Tenant
  const [tenant] = await db.insert(users).values({
    email: `tenant-${Date.now()}@test.com`,
    firstName: 'Test', lastName: 'Tenant', roles: ['tenant'], status: 'ACTIVE'
  }).returning();

  return { owner, agentOrg, tenant };
}

async function createPropertyAndPayment(
  ownerId: string, 
  agentOrgId: string, 
  tenantId: string,
  model: 'FULLY_MANAGED' | 'AGENT_LISTED_PLATFORM_MANAGED' | 'AGENT_OPERATED'
) {
  // Create Property
  const [prop] = await db.insert(properties).values({
    name: `Test Prop ${model}`,
    type: 'Apartment',
    operatingModel: model,
    listedByAgentId: model !== 'FULLY_MANAGED' ? agentOrgId : null,
    managedByAgentId: model === 'AGENT_OPERATED' ? agentOrgId : null,
    rentFee: '0.05', // 5%
    managementFee: '0.10', // 10%
  }).returning();

  // Create Lease
  const [lease] = await db.insert(leases).values({
    propertyId: prop.id,
    tenantId: tenantId,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 31536000000).toISOString(),
    rentAmount: '1000000',
    status: 'ACTIVE'
  }).returning();

  // Create Rent Schedule
  const [schedule] = await db.insert(rentSchedules).values({
    leaseId: lease.id,
    propertyId: prop.id,
    tenantId: tenantId,
    amount: '1000000',
    dueDate: new Date().toISOString(),
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
    status: 'PAID'
  }).returning();

  // Create Payment Record (CONFIRMED)
  const [payment] = await db.insert(paymentRecords).values({
    propertyId: prop.id,
    leaseId: lease.id,
    rentScheduleId: schedule.id,
    payerId: tenantId,
    amount: '1000000',
    status: 'CONFIRMED',
    recordedDate: new Date().toISOString(),
    idempotencyKey: `test_payment_${prop.id}`
  }).returning();

  return { prop, payment };
}

async function runTests() {
  try {
    const { owner, agentOrg, tenant } = await setupTestData();

    console.log('--- SUITE: FULLY_MANAGED ---');
    const fm = await createPropertyAndPayment(owner.id, agentOrg.id, tenant.id, 'FULLY_MANAGED');
    await commissionService.postCommissionForPayment(fm.payment.id, owner.id);
    
    const fmLedger = await db.select().from(ledgerLines).innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id)).where(eq(journalEntries.referenceId, fm.payment.id));
    
    let fmPlatform = 0, fmRent = 0, fmMgmt = 0;
    fmLedger.forEach(l => {
      if (l.ledger_lines.accountId === '4010') fmPlatform += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4011') fmRent += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4012') fmMgmt += Number(l.ledger_lines.credit);
    });
    assert(fmPlatform > 0, 'Platform Fee should be present');
    assert(fmRent === 50000, 'Rent Fee should be 50000');
    assert(fmMgmt === 100000, 'Management Fee should be 100000');
    console.log('✅ FULLY_MANAGED correctly allocated Platform + Rent + Management fees.');


    console.log('--- SUITE: AGENT_LISTED_PLATFORM_MANAGED ---');
    const al = await createPropertyAndPayment(owner.id, agentOrg.id, tenant.id, 'AGENT_LISTED_PLATFORM_MANAGED');
    await commissionService.postCommissionForPayment(al.payment.id, owner.id);
    
    const alLedger = await db.select().from(ledgerLines).innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id)).where(eq(journalEntries.referenceId, al.payment.id));
    
    let alPlatform = 0, alRent = 0, alMgmt = 0;
    alLedger.forEach(l => {
      if (l.ledger_lines.accountId === '4010') alPlatform += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4011') alRent += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4012') alMgmt += Number(l.ledger_lines.credit);
    });
    assert(alPlatform > 0, 'Platform Fee should be present');
    assert(alRent === 0, 'Rent Fee should NOT be allocated');
    assert(alMgmt === 100000, 'Management Fee should be 100000');
    console.log('✅ AGENT_LISTED_PLATFORM_MANAGED correctly allocated Platform + Management (No Rent Fee).');


    console.log('--- SUITE: AGENT_OPERATED ---');
    const ao = await createPropertyAndPayment(owner.id, agentOrg.id, tenant.id, 'AGENT_OPERATED');
    await commissionService.postCommissionForPayment(ao.payment.id, owner.id);
    
    const aoLedger = await db.select().from(ledgerLines).innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id)).where(eq(journalEntries.referenceId, ao.payment.id));
    
    let aoPlatform = 0, aoRent = 0, aoMgmt = 0;
    aoLedger.forEach(l => {
      if (l.ledger_lines.accountId === '4010') aoPlatform += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4011') aoRent += Number(l.ledger_lines.credit);
      if (l.ledger_lines.accountId === '4012') aoMgmt += Number(l.ledger_lines.credit);
    });
    assert(aoPlatform > 0, 'Platform Fee should be present');
    assert(aoRent === 0, 'Rent Fee should NOT be allocated');
    assert(aoMgmt === 0, 'Management Fee should NOT be allocated');
    console.log('✅ AGENT_OPERATED correctly allocated ONLY Platform Fee.');


    console.log('✅ All Operating Model tests passed!');
  } catch (error) {
    console.error('❌ Operating Model test failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
