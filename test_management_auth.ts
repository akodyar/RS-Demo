import { db } from './src/db/index.js';
import { properties, managementAgreements, users, organizations, leases, paymentRecords } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function testAuthMatrix() {
  console.log("=== SETUP AUTHORITY MATRIX ===");
  // Create a base property
  const [prop] = await db.insert(properties).values({
    name: 'Auth Matrix Prop',
    type: 'RESIDENTIAL',
    status: 'ACTIVE',
    ownerId: 'user_owner_01'
  }).returning();

  const [lease] = await db.insert(leases).values({
    propertyId: prop.id,
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    status: 'ACTIVE',
    rentAmount: '100'
  }).returning();

  const [payment] = await db.insert(paymentRecords).values({
    propertyId: prop.id,
    leaseId: lease.id,
    payerId: 'user_tenant_01',
    amount: '100',
    currency: 'USD',
    status: 'RECORDED',
    recordedDate: new Date().toISOString()
  }).returning();

  const companyHeaders = { 'Authorization': 'Bearer dev-company' };
  
  const clearAgreements = async () => {
    await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, prop.id));
  };

  const createAgreement = async (permissions: string[]) => {
    await clearAgreements();
    await db.insert(managementAgreements).values({
      propertyId: prop.id,
      companyId: 'org_company_01',
      ownerId: 'user_owner_01',
      status: 'ACTIVE',
      grantedPermissions: permissions,
      startDate: new Date().toISOString()
    });
  };

  const tests = [
    { name: "property management", url: `/api/properties/${prop.id}/units`, method: "POST", body: { name: 'Unit 1' } },
    { name: "listing publication", url: `/api/leases/payments/${payment.id}/confirm`, method: "POST", body: {} }, // I'll use confirm for COLLECT_RENT
    // wait, what is the endpoint for listing publication?
    { name: "financial mutation", url: `/api/leases/payments/${payment.id}/reverse`, method: "POST", body: { reason: "test" } },
  ];

  // Helper to test endpoint
  const check = async (caseName: string, permissions: string[], url: string, expectedWord: string, method: string = "POST", body: any = null) => {
    await createAgreement(permissions);
    const res = await fetch(`http://localhost:3000${url}`, { 
      method, 
      headers: { ...companyHeaders, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined 
    });
    const status = res.status;
    const text = await res.text();
    console.log(`${caseName} (${permissions.join(',')} on ${url}): ${status} ${text.includes('Forbidden') || status === 400 ? 'DENY' : 'ALLOW/FAIL'} - ${text}`);
  };

  await check("A. Management+Listing (mgmt)", ["EDIT_PROPERTY", "MANAGE_LISTING"], `/api/properties/${prop.id}/units`, "ALLOW", "POST", { unitNumber: "u1" });
  await check("B. Management only", ["EDIT_PROPERTY"], `/api/properties/${prop.id}/units`, "ALLOW", "POST", { unitNumber: "u2" });
  await check("C. Listing only NO tenant mgmt", ["MANAGE_LISTING"], `/api/leases`, "DENY", "POST", { propertyId: prop.id, tenantId: 'test' });
  await check("D. Tenant mgmt NO rent", ["MANAGE_TENANTS"], `/api/leases/payments/${payment.id}/confirm`, "DENY", "POST", {});
  await check("E. No financial authority", ["EDIT_PROPERTY"], `/api/leases/payments/${payment.id}/reverse`, "DENY", "POST", { reason: "test" });
  await check("F. No approval authority", ["EDIT_PROPERTY"], `/api/maintenance/property/${prop.id}`, "DENY", "GET", null); // Just testing VIEW_MAINTENANCE

  // Clear and test CRM contact only
  await clearAgreements();
  const resH = await fetch(`http://localhost:3000/api/properties/${prop.id}/units`, { method: "POST", headers: { ...companyHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: "u" }) });
  console.log(`G/H. No agreement (CRM only/Unrelated): ${resH.status} ${await resH.text().catch(()=>'')}`);
}

testAuthMatrix().catch(console.error).then(() => process.exit(0));
