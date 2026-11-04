import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';

let passed = 0;
let failed = 0;

function recordTest(domain: string, desc: string, pass: boolean, expected: string, actual: string) {
  if (pass) {
    console.log(`✅ PASS [${domain}] ${desc}: expected ${expected}, got ${actual}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${domain}] ${desc}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

async function runFinding5() {
  console.log('================================================================');
  console.log('  HOMEHUB FINDING 5 — 6 DISTINCT API LAYERS FAIL-CLOSED DB GUARD');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  // Break the DB
  const originalHost = process.env.SQL_HOST;
  const originalUrl = process.env.DATABASE_URL;
  delete process.env.SQL_HOST;
  delete process.env.DATABASE_URL;

  // The 6 layers exactly
  const endpoints = [
    { name: 'ADMIN', path: '/admin/metrics' },
    { name: 'SALES', path: '/sales/listings/123/offers' },
    { name: 'MANAGEMENT', path: '/management/agreements/123/revoke' },
    { name: 'RENTAL_ACQ', path: '/rental-acquisition/listings' },
    { name: 'FINANCE', path: '/finance/invoices' },
    { name: 'MARKETPLACE', path: '/marketplace/listings/search' }
  ];

  try {
    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.path.includes('offers') || ep.path.includes('revoke') || ep.path.includes('listings') && ep.name === 'RENTAL_ACQ' ? 'POST' : 'GET',
        headers: {
          'Authorization': 'Bearer dev-admin',
          'Content-Type': 'application/json',
        }
      });
      
      const text = await res.text();
      let code = '';
      try {
        const json = JSON.parse(text);
        code = json.code || json.error;
      } catch (e) {
        code = text;
      }
      
      recordTest(
        ep.name,
        `returns 503 DATABASE_NOT_CONFIGURED when DB is down`,
        res.status === 503 && code === 'DATABASE_NOT_CONFIGURED',
        '503 DATABASE_NOT_CONFIGURED',
        `${res.status} ${code}`
      );
    }
  } finally {
    process.env.SQL_HOST = originalHost;
    process.env.DATABASE_URL = originalUrl;
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('✅ ALL TARGETED FINDING 5 TESTS PASSED.');
  } else {
    process.exit(1);
  }
}

runFinding5().catch(console.error);
