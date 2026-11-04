import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { injectPgliteMock } from './setup-pglite.js';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

function recordTest(category: string, name: string, passed: boolean, expected: string, actual: string) {
  results.push({ name, category, passed, expected, actual });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${category}] ${name}: expected ${expected}, got ${actual}`);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB FINDING 2 — TARGETED AUTHORIZATION VERIFICATION');
  console.log('================================================================\n');

  // Setup healthy mock
  await injectPgliteMock();
  process.env.SQL_HOST = '127.0.0.1';
  process.env.SQL_DB_NAME = 'homehub';
  process.env.DATABASE_URL = 'postgres://fake:fake@127.0.0.1/fake';
  
  (global as any)._postgresPool = {
    connect: async () => ({
      query: async (q: any) => {
        if (typeof q === 'object' && q.text === 'SELECT 1') {
          return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    }),
    query: async (q: any) => {
      if (typeof q === 'object' && q.text === 'SELECT 1') {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    on: () => {},
    end: async () => {}
  };
  const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
  resetDbHealthCache();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    console.log('\n--- SALES AUTHORIZATION ---');
    // missing token
    let res = await fetch(`${baseUrl}/sales/listings/l_123/offers`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    recordTest('SALES', 'missing token -> 401', res.status === 401, '401', res.status.toString());

    // invalid token
    res = await fetch(`${baseUrl}/sales/listings/l_123/offers`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid_token' } });
    recordTest('SALES', 'invalid token -> 401', res.status === 401, '401', res.status.toString());
    
    // inactive DB user / missing DB user -> This depends on the authMiddleware implementation of how it checks dev-tokens. We'll use dev-vendor for wrong role (not allowed in sales).
    res = await fetch(`${baseUrl}/sales/listings/l_123/offers`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dev-vendor' } });
    recordTest('SALES', 'wrong role -> 403', res.status === 403, '403', res.status.toString());
    
    console.log('\n--- MANAGEMENT AUTHORIZATION ---');
    // unauthorized revoke -> 403
    res = await fetch(`${baseUrl}/management/agreements/ag_123/revoke`, { method: 'POST', headers: { Authorization: 'Bearer dev-buyer' } });
    recordTest('MANAGEMENT', 'unauthorized revoke -> denied (403)', res.status === 403, '403', res.status.toString());

    console.log('\n--- RENTAL ACQUISITION AUTHORIZATION ---');
    // unauthorized listing creation -> 403
    res = await fetch(`${baseUrl}/rental-acquisition/listings`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dev-vendor' } });
    recordTest('RENTAL', 'wrong role -> denied (403)', res.status === 403, '403', res.status.toString());
    
  } finally {
    server.close();
  }

  const failedCount = results.filter(r => !r.passed).length;
  if (failedCount > 0) {
    console.error(`\n❌ ${failedCount} test(s) failed!`);
    process.exit(1);
  } else {
    console.log('\n✅ All targeted Finding 2 tests passed successfully!');
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
