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

async function runFinding9() {
  console.log('================================================================');
  console.log('  FINDING 9 — INTELLIGENCE / DRAFT-LISTING UNGUARDED AI CALLS');
  console.log('================================================================\n');

  const { injectPgliteMock } = await import('./setup-pglite.js');
  await injectPgliteMock();

  const { db } = await import('../src/db/index.js');
  const { users, properties, ownershipRecords } = await import('../src/db/schema.js');

  // Seed DB with users
  await db.insert(users).values([
    { id: 'user_unauth', uid: 'unauth_uid', email: 'unauth@test.com', firstName: 'Unauth', lastName: 'User', roles: ['PROPERTY_OWNER'] },
    { id: 'user_auth', uid: 'auth_uid', email: 'auth@test.com', firstName: 'Auth', lastName: 'User', roles: ['PROPERTY_OWNER'] }
  ]).onConflictDoNothing();

  await db.insert(properties).values([
    { id: 'prop_ai', name: 'AI Prop', type: 'VILLA', status: 'AVAILABLE', acquisitionCost: '1000' }
  ]).onConflictDoNothing();

  await db.insert(ownershipRecords).values([
    { id: 'own_ai', propertyId: 'prop_ai', ownerId: 'user_auth', ownershipPercentage: '100', status: 'VERIFIED', acquiredDate: new Date().toISOString() }
  ]).onConflictDoNothing();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Unauthorized Access (User doesn't own the property)
    const res1 = await fetch(`${baseUrl}/intelligence/draft-listing`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-owner-b', // dev-owner-b does not own prop_ai
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ propertyId: 'prop_ai', context: 'Test draft' })
    });
    const body1 = await res1.json();
    assert(
      res1.status === 403 && body1.error?.includes('Forbidden'),
      'FINDING-09-01',
      `Unauthorized user gets 403 Forbidden on AI draft-listing. Got ${res1.status}`
    );

    // 2. Missing propertyId Validation
    const res3 = await fetch(`${baseUrl}/intelligence/draft-listing`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-owner', // authorized dev-owner, but missing propertyId
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ context: 'Test draft' })
    });
    const body3 = await res3.json();
    // In our middleware, requirePropertyPermission expects propertyId in req.body.
    // If not found, it might return 400 or 403.
    assert(
      res3.status === 400 || res3.status === 403,
      'FINDING-09-02',
      `Missing propertyId is blocked by validation/authorization. Got ${res3.status}`
    );

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('✅ ALL FINDING 9 TESTS PASSED.');
  } else {
    process.exit(1);
  }
}

runFinding9().catch(console.error);
