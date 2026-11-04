import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';

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

async function runFinding11() {
  console.log('================================================================');
  console.log('  FINDING 11 — TENANT SPENDING LIMITS BYPASS / MISSING ENFORCEMENT');
  console.log('================================================================\n');

  const { injectPgliteMock } = await import('./setup-pglite.js');
  await injectPgliteMock();

  const { db } = await import('../src/db/index.js');
  const { users, properties, maintenanceRequests, maintenanceQuotes } = await import('../src/db/schema.js');

  // Insert mock data
  await db.insert(users).values([
    { id: 'user_tenant11', uid: 'tenant11_uid', email: 'tenant11@test.com', firstName: 'Tenant', lastName: 'User', roles: ['TENANT'] },
    { id: 'user_owner11', uid: 'owner11_uid', email: 'owner11@test.com', firstName: 'Owner', lastName: 'User', roles: ['PROPERTY_OWNER'] }
  ]).onConflictDoNothing();

  await db.insert(properties).values([
    { id: 'prop_11', name: 'Prop 11', type: 'APARTMENT', status: 'AVAILABLE', acquisitionCost: '100' }
  ]).onConflictDoNothing();

  await db.insert(maintenanceRequests).values([
    { id: 'maint_11', propertyId: 'prop_11', reporterUserId: 'user_tenant11', category: 'PLUMBING', priority: 'HIGH', title: 'Fix sink', description: 'Leaking', status: 'QUOTE_PROVIDED' }
  ]).onConflictDoNothing();

  await db.insert(maintenanceQuotes).values([
    { id: 'quote_11', maintenanceRequestId: 'maint_11', vendorId: 'user_owner11', propertyId: 'prop_11', totalAmount: '500', currency: 'IQD', status: 'PENDING' }
  ]).onConflictDoNothing();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Tenant tries to approve a quote
    const res1 = await fetch(`${baseUrl}/maintenance/quote/quote_11/approve`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-tenant',
        'Content-Type': 'application/json'
      }
    });
    
    assert(
      res1.status === 403,
      'FINDING-11-01',
      `Tenant spending limits bypass prevented (Tenant gets 403 when trying to approve quote). Got ${res1.status}`
    );

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('✅ ALL FINDING 11 TESTS PASSED.');
  } else {
    process.exit(1);
  }
}

runFinding11().catch(console.error);
