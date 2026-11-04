import express from 'express';
import http from 'http';
import { requireAuth } from '../src/server/middleware/auth.js';
import * as firebaseAuthMod from '../src/server/config/firebase.js';

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

// Mock the Firebase verifyIdToken implementation for this test
if (firebaseAuthMod.auth) {
  firebaseAuthMod.auth.verifyIdToken = async (token: string) => {
    if (token === 'firebase-token-no-db-user') {
      return { uid: 'unregistered_uid' } as any;
    }
    if (token === 'firebase-token-with-db-user') {
      return { uid: 'uid_A' } as any; // Assuming 'uid_A' will be seeded in DB
    }
    throw new Error('Invalid token');
  };
}

async function runFinding7() {
  console.log('================================================================');
  console.log('  FINDING 7 — AUTH MIDDLEWARE ALLOWS FIREBASE USERS WITHOUT DB USER');
  console.log('================================================================\n');

  // Important: DB must be initialized so it can run the query and return 0 results
  const { injectPgliteMock } = await import('./setup-pglite.js');
  await injectPgliteMock();

  const { db } = await import('../src/db/index.js');
  const { users } = await import('../src/db/schema.js');

  await db.insert(users).values([
    { id: 'owner_A', uid: 'uid_A', email: 'ownerA@test.com', firstName: 'Owner', lastName: 'A', roles: ['PROPERTY_OWNER'] }
  ]).onConflictDoNothing();

  const app = express();
  app.use(express.json());
  
  // Set to production to trigger Firebase Auth logic
  process.env.NODE_ENV = 'production';

  app.get('/test-auth', requireAuth, (req, res) => {
    res.status(200).json({ success: true, user: req.user });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  try {
    const res1 = await fetch(`${baseUrl}/test-auth`, {
      headers: { 'Authorization': 'Bearer firebase-token-no-db-user' }
    });
    const body1 = await res1.json();
    
    assert(
      res1.status === 401 && body1.error === 'Unauthorized: User record not found',
      'FINDING-07-01',
      `Firebase user WITHOUT a DB user gets 401 Unauthorized (got ${res1.status} ${body1.error})`
    );

    const res2 = await fetch(`${baseUrl}/test-auth`, {
      headers: { 'Authorization': 'Bearer firebase-token-with-db-user' }
    });
    const body2 = await res2.json();
    
    assert(
      res2.status === 200 && body2.success === true,
      'FINDING-07-02',
      `Firebase user WITH a DB user gets 200 OK (got ${res2.status})`
    );
  } finally {
    // Restore env
    process.env.NODE_ENV = 'development';
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('✅ ALL FINDING 7 TESTS PASSED.');
  } else {
    process.exit(1);
  }
}

runFinding7().catch(console.error);
