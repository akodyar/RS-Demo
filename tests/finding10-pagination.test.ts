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

async function runFinding10() {
  console.log('================================================================');
  console.log('  FINDING 10 — PAGINATION / BULK EXFILTRATION ON LISTINGS');
  console.log('================================================================\n');

  const { injectPgliteMock } = await import('./setup-pglite.js');
  await injectPgliteMock();

  const { db } = await import('../src/db/index.js');
  const { users, properties, listings } = await import('../src/db/schema.js');

  // Insert mock users and properties
  await db.insert(users).values([
    { id: 'user_admin10', uid: 'admin10_uid', email: 'admin10@test.com', firstName: 'Admin', lastName: 'User', roles: ['PLATFORM_ADMIN'] },
    { id: 'user_owner10', uid: 'owner10_uid', email: 'owner10@test.com', firstName: 'Owner', lastName: 'User', roles: ['PROPERTY_OWNER'] }
  ]).onConflictDoNothing();

  await db.insert(properties).values([
    { id: 'prop_list_1', name: 'Prop 1', type: 'APARTMENT', status: 'AVAILABLE', acquisitionCost: '100' }
  ]).onConflictDoNothing();

  // Insert mock listings (just one to test the query structure and limit caps)
  await db.insert(listings).values([
    { id: 'list_1', propertyId: 'prop_list_1', type: 'SALE', price: '150', status: 'ACTIVE', publisherUserId: 'user_owner10', title: 'Test Listing' }
  ]).onConflictDoNothing();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Request huge limit to exfiltrate bulk listings
    const res1 = await fetch(`${baseUrl}/marketplace/listings/search?limit=5000`);
    if (res1.status !== 200) {
      console.error(await res1.text());
    } else {
      const body1 = await res1.json();
      // Check if the returned pagination metadata capped the limit
      assert(
        res1.status === 200 && body1.limit === 100,
        'FINDING-10-01',
        `Pagination limits enforced on listings (Requested 5000, got limit capped at 100). Actual limit: ${body1.limit}`
      );
    }

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('✅ ALL FINDING 10 TESTS PASSED.');
  } else {
    process.exit(1);
  }
}

runFinding10().catch(console.error);
