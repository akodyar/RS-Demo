import { injectPgliteMock } from './setup-pglite.js';
import 'dotenv/config';
import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, description: string, details?: any) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`, details ? `— Details: ${JSON.stringify(details)}` : '');
    failed++;
  }
}

async function runAdminMatrixAudit() {
  console.log("================================================================");
  console.log("  HOMEHUB — ADMIN AUTHORIZATION MATRIX AUDIT");
  console.log("================================================================\n");

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  await injectPgliteMock();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api/admin`;

  try {
    console.log('--- Checking PLATFORM_ADMIN access ---');
    const paMetrics = await fetch(`${baseUrl}/metrics`, { headers: { Authorization: 'Bearer dev-admin' }});
    assert(paMetrics.status === 200, 'ADM-01', 'PLATFORM_ADMIN has access to /admin/metrics', { status: paMetrics.status, body: await paMetrics.text() });

    const paUserRole = await fetch(`${baseUrl}/users/123/role`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'COMPANY' })
    });
    // Can be 404 if user not found, but NOT 403
    assert(paUserRole.status !== 403, 'ADM-02', 'PLATFORM_ADMIN has mutation access to /admin/users/:id/role', { status: paUserRole.status, body: await paUserRole.text() });

    console.log('--- Checking FINANCE_ADMIN access ---');
    const faLedger = await fetch(`${baseUrl}/finance/ledger`, { headers: { Authorization: 'Bearer dev-finance' }});
    assert(faLedger.status === 200, 'ADM-03', 'FINANCE_ADMIN has access to /admin/finance/ledger', { status: faLedger.status, body: await faLedger.text() });

    const faUserRole = await fetch(`${baseUrl}/users/123/role`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-finance', 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'COMPANY' })
    });
    assert(faUserRole.status === 403, 'ADM-04', 'FINANCE_ADMIN denied mutation access to /admin/users/:id/role', { status: faUserRole.status, body: await faUserRole.text() });

    console.log('--- Checking SUPPORT_ADMIN access ---');
    const saUsers = await fetch(`${baseUrl}/users`, { headers: { Authorization: 'Bearer dev-support' }});
    assert(saUsers.status === 200, 'ADM-05', 'SUPPORT_ADMIN has read access to /admin/users', { status: saUsers.status, body: await saUsers.text() });

    const saPolicies = await fetch(`${baseUrl}/properties/123/tapu-status`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-support', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VERIFIED' })
    });
    assert(saPolicies.status === 403, 'ADM-06', 'SUPPORT_ADMIN denied mutation access to /admin/properties/:id/tapu-status', { status: saPolicies.status, body: await saPolicies.text() });

    console.log('--- Checking READ_ONLY_ADMIN access ---');
    const roUsers = await fetch(`${baseUrl}/users`, { headers: { Authorization: 'Bearer dev-readonly' }});
    assert(roUsers.status === 200, 'ADM-07', 'READ_ONLY_ADMIN has read access to /admin/users', { status: roUsers.status, body: await roUsers.text() });

    const roCompany = await fetch(`${baseUrl}/companies/123/status`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-readonly', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });
    assert(roCompany.status === 403, 'ADM-08', 'READ_ONLY_ADMIN denied from all mutations (requireMutationPermission)', { status: roCompany.status, body: await roCompany.text() });

    console.log('--- Checking Non-Admin Rejection ---');
    const tenantRes = await fetch(`${baseUrl}/metrics`, { headers: { Authorization: 'Bearer dev-tenant' }});
    assert(tenantRes.status === 403, 'ADM-09', 'TENANT denied access to admin routes', { status: tenantRes.status, body: await tenantRes.text() });
    
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  ADMIN MATRIX AUDIT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runAdminMatrixAudit().catch(e => {
  console.error(e);
  process.exit(1);
});
