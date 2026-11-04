/**
 * HOMEHUB — PostgreSQL Integration Safety Gate & Cleanup Unit Test Suite
 * 
 * Verifies all fail-closed safety invariants of tests/real-postgres-integration.test.ts
 * completely in-memory using static mocks and isolated subprocesses.
 * 
 * ZERO connections to production.
 * ZERO mutations.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import {
  assertSafeDatabaseConfig,
  getSafeTestDbConfig,
  getSafePoolConfig,
  executePreflightVerification,
  runRealDatabaseTests,
  TARGET_TEST_DATABASE,
  EXPECTED_RUNTIME_USER,
} from './real-postgres-integration.test';

let passedCount = 0;
let failedCount = 0;

function check(title: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${title}${detail ? ` (${detail})` : ''}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${title}${detail ? ` (${detail})` : ''}`);
    failedCount++;
    throw new Error(`Safety test assertion failed: ${title}`);
  }
}

async function runAllSafetyChecks() {
  console.log('================================================================');
  console.log('  HOMEHUB — SAFETY GATE & FAIL-CLOSED ISOLATION TEST SUITE');
  console.log('================================================================\n');

  const savedEnvDb = process.env.SQL_DB_NAME;
  const savedDbUrl = process.env.DATABASE_URL;

  // --------------------------------------------------------------------------
  // 1. CONFIGURATION CHECKS: MISSING / WRONG DATABASE REJECTION
  // --------------------------------------------------------------------------
  console.log('--- 1. CONFIGURATION CHECKS: MISSING / WRONG DATABASE REJECTION ---');

  // 1a. Missing SQL_DB_NAME
  delete process.env.SQL_DB_NAME;
  let missingRejected = false;
  try {
    assertSafeDatabaseConfig();
  } catch (err: any) {
    missingRejected = err.message.includes('HARD SAFETY GATE TRIGGERED') && err.message.includes('UNSET');
  }
  check('Missing SQL_DB_NAME rejected immediately', missingRejected);

  // 1b. Production SQL_DB_NAME
  process.env.SQL_DB_NAME = 'homehub_production';
  let prodRejected = false;
  try {
    assertSafeDatabaseConfig();
  } catch (err: any) {
    prodRejected = err.message.includes('HARD SAFETY GATE TRIGGERED') && err.message.includes('homehub_production');
  }
  check('SQL_DB_NAME=homehub_production rejected with hard safety error', prodRejected);

  // 1c. Arbitrary database name
  process.env.SQL_DB_NAME = 'arbitrary_test_db';
  let arbitraryRejected = false;
  try {
    assertSafeDatabaseConfig();
  } catch (err: any) {
    arbitraryRejected = err.message.includes('HARD SAFETY GATE TRIGGERED');
  }
  check('Arbitrary SQL_DB_NAME rejected', arbitraryRejected);

  // 1d. Dangerous DATABASE_URL pointing to production
  process.env.SQL_DB_NAME = TARGET_TEST_DATABASE;
  process.env.DATABASE_URL = 'postgres://user:super_secret_pw@127.0.0.1:5432/homehub_production';
  let prodUrlRejected = false;
  let secretLeakedInError = false;
  try {
    assertSafeDatabaseConfig();
  } catch (err: any) {
    prodUrlRejected = err.message.includes('DATABASE_URL must explicitly target') && err.message.includes('homehub_production');
    secretLeakedInError = err.message.includes('super_secret_pw') || err.message.includes('postgres://');
  }
  check('Dangerous DATABASE_URL targeting production rejected', prodUrlRejected);
  check('DATABASE_URL error does NOT log URL or credentials', !secretLeakedInError);

  // 1e. Malformed DATABASE_URL
  process.env.DATABASE_URL = 'not_a_valid_url:::invalid';
  let malformedRejected = false;
  try {
    assertSafeDatabaseConfig();
  } catch (err: any) {
    malformedRejected = err.message.includes('DATABASE_URL is malformed and cannot be parsed');
  }
  check('Malformed DATABASE_URL strictly rejected', malformedRejected);

  // 1f. Invalid protocol (e.g. http://)
  process.env.DATABASE_URL = 'http://127.0.0.1:5432/homehub_test';
  let invalidProtoRejected = false;
  try {
    assertSafeDatabaseConfig();
  } catch (err: any) {
    invalidProtoRejected = err.message.includes('invalid protocol');
  }
  check('Non-postgres protocol in DATABASE_URL strictly rejected', invalidProtoRejected);

  // 1g. Unexpected database name / subpath (e.g. /homehub_test/other or /homehub_test_legacy)
  process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/homehub_test_legacy';
  let wrongPathRejected = false;
  try {
    assertSafeDatabaseConfig();
  } catch (err: any) {
    wrongPathRejected = err.message.includes('DATABASE_URL must explicitly target');
  }
  check('Unexpected database name in DATABASE_URL strictly rejected', wrongPathRejected);

  // 1h. Correct homehub_test configuration passes
  process.env.SQL_DB_NAME = TARGET_TEST_DATABASE;
  process.env.DATABASE_URL = 'postgres://user:pass@127.0.0.1:5432/homehub_test';
  let correctPassed = false;
  try {
    assertSafeDatabaseConfig();
    correctPassed = true;
  } catch {
    correctPassed = false;
  }
  check('Valid homehub_test database configuration accepted', correctPassed);

  // --------------------------------------------------------------------------
  // 2. FIXED CONFIGURATION IMMUTABILITY
  // --------------------------------------------------------------------------
  console.log('\n--- 2. FIXED CONFIGURATION IMMUTABILITY ---');
  const clientConfig = getSafeTestDbConfig({ database: 'malicious_override' });
  check('Client config database cannot be overridden from homehub_test', clientConfig.database === TARGET_TEST_DATABASE, `database=${clientConfig.database}`);

  const poolConfig = getSafePoolConfig({ database: 'malicious_pool_override' });
  check('Pool config database cannot be overridden from homehub_test', poolConfig.database === TARGET_TEST_DATABASE, `database=${poolConfig.database}`);

  // --------------------------------------------------------------------------
  // 3. CLI PROCESS FAIL-CLOSED TERMINATION
  // --------------------------------------------------------------------------
  console.log('\n--- 3. CLI PROCESS FAIL-CLOSED TERMINATION ---');
  const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
  const relScriptPath = 'tests/real-postgres-integration.test.ts';

  // 3a. Process run with SQL_DB_NAME=homehub_production
  const prodProc = spawnSync(process.execPath, [tsxCli, relScriptPath], {
    env: { ...process.env, SQL_DB_NAME: 'homehub_production', DATABASE_URL: '' },
    encoding: 'utf-8',
    timeout: 15000,
  });
  check('CLI process with SQL_DB_NAME=homehub_production exits with code 1', prodProc.status === 1, `exitCode=${prodProc.status}`);
  check('CLI process prints HARD SAFETY GATE TRIGGERED', prodProc.stderr.includes('HARD SAFETY GATE TRIGGERED') || prodProc.stdout.includes('HARD SAFETY GATE TRIGGERED'), `output=${(prodProc.stderr || prodProc.stdout || '').trim()}`);

  // 3b. Process run with arbitrary SQL_DB_NAME
  const wrongProc = spawnSync(process.execPath, [tsxCli, relScriptPath], {
    env: { ...process.env, SQL_DB_NAME: 'some_other_db', DATABASE_URL: '' },
    encoding: 'utf-8',
    timeout: 15000,
  });
  check('CLI process with wrong SQL_DB_NAME exits with code 1', wrongProc.status === 1, `exitCode=${wrongProc.status}`);
  check('CLI process rejects wrong SQL_DB_NAME with safety message', wrongProc.stderr.includes('HARD SAFETY GATE TRIGGERED') || wrongProc.stdout.includes('HARD SAFETY GATE TRIGGERED'));

  // --------------------------------------------------------------------------
  // 4. PREFLIGHT VERIFICATION & FINALLY CLEANUP
  // --------------------------------------------------------------------------
  console.log('\n--- 4. PREFLIGHT VERIFICATION & FINALLY CLEANUP ---');

  // 4a. Preflight client closed in finally when connect fails
  let endCalledOnConnectFail = false;
  const failingConnectClient = {
    connect: async () => { throw new Error('Simulated network error during connect'); },
    query: async () => ({ rows: [] }),
    end: async () => { endCalledOnConnectFail = true; },
  } as unknown as pg.Client;

  let connectFailCaught = false;
  try {
    await executePreflightVerification(failingConnectClient);
  } catch (err: any) {
    connectFailCaught = err.message.includes('Simulated network error');
  }
  check('Preflight caught connection error', connectFailCaught);
  check('Preflight client closed in finally when connect() fails', endCalledOnConnectFail);

  // 4b. Preflight client closed in finally when database identity fails
  let endCalledOnIdFail = false;
  const wrongDbClient = {
    connect: async () => {},
    query: async () => ({
      rows: [{ db: 'homehub_production', usr: EXPECTED_RUNTIME_USER }],
    }),
    end: async () => { endCalledOnIdFail = true; },
  } as unknown as pg.Client;

  let wrongDbCaught = false;
  try {
    await executePreflightVerification(wrongDbClient);
  } catch (err: any) {
    wrongDbCaught = err.message.includes('FATAL SAFETY VIOLATION') && err.message.includes('homehub_production');
  }
  check('Preflight rejected wrong database identity', wrongDbCaught);
  check('Preflight client closed in finally when database check fails', endCalledOnIdFail);

  // 4c. Preflight client closed in finally when runtime user is wrong
  let endCalledOnUserFail = false;
  const wrongUserClient = {
    connect: async () => {},
    query: async () => ({
      rows: [{ db: TARGET_TEST_DATABASE, usr: 'postgres' }],
    }),
    end: async () => { endCalledOnUserFail = true; },
  } as unknown as pg.Client;

  let wrongUserCaught = false;
  try {
    await executePreflightVerification(wrongUserClient);
  } catch (err: any) {
    wrongUserCaught = err.message.includes('FATAL SAFETY VIOLATION') && err.message.includes('postgres');
  }
  check('Preflight rejected unauthorized user identity', wrongUserCaught);
  check('Preflight client closed in finally when user check fails', endCalledOnUserFail);

  // --------------------------------------------------------------------------
  // 5. ACTUAL CONNECTION IDENTITY CHECK BEFORE WRITES
  // --------------------------------------------------------------------------
  console.log('\n--- 5. ACTUAL CONNECTION IDENTITY CHECK BEFORE WRITES ---');
  let actualConnEndCalled = false;
  let actualConnReleaseCalled = false;
  const executedQueries: string[] = [];

  const mockPreflightValid = {
    connect: async () => {},
    query: async () => ({
      rows: [{ db: TARGET_TEST_DATABASE, usr: EXPECTED_RUNTIME_USER }],
    }),
    end: async () => {},
  } as unknown as pg.Client;

  const mockWrongDbActualClient = {
    query: async (sql: string) => {
      executedQueries.push(sql);
      if (sql.includes('SELECT current_database()')) {
        return { rows: [{ db: 'wrong_db_name', usr: EXPECTED_RUNTIME_USER }] };
      }
      return { rows: [] };
    },
    release: () => { actualConnReleaseCalled = true; },
  };

  const mockWrongDbPool = {
    connect: async () => mockWrongDbActualClient,
    end: async () => { actualConnEndCalled = true; },
  } as unknown as pg.Pool;

  process.env.SQL_DB_NAME = TARGET_TEST_DATABASE;
  let actualIdRejected = false;
  try {
    await runRealDatabaseTests({
      pool: mockWrongDbPool,
      preflightClient: mockPreflightValid,
    });
  } catch (err: any) {
    actualIdRejected = err.message.includes('FATAL SAFETY VIOLATION: Actual connection reported database');
  }
  check('Actual connection with wrong db rejected before writes', actualIdRejected);
  check('Zero write or BEGIN queries executed when connection verification fails', !executedQueries.some(q => q.includes('BEGIN') || q.includes('INSERT')), `executed=${executedQueries.join(', ')}`);
  check('Actual client released in finally on verification failure', actualConnReleaseCalled);
  check('Pool ended in finally on verification failure', actualConnEndCalled);

  // --------------------------------------------------------------------------
  // 6. ROLLBACK & RESOURCE CLEANUP ON INJECTED TRANSACTION FAILURE
  // --------------------------------------------------------------------------
  console.log('\n--- 6. ROLLBACK & RESOURCE CLEANUP ON INJECTED FAILURE ---');
  let rollbackExecuted = false;
  let clientReleasedOnFail = false;
  let poolEndedOnFail = false;
  const failureQueries: string[] = [];
  let capturedEmail = '';

  const mockTxClient = {
    query: async (sql: string, params?: any[]) => {
      failureQueries.push(sql);
      if (sql.includes('SELECT current_database()')) {
        return { rows: [{ db: TARGET_TEST_DATABASE, usr: EXPECTED_RUNTIME_USER }] };
      }
      if (sql === 'ROLLBACK;') {
        rollbackExecuted = true;
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO users')) {
        capturedEmail = (params && params[3]) ? params[3] : 'operator@homehub.test';
        return { rows: [{ id: 'user-test', email: capturedEmail, is_active: true }], rowCount: 1 };
      }
      if (sql.startsWith('SELECT * FROM users')) {
        return { rows: [{ id: 'user-test', email: capturedEmail }] };
      }
      if (sql.startsWith('UPDATE users')) {
        return { rows: [{ phone: '+9647500000000' }] };
      }
      return { rows: [] };
    },
    release: () => { clientReleasedOnFail = true; },
  };

  const mockTxPool = {
    connect: async () => mockTxClient,
    end: async () => { poolEndedOnFail = true; },
  } as unknown as pg.Pool;

  let injectedCaught = false;
  try {
    await runRealDatabaseTests({
      pool: mockTxPool,
      preflightClient: mockPreflightValid,
      injectedFailure: 'during_mutation',
    });
  } catch (err: any) {
    injectedCaught = err.message === 'INJECTED_FAILURE_DURING_MUTATION';
  }
  check('Injected mutation failure caught by caller', injectedCaught);
  check('Outer ROLLBACK was executed in finally', rollbackExecuted);
  check('Client was released in finally', clientReleasedOnFail);
  check('Pool was shut down in finally', poolEndedOnFail);

  // --------------------------------------------------------------------------
  // 7. CLEANUP GUARANTEE & REPORTING EVEN IF ROLLBACK FAILS
  // --------------------------------------------------------------------------
  console.log('\n--- 7. CLEANUP GUARANTEE & REPORTING EVEN IF ROLLBACK FAILS ---');
  let clientReleasedOnRbFail = false;
  let poolEndedOnRbFail = false;

  const mockRbFailClient = {
    query: async (sql: string) => {
      if (sql.includes('SELECT current_database()')) {
        return { rows: [{ db: TARGET_TEST_DATABASE, usr: EXPECTED_RUNTIME_USER }] };
      }
      return { rows: [] };
    },
    release: () => { clientReleasedOnRbFail = true; },
  };

  const mockRbFailPool = {
    connect: async () => mockRbFailClient,
    end: async () => { poolEndedOnRbFail = true; },
  } as unknown as pg.Pool;

  let rbFailureReported = false;
  try {
    await runRealDatabaseTests({
      pool: mockRbFailPool,
      preflightClient: mockPreflightValid,
      injectedFailure: 'during_rollback',
    });
  } catch (err: any) {
    rbFailureReported = err.message.includes('CRITICAL_ROLLBACK_FAILURE') &&
      err.message.includes('INJECTED_ROLLBACK_FAILURE') &&
      err.message.includes('Database state may be contaminated');
  }
  check('Rollback failure is reported as critical and warns of contamination', rbFailureReported);
  check('Client is still released even when rollback fails', clientReleasedOnRbFail);
  check('Pool is still shut down even when rollback fails', poolEndedOnRbFail);

  // Restore env
  if (savedEnvDb !== undefined) process.env.SQL_DB_NAME = savedEnvDb;
  else delete process.env.SQL_DB_NAME;
  if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;
  else delete process.env.DATABASE_URL;

  console.log('\n================================================================');
  console.log(`🎉 ALL SAFETY HARNESS CHECKS PASSED: ${passedCount} passed, ${failedCount} failed.`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllSafetyChecks().catch((err) => {
  console.error('Safety harness suite execution failed:', err);
  process.exit(1);
});
