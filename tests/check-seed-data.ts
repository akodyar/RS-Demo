import 'dotenv/config';
import { db } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  const leases = await db.select().from(schema.leaseTenants).where(eq(schema.leaseTenants.tenantId, 'user_tenant_01'));
  console.log('Lease tenants for user_tenant_01:', leases.length);
  if (leases.length > 0) {
    console.log('Lease 0:', leases[0]);
    const [l] = await db.select().from(schema.leases).where(eq(schema.leases.id, leases[0].leaseId));
    console.log('Lease status:', l?.status, 'Property ID:', l?.propertyId);
  }

  const activeLeases = await db.select().from(schema.leaseTenants)
    .innerJoin(schema.leases, eq(schema.leaseTenants.leaseId, schema.leases.id))
    .where(and(eq(schema.leaseTenants.tenantId, 'user_tenant_01'), eq(schema.leases.status, 'ACTIVE')));
  console.log('Active leases for user_tenant_01:', activeLeases.length);
  if (activeLeases.length > 0) {
    console.log('Active Lease 0:', activeLeases[0].leases.id, activeLeases[0].leases.propertyId);
  }

  const bills = await db.select().from(schema.utilityBills).where(eq(schema.utilityBills.tenantId, 'user_tenant_01'));
  console.log('Bills for user_tenant_01:', bills.length);
  bills.forEach((b, i) => console.log(`Bill ${i}:`, b.id, b.type, b.amount, b.outstandingAmount, b.status));

  const maint = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.reporterUserId, 'user_tenant_01'));
  console.log('Maintenance for user_tenant_01:', maint.length);
  maint.forEach((m, i) => console.log(`Maint ${i}:`, m.id, m.title, m.category, m.priority, m.status));

  process.exit(0);
}

run().catch(console.error);
