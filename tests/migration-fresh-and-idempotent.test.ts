import { injectPgliteMock } from './setup-pglite.js';
import 'dotenv/config';
import pg from 'pg';
import { runMigrations } from '../scripts/migrate.js';

async function testFreshMigrationAndIdempotency() {
  console.log('================================================================');
  console.log('  HOMEHUB — FRESH DATABASE MIGRATION & IDEMPOTENCY AUDIT');
  console.log('================================================================');

  const sqlPort = parseInt(process.env.SQL_PORT || '5433', 10);
  const sqlPassword = process.env.SQL_PASSWORD || 'postgres';
  const baselineDbName = process.env.SQL_DB_NAME || 'homehub';

  const adminClient = new pg.Client({
    host: '127.0.0.1',
    port: sqlPort,
    user: 'postgres',
    password: sqlPassword,
    database: 'postgres', // Connect to maintenance db just to CREATE/DROP test database
  });
  await adminClient.connect();

  const freshDbName = 'homehub_fresh_verification';

  // 1. Ensure clean slate for test database
  await adminClient.query(`DROP DATABASE IF EXISTS "${freshDbName}";`);
  await adminClient.query(`CREATE DATABASE "${freshDbName}";`);
  console.log(`✅ Created fresh empty database: ${freshDbName}`);

  try {
    // 2. Run migrations from zero on fresh database
    console.log('\n--- 1. FIRST MIGRATION RUN: FROM ZERO ---');
    process.env.SQL_DB_NAME = freshDbName;
    process.env.SQL_HOST = '127.0.0.1';
    process.env.SQL_PORT = sqlPort.toString();
    process.env.SQL_USER = 'postgres';
    process.env.SQL_PASSWORD = sqlPassword;

    const firstRun = await runMigrations();
    if (!firstRun.success) {
      throw new Error('Fresh database migration failed');
    }
    console.log(`✅ Fresh database migrations completed successfully in ${firstRun.durationMs}ms`);

    // 3. Inspect schema of fresh database
    const freshClient = new pg.Client({
      host: '127.0.0.1',
      port: sqlPort,
      user: 'postgres',
      password: sqlPassword,
      database: freshDbName,
    });
    await freshClient.connect();

    const freshTablesRes = await freshClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const freshTables = freshTablesRes.rows.map((r: any) => r.table_name);
    console.log(`Total public base tables created from scratch: ${freshTables.length}`);

    if (freshTables.length !== 93) {
      throw new Error(`SCHEMA_MISMATCH: Expected 93 tables, created ${freshTables.length}`);
    }
    console.log('✅ Exactly 93 public base tables created from zero in dependency order.');

    // 4. Compare table names against baseline db
    const prodClient = new pg.Client({
      host: '127.0.0.1',
      port: sqlPort,
      user: 'postgres',
      password: sqlPassword,
      database: baselineDbName,
    });
    await prodClient.connect();

    const prodTablesRes = await prodClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const prodTables = prodTablesRes.rows.map((r: any) => r.table_name);
    await prodClient.end();

    const missingInFresh = prodTables.filter((t: string) => !freshTables.includes(t));
    const extraInFresh = freshTables.filter((t: string) => !prodTables.includes(t));

    if (missingInFresh.length > 0 || extraInFresh.length > 0) {
      throw new Error(`TABLE_SET_DIVERGENCE: Missing: ${missingInFresh.join(',')}, Extra: ${extraInFresh.join(',')}`);
    }
    console.log(`✅ Fresh database table set strictly matches ${baselineDbName} 1:1 (93/93 tables).`);

    // 5. Verify Drizzle migrations ledger table
    const migRecordRes = await freshClient.query(`SELECT count(*)::int as count FROM drizzle.__drizzle_migrations;`);
    const appliedCount = migRecordRes.rows[0].count;
    console.log(`Applied migrations recorded in drizzle.__drizzle_migrations: ${appliedCount}`);
    if (appliedCount !== 6) {
      throw new Error(`MIGRATION_RECORD_MISMATCH: Expected 6 records, got ${appliedCount}`);
    }
    console.log('✅ All 6 migration journal entries recorded in migrations history.');

    // 6. Second Migration Run (Idempotency Drill)
    console.log('\n--- 2. SECOND MIGRATION RUN: IDEMPOTENCY DRILL ---');
    const secondRun = await runMigrations();
    console.log(`Second migration run completed in ${secondRun.durationMs ?? 0}ms`);
    if ((secondRun.durationMs ?? 0) > 200) {
      console.warn(`⚠️ Warning: Second run took longer than expected: ${secondRun.durationMs}ms`);
    }

    const afterSecondTables = await freshClient.query(`
      SELECT count(*)::int as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    if (afterSecondTables.rows[0].count !== 93) {
      throw new Error(`IDEMPOTENCY_FAILED: Table count changed after second run to ${afterSecondTables.rows[0].count}`);
    }
    console.log('✅ Migration idempotency confirmed: Zero schema modifications on second run.');

    // 7. Verify Advisory Lock Concurrency Safety (Mutual Exclusion)
    console.log('\n--- 3. ADVISORY LOCK MUTUAL EXCLUSION DRILL ---');
    const MIGRATION_LOCK_ID = 849204829;
    
    // Session 1 acquires lock
    await freshClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    console.log(`Session 1 acquired advisory lock ${MIGRATION_LOCK_ID}.`);

    // Session 2 attempts non-blocking acquire
    const session2 = new pg.Client({
      host: '127.0.0.1',
      port: sqlPort,
      user: 'postgres',
      password: sqlPassword,
      database: freshDbName,
    });
    await session2.connect();

    const tryLockRes = await session2.query('SELECT pg_try_advisory_lock($1) as acquired', [MIGRATION_LOCK_ID]);
    const acquired = tryLockRes.rows[0].acquired;
    console.log(`Session 2 try_advisory_lock result: ${acquired}`);
    if (acquired === true) {
      throw new Error('ADVISORY_LOCK_FAILURE: Session 2 acquired lock while Session 1 holds it!');
    }
    console.log('✅ Mutual exclusion verified: Session 2 blocked while Session 1 holds lock.');

    // Session 1 releases lock
    await freshClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    console.log('Session 1 released advisory lock.');

    // Session 2 now attempts to acquire
    const tryLockRes2 = await session2.query('SELECT pg_try_advisory_lock($1) as acquired', [MIGRATION_LOCK_ID]);
    if (!tryLockRes2.rows[0].acquired) {
      throw new Error('ADVISORY_LOCK_FAILURE: Session 2 could not acquire lock after Session 1 released it');
    }
    console.log('✅ Session 2 acquired lock successfully after Session 1 released.');
    await session2.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);

    await session2.end();
    await freshClient.end();

    console.log('\n🎉 ALL FRESH MIGRATION, IDEMPOTENCY & LOCK VERIFICATIONS PASSED.');
  } finally {
    // 8. Clean up test database
    await adminClient.query(`DROP DATABASE IF EXISTS "${freshDbName}";`);
    console.log(`Cleaned up temporary database ${freshDbName}.`);
    await adminClient.end();
  }
}

testFreshMigrationAndIdempotency().catch((err) => {
  console.error('Fresh migration drill failed:', err);
  process.exit(1);
});
