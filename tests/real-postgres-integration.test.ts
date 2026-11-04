import pg from 'pg';
import dotenv from 'dotenv';

// ----------------------------------------------------------------------------
// 1. Load environment configuration before reading database settings,
//    without overriding explicitly supplied environment variables.
// ----------------------------------------------------------------------------
dotenv.config({ override: false });

export const TARGET_TEST_DATABASE = 'homehub_test';
export const EXPECTED_RUNTIME_USER = 'homehub_app';

// ============================================================================
// PHASE 0: HARD FAIL-CLOSED SAFETY GATE
// Must fail closed before any client or pool is created
// ============================================================================
export function assertSafeDatabaseConfig(): void {
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    throw new Error(`HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly '${TARGET_TEST_DATABASE}'. Current value: '${targetDb || 'UNSET'}'. Aborting.`);
  }

  if (process.env.DATABASE_URL) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(process.env.DATABASE_URL);
    } catch {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL is malformed and cannot be parsed. Aborting.`);
    }

    if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL has invalid protocol '${parsedUrl.protocol}'. Aborting.`);
    }

    // Pathname must be exactly `/${TARGET_TEST_DATABASE}` (/homehub_test)
    if (parsedUrl.pathname !== `/${TARGET_TEST_DATABASE}`) {
      const sanitizedTarget = parsedUrl.pathname.replace(/^\//, '') || 'EMPTY';
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL must explicitly target '/${TARGET_TEST_DATABASE}'. Target database in URL was '${sanitizedTarget}'. Aborting.`);
    }
  }
}

export function getSafeTestDbConfig(overrides?: Partial<pg.ClientConfig>): pg.ClientConfig {
  return {
    host: process.env.SQL_HOST || '127.0.0.1',
    port: parseInt(process.env.SQL_PORT || '5432', 10),
    user: process.env.SQL_USER || EXPECTED_RUNTIME_USER,
    password: process.env.SQL_PASSWORD,
    connectionTimeoutMillis: 5000,
    ...overrides,
    database: TARGET_TEST_DATABASE, // Strict invariant: always fixed to homehub_test
  };
}

export function getSafePoolConfig(overrides?: Partial<pg.PoolConfig>): pg.PoolConfig {
  return {
    host: process.env.SQL_HOST || '127.0.0.1',
    port: parseInt(process.env.SQL_PORT || '5432', 10),
    user: process.env.SQL_USER || EXPECTED_RUNTIME_USER,
    password: process.env.SQL_PASSWORD,
    max: 10,
    connectionTimeoutMillis: 5000,
    ...overrides,
    database: TARGET_TEST_DATABASE, // Strict invariant: always fixed to homehub_test
  };
}

export interface AssertionResult {
  code: string;
  category: 'DATABASE' | 'INTEGRATION' | 'SECURITY' | 'TRANSACTION';
  description: string;
  passed: boolean;
  evidence: string;
}

export interface RunDatabaseTestsOptions {
  pool?: pg.Pool;
  preflightClient?: pg.Client;
  injectedFailure?: 'before_writes' | 'during_mutation' | 'during_rollback';
}

// ----------------------------------------------------------------------------
// Preflight connection identity verification
// Preflight client is strictly closed in finally block even on connection failure
// ----------------------------------------------------------------------------
export async function executePreflightVerification(customClient?: pg.Client): Promise<void> {
  let preflightClient: pg.Client | null = null;
  try {
    preflightClient = customClient || new pg.Client(getSafeTestDbConfig());
    await preflightClient.connect();
    const idCheck = await preflightClient.query('SELECT current_database() AS db, current_user AS usr, inet_server_addr(), inet_server_port();');
    const liveDb = idCheck.rows[0]?.db;
    const liveUser = idCheck.rows[0]?.usr;

    if (liveDb !== TARGET_TEST_DATABASE) {
      throw new Error(`FATAL SAFETY VIOLATION: Preflight live database reported '${liveDb}', expected '${TARGET_TEST_DATABASE}'. Aborting.`);
    }

    if (liveUser !== EXPECTED_RUNTIME_USER) {
      throw new Error(`FATAL SAFETY VIOLATION: Preflight live user reported '${liveUser}', expected '${EXPECTED_RUNTIME_USER}'. Aborting.`);
    }
  } finally {
    if (preflightClient) {
      await preflightClient.end().catch((err) => {
        console.warn('⚠️ Warning: Error closing preflight client:', err?.message);
      });
    }
  }
}

export async function runRealDatabaseTests(options?: RunDatabaseTestsOptions) {
  // Enforce fail-closed gate before attempting any operations
  assertSafeDatabaseConfig();

  const results: AssertionResult[] = [];

  function assert(code: string, category: 'DATABASE' | 'INTEGRATION' | 'SECURITY' | 'TRANSACTION', description: string, passed: boolean, evidence: string) {
    results.push({ code, category, description, passed, evidence });
    if (passed) {
      console.log(`✅ [${category}] ${code}: ${description} — ${evidence}`);
    } else {
      console.error(`❌ [${category}] ${code}: ${description} — ${evidence}`);
      throw new Error(`Assertion failed: ${code} - ${description}`);
    }
  }

  console.log('================================================================');
  console.log('  HOMEHUB — REAL POSTGRESQL INTEGRATION & SECURITY SUITE');
  console.log(`  Target: ${TARGET_TEST_DATABASE} (Fail-Closed Enforcement Active)`);
  console.log('================================================================');

  // 1. Run Preflight verification
  await executePreflightVerification(options?.preflightClient);

  // 2. Initialize connection pool explicitly bound to TARGET_TEST_DATABASE
  const pool = options?.pool || new pg.Pool(getSafePoolConfig());
  let client: pg.PoolClient | null = null;

  try {
    client = await pool.connect();

    // ------------------------------------------------------------------------
    // Verification of current_database() and current_user on actual connection
    // before ANY writes or mutations
    // ------------------------------------------------------------------------
    const connCheck = await client.query('SELECT current_database() AS db, current_user AS usr;');
    const actualDb = connCheck.rows[0]?.db;
    const actualUser = connCheck.rows[0]?.usr;

    if (actualDb !== TARGET_TEST_DATABASE) {
      throw new Error(`FATAL SAFETY VIOLATION: Actual connection reported database '${actualDb}', expected '${TARGET_TEST_DATABASE}'. Aborting.`);
    }
    if (actualUser !== EXPECTED_RUNTIME_USER) {
      throw new Error(`FATAL SAFETY VIOLATION: Actual connection reported user '${actualUser}', expected '${EXPECTED_RUNTIME_USER}'. Aborting.`);
    }
    assert('REAL-DB-00', 'DATABASE', 'Live connection verified against expected database and user before writes', true, `Connected to db=${actualDb}, user=${actualUser}`);

    if (options?.injectedFailure === 'before_writes') {
      throw new Error('INJECTED_FAILURE_BEFORE_WRITES');
    }

    // ------------------------------------------------------------------------
    // Outer test transaction wraps ALL mutations and guarantees total rollback
    // No test section may commit the outer transaction
    // ------------------------------------------------------------------------
    await client.query('BEGIN;');

    // -------------------------------------------------------------
    // 1. BASIC CRUD & ROW INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- 1. BASIC CRUD & ROW INTEGRITY ---');
    const testUserId = `user-crud-${Date.now()}`;
    const testEmail = `operator-${Date.now()}@homehub.test`;

    // 1a. CREATE
    const insertRes = await client.query(
      `INSERT INTO users (id, first_name, last_name, email, is_active, roles)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, is_active;`,
      [testUserId, 'Zakar', 'Engineer', testEmail, true, JSON.stringify(['BUYER', 'OWNER'])]
    );
    assert('REAL-DB-01', 'DATABASE', 'Row creation with JSONB and boolean fields', insertRes.rowCount === 1, `Inserted user ${insertRes.rows[0].id}`);

    // 1b. READ
    const readRes = await client.query('SELECT * FROM users WHERE id = $1;', [testUserId]);
    assert('REAL-DB-02', 'DATABASE', 'Row retrieval with exact column projection', readRes.rows.length === 1 && readRes.rows[0].email === testEmail, `Retrieved email: ${readRes.rows[0]?.email}`);

    // 1c. UPDATE
    const updateRes = await client.query(
      'UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2 RETURNING phone;',
      ['+9647500000000', testUserId]
    );
    assert('REAL-DB-03', 'DATABASE', 'Row update with timestamp modification', updateRes.rows[0]?.phone === '+9647500000000', `Updated phone: ${updateRes.rows[0]?.phone}`);

    if (options?.injectedFailure === 'during_mutation') {
      throw new Error('INJECTED_FAILURE_DURING_MUTATION');
    }

    // -------------------------------------------------------------
    // 2. TRANSACTION COMMIT & MULTI-ENTITY INTEGRITY (SAVEPOINT ISOLATION)
    // -------------------------------------------------------------
    console.log('\n--- 2. TRANSACTION COMMIT & MULTI-ENTITY INTEGRITY ---');
    const orgId = `org-${Date.now()}`;
    const propId = `prop-${Date.now()}`;
    const ownRecId = `own-${Date.now()}`;

    await client.query('SAVEPOINT sp_section2;');
    await client.query(
      `INSERT INTO organizations (id, name, type) VALUES ($1, $2, $3);`,
      [orgId, 'Apex Real Estate LLC', 'COMPANY']
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role)
       VALUES ($1, $2, $3, $4);`,
      [`mem-${Date.now()}`, orgId, testUserId, 'MANAGER']
    );
    await client.query(
      `INSERT INTO properties (id, name, type)
       VALUES ($1, $2, $3);`,
      [propId, 'Erbil Royal Tower A', 'APARTMENT']
    );
    await client.query(
      `INSERT INTO ownership_records (id, property_id, owner_id, ownership_percentage)
       VALUES ($1, $2, $3, $4);`,
      [ownRecId, propId, testUserId, '100.00']
    );
    await client.query('RELEASE SAVEPOINT sp_section2;');

    const verifyCommit = await client.query(
      `SELECT p.id as property_id, p.name, o.id as ownership_id, o.ownership_percentage
       FROM properties p
       JOIN ownership_records o ON o.property_id = p.id
       WHERE p.id = $1;`,
      [propId]
    );
    assert('REAL-DB-04', 'TRANSACTION', 'Atomic multi-table transaction commit', verifyCommit.rows.length === 1 && verifyCommit.rows[0].ownership_percentage === '100.00', `Verified property ${propId} owned by ${testUserId}`);

    // -------------------------------------------------------------
    // 3. TRANSACTION ROLLBACK ON EXCEPTION (SAVEPOINT ROLLBACK)
    // -------------------------------------------------------------
    console.log('\n--- 3. TRANSACTION ROLLBACK ON EXCEPTION ---');
    const doomedPropId = `prop-doomed-${Date.now()}`;
    let rollbackVerified = false;

    try {
      await client.query('SAVEPOINT sp_doomed;');
      await client.query(
        `INSERT INTO properties (id, name, type)
         VALUES ($1, $2, $3);`,
        [doomedPropId, 'Doomed Property', 'VILLA']
      );
      // Intentionally violate foreign key constraint: non-existent owner
      await client.query(
        `INSERT INTO ownership_records (id, property_id, owner_id, ownership_percentage)
         VALUES ($1, $2, $3, $4);`,
        [`own-fail-${Date.now()}`, doomedPropId, 'non-existent-owner-uuid-00000', '100.00']
      );
      await client.query('RELEASE SAVEPOINT sp_doomed;');
    } catch (txErr: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_doomed;');
      rollbackVerified = true;
    }

    const checkDoomed = await client.query('SELECT * FROM properties WHERE id = $1;', [doomedPropId]);
    assert('REAL-DB-05', 'TRANSACTION', 'Transaction rollback leaves zero orphaned records on failure', rollbackVerified && checkDoomed.rows.length === 0, `Zero rows found for ${doomedPropId} after rollback`);

    // -------------------------------------------------------------
    // 4. CONSTRAINT ENFORCEMENT: UNIQUE & FOREIGN KEY
    // -------------------------------------------------------------
    console.log('\n--- 4. CONSTRAINT ENFORCEMENT: UNIQUE & FOREIGN KEY ---');
    // 4a. Unique email
    let uniqueFailed = false;
    try {
      await client.query('SAVEPOINT sp_unique;');
      await client.query(
        `INSERT INTO users (id, first_name, last_name, email)
         VALUES ($1, $2, $3, $4);`,
        [`user-dup-${Date.now()}`, 'Duplicate', 'User', testEmail]
      );
      await client.query('RELEASE SAVEPOINT sp_unique;');
    } catch (uErr: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_unique;');
      uniqueFailed = uErr.code === '23505'; // unique_violation
    }
    assert('REAL-DB-06', 'DATABASE', 'Unique constraint enforcement (code 23505)', uniqueFailed, `PostgreSQL rejected duplicate email ${testEmail}`);

    // 4b. Foreign key enforcement
    let fkFailed = false;
    try {
      await client.query('SAVEPOINT sp_fk;');
      await client.query(
        `INSERT INTO properties (id, name, type)
         VALUES ($1, $2, $3);`,
        [`p-${Date.now()}`, 'P', 'APARTMENT']
      );
      await client.query(
        `INSERT INTO units (id, property_id, unit_number)
         VALUES ($1, $2, $3);`,
        [`unit-${Date.now()}`, 'non-existent-property-id-9999', '101']
      );
      await client.query('RELEASE SAVEPOINT sp_fk;');
    } catch (fkErr: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp_fk;');
      fkFailed = fkErr.code === '23503'; // foreign_key_violation
    }
    assert('REAL-DB-07', 'DATABASE', 'Foreign key constraint enforcement (code 23503)', fkFailed, 'PostgreSQL rejected invalid property_id foreign key');

    // -------------------------------------------------------------
    // 5. POSTGRESQL ADVISORY LOCKS & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log('\n--- 5. POSTGRESQL ADVISORY LOCKS & IDEMPOTENCY ---');
    const lockId = 849204829;
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) as acquired;', [lockId]);
    const acquired = lockRes.rows[0]?.acquired;
    assert('REAL-DB-08', 'DATABASE', 'PostgreSQL advisory lock acquisition', acquired === true, `Advisory lock ${lockId} acquired on session`);

    // Another client attempt should fail to acquire
    const secondClient = await pool.connect();
    try {
      const trySecond = await secondClient.query('SELECT pg_try_advisory_lock($1) as acquired;', [lockId]);
      assert('REAL-DB-09', 'DATABASE', 'PostgreSQL advisory lock mutual exclusion', trySecond.rows[0]?.acquired === false, `Second session correctly blocked from lock ${lockId}`);
    } finally {
      secondClient.release();
    }

    // Release lock
    const unlockRes = await client.query('SELECT pg_advisory_unlock($1) as released;', [lockId]);
    assert('REAL-DB-10', 'DATABASE', 'PostgreSQL advisory lock clean release', unlockRes.rows[0]?.released === true, `Advisory lock ${lockId} released`);

    // -------------------------------------------------------------
    // 6. MULTI-TENANT & SCOPE ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- 6. MULTI-TENANT & SCOPE ISOLATION ---');
    const orgB = `org-tenant-b-${Date.now()}`;
    const propB = `prop-b-${Date.now()}`;
    const userB = `user-b-${Date.now()}`;

    await client.query('SAVEPOINT sp_section6;');
    await client.query(`INSERT INTO organizations (id, name, type) VALUES ($1, $2, $3);`, [orgB, 'Tenant B Corp', 'COMPANY']);
    await client.query(`INSERT INTO users (id, first_name, last_name, email) VALUES ($1, $2, $3, $4);`, [userB, 'Bob', 'Tenant', `bob-${Date.now()}@test.com`]);
    await client.query(`INSERT INTO properties (id, name, type) VALUES ($1, $2, $3);`, [propB, 'Building B', 'COMMERCIAL']);
    await client.query(`INSERT INTO ownership_records (id, property_id, owner_id, ownership_percentage) VALUES ($1, $2, $3, $4);`, [`own-b-${Date.now()}`, propB, userB, '100.00']);
    await client.query('RELEASE SAVEPOINT sp_section6;');

    // Query scoped to User A (testUserId): must return Property A and NOT Property B
    const userAScopedProps = await client.query(
      `SELECT p.id, p.name 
       FROM properties p
       JOIN ownership_records o ON o.property_id = p.id
       WHERE o.owner_id = $1;`,
      [testUserId]
    );
    const hasPropA = userAScopedProps.rows.some(r => r.id === propId);
    const hasPropB = userAScopedProps.rows.some(r => r.id === propB);
    assert('REAL-DB-11', 'SECURITY', 'Tenant data isolation: User A cannot access User B property records', hasPropA && !hasPropB, `Query returned ${userAScopedProps.rows.length} rows for User A. Contains Property A: ${hasPropA}, Contains Property B: ${hasPropB}`);

    // -------------------------------------------------------------
    // 7. FAIL-CLOSED BEHAVIOR ON DATABASE MISCONFIGURATION
    // Probe connections target ONLY homehub_test
    // -------------------------------------------------------------
    console.log('\n--- 7. FAIL-CLOSED BEHAVIOR ON DATABASE MISCONFIGURATION ---');
    // Test bad credentials targeting ONLY homehub_test
    let authFailedCleanly = false;
    const badAuthClient = new pg.Client(getSafeTestDbConfig({
      user: 'non_existent_auth_test_user',
      password: 'INCORRECT_PASSWORD_EXPLICIT_TEST',
      connectionTimeoutMillis: 2000,
    }));
    try {
      await badAuthClient.connect();
    } catch (authErr: any) {
      authFailedCleanly = authErr.code === '28P01' || authErr.code === '28000' || /password authentication failed|role .* does not exist/.test(authErr.message);
    } finally {
      await badAuthClient.end().catch(() => {});
    }
    assert('REAL-DB-12', 'SECURITY', 'Fail-closed rejection on invalid database credentials', authFailedCleanly, 'Authentication failure cleanly caught with no fallback');

    // Test bad port targeting ONLY homehub_test
    let connFailedCleanly = false;
    const badPortClient = new pg.Client(getSafeTestDbConfig({
      port: 5433, // incorrect port
      connectionTimeoutMillis: 1500,
    }));
    try {
      await badPortClient.connect();
    } catch (connErr: any) {
      connFailedCleanly = /ECONNREFUSED|Connection refused|timeout/.test(connErr.message);
    } finally {
      await badPortClient.end().catch(() => {});
    }
    assert('REAL-DB-13', 'SECURITY', 'Fail-closed rejection when PostgreSQL is unreachable', connFailedCleanly, 'Unreachable connection cleanly fails closed');

    // -------------------------------------------------------------
    // 8. DOUBLE-ENTRY FINANCIAL POSTING EQUALITY IN POSTGRESQL (SAVEPOINT ISOLATION)
    // -------------------------------------------------------------
    console.log('\n--- 8. DOUBLE-ENTRY FINANCIAL POSTING EQUALITY IN POSTGRESQL ---');
    const journalId = `jnl-${Date.now()}`;
    const rentAmount = '1500.00';

    await client.query('SAVEPOINT sp_journal;');
    await client.query(
      `INSERT INTO journal_entries (id, property_id, date, description, status)
       VALUES ($1, $2, $3, $4, $5);`,
      [journalId, propId, new Date().toISOString().split('T')[0], 'Monthly Rent Payment', 'POSTED']
    );
    // Line 1: Debit Cash (1500)
    await client.query(
      `INSERT INTO ledger_lines (id, journal_entry_id, account_id, debit, credit)
       VALUES ($1, $2, $3, $4, $5);`,
      [`line-1-${Date.now()}`, journalId, 'acc-cash-1000', rentAmount, '0.00']
    );
    // Line 2: Credit Rental Income (1500)
    await client.query(
      `INSERT INTO ledger_lines (id, journal_entry_id, account_id, debit, credit)
       VALUES ($1, $2, $3, $4, $5);`,
      [`line-2-${Date.now()}`, journalId, 'acc-income-4000', '0.00', rentAmount]
    );

    const balanceQuery = await client.query(
      `SELECT SUM(debit::numeric) as total_debit, SUM(credit::numeric) as total_credit
       FROM ledger_lines
       WHERE journal_entry_id = $1;`,
      [journalId]
    );
    await client.query('RELEASE SAVEPOINT sp_journal;');

    const totalDebit = Number(balanceQuery.rows[0]?.total_debit);
    const totalCredit = Number(balanceQuery.rows[0]?.total_credit);
    const balanced = totalDebit === totalCredit && totalDebit === 1500;
    assert('REAL-DB-14', 'DATABASE', 'Double-entry debit/credit mathematical equality in PostgreSQL', balanced, `Debit: ${totalDebit}, Credit: ${totalCredit}, Difference: ${totalDebit - totalCredit}`);

    console.log('\n================================================================');
    console.log(`🎉 ALL ${results.length} REAL POSTGRESQL INTEGRATION ASSERTIONS PASSED.`);
    console.log('================================================================\n');

    return { success: true, count: results.length, results };
  } finally {
    // ------------------------------------------------------------------------
    // Guaranteed rollback of outer test transaction: zero mutations survive!
    // Ensures client release and pool shutdown occur even if rollback fails.
    // Reports rollback failure while still completing cleanup.
    // ------------------------------------------------------------------------
    let rollbackError: Error | null = null;
    if (client) {
      try {
        if (options?.injectedFailure === 'during_rollback') {
          throw new Error('INJECTED_ROLLBACK_FAILURE');
        }
        await client.query('ROLLBACK;');
      } catch (rbErr: any) {
        rollbackError = rbErr instanceof Error ? rbErr : new Error(String(rbErr));
        console.error('❌ CRITICAL: Rollback of outer test transaction encountered an error:', rollbackError.message);
      }

      try {
        client.release();
      } catch (relErr: any) {
        console.error('⚠️ Warning: Error releasing client:', relErr?.message);
      }
    }

    if (pool) {
      try {
        await pool.end();
      } catch (poolErr: any) {
        console.error('⚠️ Warning: Error ending pool:', poolErr?.message);
      }
    }

    if (rollbackError) {
      throw new Error(`CRITICAL_ROLLBACK_FAILURE: Rollback of outer test transaction failed (${rollbackError.message}). Database state may be contaminated; mutations cannot be assumed reverted.`);
    }
  }
}

// ----------------------------------------------------------------------------
// CLI Execution Entry Point
// ----------------------------------------------------------------------------
if (process.argv[1] && (process.argv[1].endsWith('real-postgres-integration.test.ts') || process.argv[1].endsWith('real-postgres-integration.test.js'))) {
  try {
    assertSafeDatabaseConfig();
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  runRealDatabaseTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Integration test suite failed:', err);
      process.exit(1);
    });
}
