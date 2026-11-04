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

async function runFinding8() {
  console.log('================================================================');
  console.log('  FINDING 8 — DOCUMENT STATUS CLAIMS VS ACTUAL TEST RESULTS');
  console.log('================================================================\n');

  const { injectPgliteMock } = await import('./setup-pglite.js');
  await injectPgliteMock();

  const { db } = await import('../src/db/index.js');
  const { users, verificationRecords } = await import('../src/db/schema.js');

  // Seed DB with admin user and verification records
  await db.insert(users).values([
    { id: 'admin_user_verif', uid: 'admin_uid', email: 'admin@homehub.iq', firstName: 'Admin', lastName: 'User', roles: ['VERIFICATION_ADMIN'] },
    { id: 'user_owner_01', uid: 'owner_uid', email: 'owner@homehub.iq', firstName: 'Owner', lastName: 'User', roles: ['PROPERTY_OWNER'] }
  ]).onConflictDoNothing();

  await db.insert(verificationRecords).values([
    { 
      id: 'verif_valid', 
      subjectType: 'USER', 
      subjectId: 'user_123', 
      verificationType: 'IDENTITY', 
      status: 'SUBMITTED', // valid to move to UNDER_REVIEW or VERIFIED
      submittedBy: 'user_owner_01'
    },
    { 
      id: 'verif_invalid', 
      subjectType: 'USER', 
      subjectId: 'user_123', 
      verificationType: 'IDENTITY', 
      status: 'VERIFIED', // invalid to move to SUBMITTED
      submittedBy: 'user_owner_01'
    }
  ]).onConflictDoNothing();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Valid Transition: SUBMITTED -> UNDER_REVIEW
    const res1 = await fetch(`${baseUrl}/trust/verifications/verif_valid/review`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-verification',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetStatus: 'UNDER_REVIEW' })
    });
    const body1 = await res1.json();
    assert(
      res1.status === 200 && body1.success === true && body1.record.status === 'UNDER_REVIEW',
      'FINDING-08-01',
      `Valid document status transition allowed (SUBMITTED -> UNDER_REVIEW). Result: ${body1.record?.status}`
    );

    // 2. Invalid Transition: VERIFIED -> SUBMITTED
    const res2 = await fetch(`${baseUrl}/trust/verifications/verif_invalid/review`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-verification',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetStatus: 'SUBMITTED' })
    });
    const body2 = await res2.json();
    assert(
      res2.status === 400 && body2.message?.includes('ILLEGAL_STATE_TRANSITION'),
      'FINDING-08-02',
      `Invalid document status transition rejected (VERIFIED -> SUBMITTED). Got ${res2.status}: ${body2.message}`
    );

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('✅ ALL FINDING 8 TESTS PASSED.');
  } else {
    process.exit(1);
  }
}

runFinding8().catch(console.error);
