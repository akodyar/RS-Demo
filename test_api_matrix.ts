import 'dotenv/config';
import { db } from './src/db/index.js';
import { properties, managementAgreements, users, organizations, leases, paymentRecords, units } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function testFullMatrix() {
  console.log("=== SETUP MATRIX ===");
  
  const [prop] = await db.insert(properties).values({ name: 'Auth Prop', type: 'RESIDENTIAL', status: 'ACTIVE', ownerId: 'owner_01' }).returning();
  const [unit] = await db.insert(units).values({ propertyId: prop.id, unitNumber: '101', status: 'VACANT', currency: 'IQD' }).returning();
  const [lease] = await db.insert(leases).values({ propertyId: prop.id, unitId: unit.id, startDate: new Date().toISOString(), endDate: new Date().toISOString(), status: 'ACTIVE', rentAmount: '1000' }).returning();
  const [payment] = await db.insert(paymentRecords).values({ propertyId: prop.id, leaseId: lease.id, payerId: 'user_tenant_01', amount: '1000', currency: 'IQD', status: 'RECORDED', recordedDate: new Date().toISOString() }).returning();

  const clear = async () => db.delete(managementAgreements).where(eq(managementAgreements.propertyId, prop.id));
  const grant = async (perms: string[]) => {
    await clear();
    await db.insert(managementAgreements).values({ propertyId: prop.id, companyId: 'org_company_01', ownerId: 'user_owner_01', status: 'ACTIVE', grantedPermissions: perms, startDate: new Date().toISOString() });
  };

  const req = async (roleHeader: string, url: string, method: string, body?: any) => {
    const res = await fetch(`http://localhost:3000${url}`, {
      method,
      headers: { 'Authorization': `Bearer ${roleHeader}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, text: await res.text() };
  };

  console.log("\n--- TEST EXECUTION ---");

  // 1. Authorized Owner
  await clear();
  let r = await req('dev-owner', `/api/properties/${prop.id}/units`, 'POST', { unitNumber: 'O1' });
  console.log(`1. Owner (Property Mgmt): ${r.status}`);

  // 2. Authorized Agent (with explicit permission)
  await grant(['EDIT_PROPERTY']);
  r = await req('dev-company', `/api/properties/${prop.id}/units`, 'POST', { unitNumber: 'C1' });
  console.log(`2. Authorized Company (Property Mgmt): ${r.status}`);

  await grant(['MANAGE_LISTING']);
  r = await req('dev-company', `/api/listings`, 'POST', { propertyId: prop.id, unitId: unit.id, price: '1000', currency: 'IQD', type: 'RENT', title: 'Test' });
  console.log(`2. Authorized Company (Listing Mgmt): ${r.status}`);

  await grant(['MANAGE_TENANTS']); // Tenant / Lease management
  r = await req('dev-company', `/api/leases`, 'POST', { propertyId: prop.id, unitId: unit.id, tenantId: 'user_tenant_01', startDate: new Date().toISOString(), endDate: new Date().toISOString(), rentAmount: '1000', currency: 'IQD' });
  console.log(`2. Authorized Company (Lease Mgmt): ${r.status}`);

  await grant(['COLLECT_RENT']); // Financial authority
  r = await req('dev-company', `/api/leases/payments/${payment.id}/confirm`, 'POST', {});
  console.log(`2. Authorized Company (Rent Collection): ${r.status}`);

  await grant(['VIEW_MAINTENANCE', 'EDIT_PROPERTY']); // Approval authority via maintenance
  r = await req('dev-company', `/api/maintenance`, 'POST', { propertyId: prop.id, unitId: unit.id, title: 'Fix', category: 'PLUMBING', priority: 'HIGH' });
  console.log(`2. Authorized Company (Maintenance): ${r.status}`);

  // 3. Same agent WITHOUT proper permission
  await grant(['VIEW_PROPERTY']);
  r = await req('dev-company', `/api/properties/${prop.id}/units`, 'POST', { unitNumber: 'C2' });
  console.log(`3. Company missing permission (EDIT_PROPERTY): ${r.status} ${r.text.includes('Insufficient') ? '(DENIED)' : ''}`);

  r = await req('dev-company', `/api/leases/payments/${payment.id}/confirm`, 'POST', {});
  console.log(`3. Company missing permission (COLLECT_RENT): ${r.status} ${r.text.includes('Insufficient') ? '(DENIED)' : ''}`);

  // 4. Unrelated owner
  r = await req('dev-owner2', `/api/properties/${prop.id}/units`, 'POST', { unitNumber: 'U1' });
  console.log(`4. Unrelated Owner: ${r.status} ${r.text.includes('Insufficient') ? '(DENIED)' : ''}`);

  // 5. Tenant attempting owner mutation
  r = await req('dev-tenant', `/api/properties/${prop.id}/units`, 'POST', { unitNumber: 'T1' });
  console.log(`5. Tenant: ${r.status} ${r.text.includes('Insufficient') ? '(DENIED)' : ''}`);

  // 6. Missing relationship (No agreement)
  await clear();
  r = await req('dev-company', `/api/properties/${prop.id}/units`, 'POST', { unitNumber: 'C3' });
  console.log(`6. No relationship (Company): ${r.status} ${r.text.includes('Insufficient') ? '(DENIED)' : ''}`);

  // 7. Admin
  r = await req('dev-admin', `/api/properties/${prop.id}/units`, 'POST', { unitNumber: 'A1' });
  console.log(`7. Admin bypass: ${r.status}`);
}
testFullMatrix().catch(console.error).then(() => process.exit(0));
