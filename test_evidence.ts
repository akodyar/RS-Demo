import { db } from './src/db/index.js';
import { properties, ownershipRecords, managementAgreements, users, organizations, listings, paymentRecords, commissions, journalEntries, ledgerLines, leases, units } from './src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { commissionService } from './src/server/services/commission.js';

async function testAuthMatrix() {
  console.log("=== GATE 1, 2, 4: AUTHORIZATION MATRIX ===");
  
  const tokens = {
    owner: 'dev-owner', // user_owner_01
    companyAuth: 'dev-company', // org_company_01
    companyUnauth: 'dev-company-b', // org_company_02
    tenant: 'dev-tenant', // user_tenant_01
    unrelatedOwner: 'dev-owner-b', // user_owner_02
  };

  const createProp = async (token, body) => {
    return await fetch('http://localhost:3000/api/properties', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  };

  // Case A: Owner self-create
  let res = await createProp(tokens.owner, { name: "Test Prop A", type: "RESIDENTIAL", address: {}, listingType: "NONE", ownerType: "INDIVIDUAL" });
  console.log("Case A (Owner self-create):", res.status, await res.text());
  
  // Case B: Owner assigning to another owner
  let resB = await createProp(tokens.owner, { name: "Test Prop B", type: "RESIDENTIAL", address: {}, listingType: "NONE", ownerType: "INDIVIDUAL", ownerId: "user_owner_02" });
  console.log("Case B (Owner cross-assign):", resB.status, await resB.text());
  
  // Case C: Company with no management authority
  // Since company tries to create property for someone else without CRM or Mgmt authority
  res = await createProp(tokens.companyUnauth, { name: "Test Prop C", type: "RESIDENTIAL", address: {}, listingType: "NONE", ownerType: "COMPANY", companyId: "org_company_02" });
  console.log("Case C (Company self-create):", res.status, await res.text());

  // Tenant property creation
  res = await createProp(tokens.tenant, { name: "Test Prop Tenant", type: "RESIDENTIAL", address: {}, listingType: "NONE", ownerType: "INDIVIDUAL", ownerId: "user_tenant_01" });
  console.log("Case K (Tenant create):", res.status, await res.text());
}

async function testFinancialSnapshot() {
  console.log("=== GATE 6: FINANCIAL SNAPSHOT & REVERSAL ===");
  
  // 1. Create a dummy payment
  const [prop] = await db.insert(properties).values({ name: 'FinTest Prop', type: 'RESIDENTIAL', status: 'ACTIVE', operatingModel: 'FULLY_MANAGED', rentFee: '0.05', managementFee: '0.1' }).returning();
  
  const [payment] = await db.insert(paymentRecords).values({
    propertyId: prop.id,
    amount: '1000',
    currency: 'USD',
    status: 'RECORDED',
    payerId: 'user_tenant_01',
    dueDate: new Date().toISOString(),
    paymentMethod: 'CASH',
    recordedDate: new Date().toISOString()
  }).returning();

  console.log("Payment created:", payment.id);

  // 2. Fetch current policy
  const { financialPolicies } = await import('./src/db/schema.js');
  const currentPlatformFeeRate = await db.query.financialPolicies.findFirst({ where: eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE') });
  
  // Confirm payment via API using company auth
  let res = await fetch(`http://localhost:3000/api/leases/payments/${payment.id}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer dev-super-admin` }
  });
  console.log("Confirm Payment 1 status:", res.status);
  let json = await res.json();
  console.log("Commission recorded:", json.commission?.commissionAmount);
  
  const comm = await db.query.commissions.findFirst({ where: eq(commissions.paymentRecordId, payment.id) });
  console.log("Commission DB record:", comm?.commissionAmount);

  // Reversal
  res = await fetch(`http://localhost:3000/api/leases/payments/${payment.id}/reverse`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer dev-super-admin`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: "Testing reversal" })
  });
  console.log("Reverse Payment 1 status:", res.status);

  const reversalJE = await db.query.journalEntries.findFirst({ where: eq(journalEntries.referenceType, 'FEE_REVERSAL') });
  console.log("Reversal Journal Entry exists:", !!reversalJE);
}

async function run() {
  try {
    await testAuthMatrix();
    await testFinancialSnapshot();
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
