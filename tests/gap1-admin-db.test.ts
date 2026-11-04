import 'dotenv/config';
import express from 'express';
import http from 'http';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { resetDbHealthCache } from '../src/server/middleware/dbGuard.js';

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

async function runGap1() {
  console.log('================================================================');
  console.log('  GAP 1 — FINDING 1: BACKEND ADMIN DATA AUTHORITY (POSTGRESQL)');
  console.log('================================================================\n');

  // 1. Initialize PGlite with full Drizzle migration schema
  const pglite = new PGlite();
  const migDb = drizzlePglite(pglite);
  await migrate(migDb, { migrationsFolder: './drizzle' });
  console.log('✅ Real PostgreSQL instance (PGlite) initialized with all 93 tables.');

  // Create pool adapter to attach to global._postgresPool
  const pglitePool: any = {
    connect: async () => {
      return {
        query: async (queryArg: any, paramsArg?: any) => {
          const sql = typeof queryArg === 'string' ? queryArg : queryArg.text;
          const values = typeof queryArg === 'string' ? paramsArg : (queryArg.values || paramsArg);
          const rowMode = queryArg?.rowMode;
          const res = await pglite.query(sql, values || [], rowMode ? { rowMode } : undefined);
          return { rows: res.rows, rowCount: res.rows.length, fields: res.fields };
        },
        release: () => {},
      };
    },
    query: async (queryArg: any, paramsArg?: any) => {
      const sql = typeof queryArg === 'string' ? queryArg : queryArg.text;
      const values = typeof queryArg === 'string' ? paramsArg : (queryArg.values || paramsArg);
      const rowMode = queryArg?.rowMode;
      const res = await pglite.query(sql, values || [], rowMode ? { rowMode } : undefined);
      return { rows: res.rows, rowCount: res.rows.length, fields: res.fields };
    },
    on: () => {},
    end: async () => {},
  };

  (global as any)._postgresPool = pglitePool;
  process.env.SQL_HOST = '127.0.0.1';
  process.env.SQL_PORT = '5432';
  resetDbHealthCache();

  const { default: apiRouter } = await import('../src/server/routes/api.js');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api/admin`;

  try {
    const testEmail = `admincrud-${Date.now()}@test.local`;
    let createdUserId: string;

    // A. CREATE -> PostgreSQL
    console.log('\n--- 1. Testing Admin CREATE -> PostgreSQL ---');
    const createRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Test', lastName: 'AdminUser', email: testEmail, role: 'ADMIN' })
    });
    const createData = await createRes.json() as any;
    createdUserId = createData.user?.id;
    assert(
      createRes.status === 201 && Boolean(createdUserId),
      'GAP1-01',
      'Admin CREATE -> PostgreSQL (HTTP 201 Created with generated UUID)',
      { status: createRes.status, userId: createdUserId }
    );

    // Verify raw PostgreSQL table row
    const rawPgUser = await pglite.query(`SELECT id, email, roles FROM users WHERE id = $1;`, [createdUserId]);
    assert(
      rawPgUser.rows.length === 1 && (rawPgUser.rows[0] as any).email === testEmail,
      'GAP1-01b',
      'Direct PostgreSQL SELECT verifies user row inserted into PostgreSQL "users" table',
      { row: rawPgUser.rows[0] }
    );

    // B. READ -> PostgreSQL
    console.log('\n--- 2. Testing Admin READ -> PostgreSQL ---');
    const readRes = await fetch(`${baseUrl}/users`, { headers: { Authorization: 'Bearer dev-admin' }});
    const readData = await readRes.json() as any;
    const found = readData.users?.some((u: any) => u.id === createdUserId);
    assert(
      readRes.status === 200 && found,
      'GAP1-02',
      'Admin READ -> PostgreSQL (HTTP 200 with persisted record returned)',
      { status: readRes.status, found }
    );

    // C. UPDATE -> PostgreSQL
    console.log('\n--- 3. Testing Admin UPDATE -> PostgreSQL ---');
    const updateRes = await fetch(`${baseUrl}/users/${createdUserId}/status`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' })
    });
    const updateData = await updateRes.json() as any;
    assert(
      updateRes.status === 200 && updateData.user?.isActive === false,
      'GAP1-03',
      'Admin UPDATE -> PostgreSQL (HTTP 200 with isActive updated)',
      { status: updateRes.status, isActive: updateData.user?.isActive }
    );

    // Verify raw PostgreSQL table update
    const rawUpdatedUser = await pglite.query(`SELECT is_active FROM users WHERE id = $1;`, [createdUserId]);
    assert(
      (rawUpdatedUser.rows[0] as any).is_active === false,
      'GAP1-03b',
      'Direct PostgreSQL SELECT verifies is_active=false in PostgreSQL "users" table'
    );

    // D. DELETE -> PostgreSQL
    console.log('\n--- 4. Testing Admin DELETE -> PostgreSQL ---');
    const deleteRes = await fetch(`${baseUrl}/users/${createdUserId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer dev-admin' }
    });
    const deleteData = await deleteRes.json() as any;
    assert(
      deleteRes.status === 200 && deleteData.deleted === true,
      'GAP1-04',
      'Admin DELETE -> PostgreSQL (HTTP 200 with deleted: true)',
      { status: deleteRes.status }
    );

    // Verify raw PostgreSQL table deletion
    const rawDeletedUser = await pglite.query(`SELECT id FROM users WHERE id = $1;`, [createdUserId]);
    assert(
      rawDeletedUser.rows.length === 0,
      'GAP1-04b',
      'Direct PostgreSQL SELECT verifies user row was deleted from PostgreSQL "users" table'
    );

    // E. AUDIT LOGS -> PostgreSQL
    console.log('\n--- 5. Testing Admin Audit Logs -> PostgreSQL ---');
    const auditRes = await fetch(`${baseUrl}/audit-logs`, { headers: { Authorization: 'Bearer dev-admin' }});
    const auditData = await auditRes.json() as any;
    const hasAuditEntry = auditData.auditLogs?.some((a: any) => a.action === 'ADMIN_USER_CREATED' && a.changes?.email === testEmail);
    assert(
      auditRes.status === 200 && hasAuditEntry,
      'GAP1-05',
      'Admin audit logs persist to and retrieve from authoritative PostgreSQL "audit_logs" table',
      { status: auditRes.status, hasAuditEntry }
    );

    // F. FINANCE / LEDGER -> PostgreSQL
    console.log('\n--- 6. Testing Admin Finance / Ledger Views -> PostgreSQL ---');
    const testPropId = `prop_finance_test_${Date.now()}`;
    const testJeId = `je_test_${Date.now()}`;
    
    // Insert a test property
    await pglite.query(`
      INSERT INTO properties (id, name, type)
      VALUES ($1, $2, $3);
    `, [testPropId, 'Finance Test Prop', 'RESIDENTIAL']);

    // Insert a test journal entry directly into PostgreSQL
    await pglite.query(`
      INSERT INTO journal_entries (id, property_id, date, status, description)
      VALUES ($1, $2, $3, $4, $5);
    `, [testJeId, testPropId, new Date().toISOString(), 'POSTED', 'Test Ledger Entry']);
    
    await pglite.query(`
      INSERT INTO ledger_lines (id, journal_entry_id, account_id, debit, credit)
      VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10);
    `, [`ll_1_${Date.now()}`, testJeId, 'acc_test_1', 50000, 0, `ll_2_${Date.now()}`, testJeId, 'acc_test_2', 0, 50000]);

    const ledgerRes = await fetch(`${baseUrl}/finance/ledger`, { headers: { Authorization: 'Bearer dev-admin' }});
    const ledgerData = await ledgerRes.json() as any;
    assert(
      ledgerRes.status === 200 && ledgerData.ledger?.length > 0,
      'GAP1-06',
      'Admin finance/ledger views query authoritative PostgreSQL "journal_entries" table',
      { status: ledgerRes.status, count: ledgerData.ledger?.length }
    );

    // G. DB UNAVAILABLE -> FAIL CLOSED (503)
    console.log('\n--- 7. Testing PostgreSQL Unavailable: Fail-Closed Enforcement ---');
    delete process.env.SQL_HOST;
    delete process.env.DATABASE_URL;
    (global as any)._postgresPool = undefined;
    resetDbHealthCache();

    // READ when DB down -> strictly 503
    const read503Res = await fetch(`${baseUrl}/users`, { headers: { Authorization: 'Bearer dev-admin' }});
    const read503Data = await read503Res.json() as any;
    assert(
      read503Res.status === 503 && (read503Data.error === 'DATABASE_NOT_CONFIGURED' || read503Data.code === 'DATABASE_NOT_CONFIGURED'),
      'GAP1-07',
      'Admin READ -> strictly 503 DATABASE_NOT_CONFIGURED when PostgreSQL unavailable (no mock data fallback)',
      { status: read503Res.status, error: read503Data.error || read503Data.code }
    );

    // Mutation when DB down -> strictly 503
    const mut503Res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Test', lastName: 'FailUser', email: 'fail@test.local', role: 'ADMIN' })
    });
    const mut503Data = await mut503Res.json() as any;
    assert(
      mut503Res.status === 503 && (mut503Data.error === 'DATABASE_NOT_CONFIGURED' || mut503Data.code === 'DATABASE_NOT_CONFIGURED'),
      'GAP1-08',
      'Admin mutation -> strictly 503 DATABASE_NOT_CONFIGURED when PostgreSQL unavailable (no static fallback)',
      { status: mut503Res.status, error: mut503Data.error || mut503Data.code }
    );

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  GAP 1 AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runGap1().catch((err) => {
  console.error('GAP 1 test run failed:', err);
  process.exit(1);
});
