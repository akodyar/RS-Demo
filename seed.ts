import { db, closePool } from './src/db/index.js';
import * as schema from './src/db/schema.js';
import * as crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  const tenantId = 'browser-tenant-1';
  const ownerId = 'browser-owner-1';
  const propId = 'browser-prop-1';

  await db.insert(schema.users).values([
    { id: tenantId, email: 'browser-tenant-unique@test.com', passwordHash: 'hash', role: 'TENANT', firstName: 'Tenant', lastName: 'Test', status: 'ACTIVE' },
    { id: ownerId, email: 'browser-owner-unique@test.com', passwordHash: 'hash', role: 'OWNER', firstName: 'Owner', lastName: 'Test', status: 'ACTIVE' }
  ]).onConflictDoNothing();

  await db.insert(schema.properties).values([
    { id: propId, ownerId: ownerId, name: 'Browser Prop', type: 'RESIDENTIAL', status: 'ACTIVE', operatingModel: 'FULLY_MANAGED' }
  ]).onConflictDoNothing();

  await db.insert(schema.ownershipRecords).values([
    { id: 'ownership-1', ownerId: ownerId, propertyId: propId, ownershipType: 'INDIVIDUAL', status: 'VERIFIED', verifiedAt: new Date() }
  ]).onConflictDoNothing();

  await db.insert(schema.utilityBills).values([
    { id: 'bill-e2e-tenant-01', propertyId: 'browser-prop-1', tenantId: 'user_tenant_01', type: 'WATER', amount: '123', outstandingAmount: '123', currency: 'USD', status: 'PENDING', billingDate: '2026-11-01', dueDate: '2026-12-01' }
  ]).onConflictDoNothing();

  console.log('Seeded!');
  await closePool();
}
seed()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
