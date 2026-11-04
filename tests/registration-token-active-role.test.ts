import 'dotenv/config';
import assert from 'node:assert';
import http from 'node:http';
import { createApp } from '../server.js';
import { verifyAuthToken } from '../src/server/utils/auth.js';
import { db } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const testDb = process.env.SQL_DB_NAME || 'homehub_test';
if (testDb !== 'homehub_test') {
  console.error('[SAFETY GATE] Target database must be homehub_test');
  process.exit(1);
}

async function runRegressionTest() {
  console.log('================================================================');
  console.log('  REGRESSION TEST: Registration Token Active Role Context');
  console.log('================================================================\n');

  const port = 3046;
  const baseUrl = `http://localhost:${port}`;
  process.env.PORT = String(port);
  process.env.SQL_DB_NAME = testDb;

  const app = await createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(port, resolve));

  const runId = Date.now();
  const ownerEmail = `reg.owner.${runId}@homehub.iq`;
  const tenantEmail = `reg.tenant.${runId}@homehub.iq`;
  const password = 'TestSecurePassword123!';

  try {
    // 1. Register Owner
    console.log('[TEST 1] Registering Owner via POST /api/auth/register...');
    const ownerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password,
        fullName: 'Regression Owner',
        phone: '7501112233',
        role: 'OWNER',
        entityType: 'INDIVIDUAL',
      }),
    });

    const ownerText = await ownerRes.text();
    console.log(`[TEST 1] Owner Registration Response Status: ${ownerRes.status}, Body: ${ownerText}`);
    assert.strictEqual(ownerRes.status, 201, `Expected 201, got ${ownerRes.status}: ${ownerText}`);
    const ownerData = JSON.parse(ownerText);
    assert(ownerData.token, 'Owner registration must return a JWT token');

    const decodedOwner = verifyAuthToken(ownerData.token);
    console.log('[TEST 1] Decoded Owner Token Payload:', {
      id: decodedOwner.id,
      roles: decodedOwner.roles,
      activeRole: decodedOwner.activeRole,
      workspaceId: decodedOwner.workspaceId,
    });

    assert.strictEqual(decodedOwner.activeRole, 'PROPERTY_OWNER', 'Token must contain activeRole: PROPERTY_OWNER');
    assert.strictEqual(decodedOwner.workspaceId, 'owner_personal', 'Token must contain workspaceId: owner_personal');

    // Verify Owner can access Owner Dashboard without 403 context error
    console.log('[TEST 1.1] Requesting /api/owner/dashboard with registration token...');
    const ownerDashRes = await fetch(`${baseUrl}/api/owner/dashboard`, {
      headers: { Authorization: `Bearer ${ownerData.token}` },
    });
    console.log(`[TEST 1.1] Owner Dashboard Response Status: ${ownerDashRes.status}`);
    assert.notStrictEqual(ownerDashRes.status, 403, 'Must not be blocked by 403 INCORRECT_ACTIVE_ROLE_CONTEXT');
    console.log('[TEST 1] -> PASSED!\n');

    // 2. Register Tenant
    console.log('[TEST 2] Registering Tenant via POST /api/auth/register...');
    const tenantRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: tenantEmail,
        password,
        fullName: 'Regression Tenant',
        phone: '7504445566',
        role: 'TENANT',
        entityType: 'INDIVIDUAL',
      }),
    });

    assert.strictEqual(tenantRes.status, 201, `Expected 201, got ${tenantRes.status}`);
    const tenantData = await tenantRes.json();
    assert(tenantData.token, 'Tenant registration must return a JWT token');

    const decodedTenant = verifyAuthToken(tenantData.token);
    console.log('[TEST 2] Decoded Tenant Token Payload:', {
      id: decodedTenant.id,
      roles: decodedTenant.roles,
      activeRole: decodedTenant.activeRole,
      workspaceId: decodedTenant.workspaceId,
    });

    assert.strictEqual(decodedTenant.activeRole, 'TENANT', 'Token must contain activeRole: TENANT');
    assert.strictEqual(decodedTenant.workspaceId, 'tenant_personal', 'Token must contain workspaceId: tenant_personal');

    // Verify Tenant reaches tenant domain: passes requireActiveRole and triggers authoritative requireActiveLease check
    console.log('[TEST 2.1] Requesting /api/tenant/dashboard with registration token...');
    const tenantDashRes = await fetch(`${baseUrl}/api/tenant/dashboard`, {
      headers: { Authorization: `Bearer ${tenantData.token}` },
    });
    const tenantDashBody = await tenantDashRes.json();
    console.log(`[TEST 2.1] Tenant Dashboard Response:`, tenantDashBody);
    assert.strictEqual(tenantDashBody.error, 'NO_ACTIVE_LEASE', 'Fresh tenant must be gated by NO_ACTIVE_LEASE invariant');
    assert.notStrictEqual(tenantDashBody.code, 'WORKSPACE_CONTEXT_REQUIRED', 'Must NOT be blocked by missing workspace context');
    console.log('[TEST 2] -> PASSED!\n');

    console.log('================================================================');
    console.log('  ALL REGRESSION CHECKS PASSED: REGISTRATION TOKEN INTEGRITY OK');
    console.log('================================================================');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // Cleanup synthetic test records
    await db.delete(schema.users).where(eq(schema.users.email, ownerEmail));
    await db.delete(schema.users).where(eq(schema.users.email, tenantEmail));
  }
}

runRegressionTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Regression test failed:', err);
    process.exit(1);
  });
