import 'dotenv/config';
import express from 'express';
import http from 'http';
import { getPool, closePool } from '../src/db/index.js';
import { createApp } from '../server.js';
import pg from 'pg';

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

async function runFinding15() {
  console.log('================================================================');
  console.log('  FINDING 15 — READINESS / POOL RUNTIME PROOF');
  console.log('================================================================\n');

  // We are forcing a failed connection to 127.0.0.1:5432
  // We want to prove that:
  // 1. The pool is a singleton
  // 2. Probing doesn't leak pool objects
  // 3. Probing doesn't unbounded grow connections (totalCount stays constrained)
  
  // Ensure clear state
  await closePool();
  
  process.env.SQL_HOST = '127.0.0.1';
  process.env.SQL_PORT = '5432';
  process.env.SQL_USER = 'dummy';
  process.env.SQL_PASSWORD = 'dummy';
  process.env.DB_POOL_MAX = '5';
  process.env.DATABASE_URL = ''; // Clear to force use of host/port

  const app = await createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  try {
    // Probe 1
    const res1 = await fetch(`${baseUrl}/readiness`);
    await res1.json();
    
    // 1. Singleton pool verification
    const activePool = global._postgresPool as pg.Pool;
    assert(
      activePool !== undefined && activePool instanceof pg.Pool,
      'FINDING-15-01',
      'Singleton pool created in global._postgresPool'
    );
    
    const initialPoolRef = activePool;

    // 2. Repeated probes
    console.log('Executing 50 readiness probes...');
    for (let i = 0; i < 50; i++) {
      const res = await fetch(`${baseUrl}/readiness`);
      await res.json();
    }

    assert(
      global._postgresPool === initialPoolRef,
      'FINDING-15-02',
      'Repeated probes reuse the same exact pool instance (no pool leakage)'
    );

    // 3. Connection count bounds (should be bounded by max or just the failed connection attempts)
    assert(
      initialPoolRef.totalCount <= 5,
      'FINDING-15-03',
      'No unbounded connection growth (totalCount bounded by pool config)',
      { totalCount: initialPoolRef.totalCount, expectedMax: 5 }
    );

    // 4. Correct DB failure behavior
    assert(
      res1.status === 503,
      'FINDING-15-04',
      'DB failure causes readiness endpoint to return 503 (fail-closed)',
      { status: res1.status }
    );

    // 5. Graceful shutdown
    await closePool();
    assert(
      global._postgresPool === undefined,
      'FINDING-15-05',
      'Graceful shutdown sets global._postgresPool to undefined and ends pool'
    );
    
    // Note: Pool ending is async but the object itself is removed from global scope immediately.

  } finally {
    server.close();
  }
}

runFinding15().catch(e => {
  console.error(e);
  process.exit(1);
});
