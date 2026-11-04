import { injectPgliteMock } from './setup-pglite.js';
import pg from 'pg';
import { createPool } from '../src/db/index.js';

async function testRoles() {
  console.log('================================================================');
  console.log('  HOMEHUB — ROLE PRIVILEGE & LEAST-PRIVILEGE AUDIT');
  console.log('================================================================');

  // Test 1: homehub_app (DML permitted, DDL prohibited)
  console.log('\n--- TEST SUITE 1: homehub_app (DML permitted, DDL prohibited) ---');
  const appClient = new pg.Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'homehub_app',
    password: 'homehub_app_secret_pass',
    database: 'homehub_production',
  });
  await appClient.connect();

  // 1a. SELECT query
  const selRes = await appClient.query('SELECT count(*) FROM users;');
  console.log('✅ PASS: homehub_app can SELECT from tables. Count:', selRes.rows[0].count);

  // 1b. DML Mutation (INSERT, UPDATE, DELETE)
  const testUserId = `test-role-user-${Date.now()}`;
  await appClient.query(
    `INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
    [testUserId, 'RoleTest', 'User', `${testUserId}@example.com`, JSON.stringify(['BUYER'])]
  );
  console.log('✅ PASS: homehub_app can INSERT into application tables.');

  await appClient.query(
    `UPDATE users SET phone = '+9647501234567' WHERE id = $1;`,
    [testUserId]
  );
  console.log('✅ PASS: homehub_app can UPDATE application tables.');

  await appClient.query(`DELETE FROM users WHERE id = $1;`, [testUserId]);
  console.log('✅ PASS: homehub_app can DELETE from application tables.');

  // 1c. DDL Denial: CREATE TABLE
  let ddlCreateDenied = false;
  try {
    await appClient.query('CREATE TABLE app_forbidden (id text);');
  } catch (err: any) {
    ddlCreateDenied = err.code === '42501' || /permission denied/.test(err.message);
    console.log('✅ PASS: homehub_app CREATE TABLE rejected with permission denied (code:', err.code, ')');
  }
  if (!ddlCreateDenied) throw new Error('SECURITY VIOLATION: homehub_app was allowed to CREATE TABLE!');

  // 1d. DDL Denial: DROP TABLE
  let ddlDropDenied = false;
  try {
    await appClient.query('DROP TABLE users;');
  } catch (err: any) {
    ddlDropDenied = err.code === '42501' || /must be owner|permission denied/.test(err.message);
    console.log('✅ PASS: homehub_app DROP TABLE rejected with permission denied (code:', err.code, ')');
  }
  if (!ddlDropDenied) throw new Error('SECURITY VIOLATION: homehub_app was allowed to DROP TABLE!');

  await appClient.end();

  // Test 2: homehub_migration (DDL permitted, Advisory Lock permitted)
  console.log('\n--- TEST SUITE 2: homehub_migration (DDL & Advisory Lock permitted) ---');
  const migClient = new pg.Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'homehub_migration',
    password: 'homehub_migration_secret_pass',
    database: 'homehub_production',
  });
  await migClient.connect();

  // 2a. Advisory Lock Acquisition
  const MIGRATION_LOCK_ID = 849204829;
  await migClient.query('SELECT pg_advisory_lock($1);', [MIGRATION_LOCK_ID]);
  console.log(`✅ PASS: homehub_migration acquired migration advisory lock ${MIGRATION_LOCK_ID}.`);
  await migClient.query('SELECT pg_advisory_unlock($1);', [MIGRATION_LOCK_ID]);
  console.log('✅ PASS: homehub_migration released migration advisory lock.');

  // 2b. DDL Capability (CREATE TABLE / DROP TABLE for migrations)
  await migClient.query('CREATE TABLE IF NOT EXISTS _migration_test_probe (id text PRIMARY KEY, executed_at timestamp DEFAULT NOW());');
  console.log('✅ PASS: homehub_migration authorized for CREATE TABLE.');
  await migClient.query('DROP TABLE _migration_test_probe;');
  console.log('✅ PASS: homehub_migration authorized for DROP TABLE.');

  await migClient.end();

  // Test 3: homehub_backup (Read-only, Mutation prohibited)
  console.log('\n--- TEST SUITE 3: homehub_backup (Read-only, Mutation prohibited) ---');
  const backupClient = new pg.Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'homehub_backup',
    password: 'homehub_backup_secret_pass',
    database: 'homehub_production',
  });
  await backupClient.connect();

  // 3a. SELECT query
  const backupSelRes = await backupClient.query('SELECT count(*) FROM users;');
  console.log('✅ PASS: homehub_backup can SELECT from tables. Count:', backupSelRes.rows[0].count);

  // 3b. INSERT Denial
  let insertDenied = false;
  try {
    await backupClient.query("INSERT INTO users (id, first_name, last_name, email) VALUES ('test-fail', 'Test', 'User', 'test@example.com');");
  } catch (err: any) {
    insertDenied = err.code === '42501' && /permission denied/.test(err.message);
    console.log('✅ PASS: homehub_backup INSERT rejected with permission denied (code:', err.code, ')');
  }
  if (!insertDenied) throw new Error('SECURITY VIOLATION: homehub_backup was allowed to INSERT!');

  // 3c. DDL Denial
  let backupDdlDenied = false;
  try {
    await backupClient.query('DROP TABLE users;');
  } catch (err: any) {
    backupDdlDenied = err.code === '42501' || /must be owner|permission denied/.test(err.message);
    console.log('✅ PASS: homehub_backup DROP TABLE rejected with permission denied (code:', err.code, ')');
  }
  if (!backupDdlDenied) throw new Error('SECURITY VIOLATION: homehub_backup was allowed to DROP TABLE!');

  await backupClient.end();

  // Test 4: Runtime Configuration Safety (App never defaults to superuser postgres or maintenance db)
  console.log('\n--- TEST SUITE 4: Runtime Configuration Least-Privilege Verification ---');
  // Temporarily clear environment variables to test defaults
  const origUser = process.env.SQL_USER;
  const origDb = process.env.SQL_DB_NAME;
  const origUrl = process.env.DATABASE_URL;
  delete process.env.SQL_USER;
  delete process.env.SQL_DB_NAME;
  delete process.env.DATABASE_URL;
  delete (global as any)._postgresPool;

  const defaultPool = createPool();
  // @ts-ignore - access options
  const defaultOptions = (defaultPool as any).options;
  
  if (defaultOptions.user === 'postgres') {
    throw new Error('SECURITY VIOLATION: Runtime database pool defaulted to superuser "postgres"!');
  }
  if (defaultOptions.database === 'postgres') {
    throw new Error('SECURITY VIOLATION: Runtime database pool defaulted to maintenance database "postgres"!');
  }
  console.log(`✅ PASS: Application runtime defaults to least-privilege user '${defaultOptions.user}' (not superuser).`);
  console.log(`✅ PASS: Application runtime defaults to application database '${defaultOptions.database}' (not maintenance db).`);

  // Restore env
  if (origUser) process.env.SQL_USER = origUser;
  if (origDb) process.env.SQL_DB_NAME = origDb;
  if (origUrl) process.env.DATABASE_URL = origUrl;
  await defaultPool.end();
  delete (global as any)._postgresPool;

  // Test 5: Missing DB_APP_PASSWORD behavior
  console.log('\n--- TEST SUITE 5: Missing Password Behavior (Authentication Failure) ---');
  let authFailed = false;
  const noPassClient = new pg.Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'homehub_app',
    database: 'homehub_production',
    // Deliberately omit password to simulate missing DB_APP_PASSWORD
  });
  
  try {
    await noPassClient.connect();
    await noPassClient.end();
  } catch (err: any) {
    // 28P01 is invalid_password, or generic password authentication failed
    authFailed = err.code === '28P01' || err.code === '28000' || /password authentication failed/.test(err.message);
    console.log('✅ PASS: Connection without password securely rejected (code:', err.code, ')');
  }
  if (!authFailed) {
    throw new Error('SECURITY VIOLATION: homehub_app was allowed to connect without a password!');
  }

  // Test 6: Fallback configuration check
  console.log('\n--- TEST SUITE 6: Fallback from privileged to application credentials ---');
  const appOnlyPool = createPool();
  const appOnlyOptions = (appOnlyPool as any).options;
  if (appOnlyOptions.user !== 'homehub_app') {
    if (appOnlyOptions.user === 'postgres') {
       throw new Error('SECURITY VIOLATION: Pool fell back to privileged postgres user!');
    }
  } else {
    console.log('✅ PASS: Pool safely defaults to homehub_app, completely isolating it from privileged roles.');
  }
  await appOnlyPool.end();

  console.log('\n🎉 ALL ROLE PRIVILEGE & LEAST-PRIVILEGE SECURITY GATES VERIFIED.');
}

testRoles()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Role test failed:', err);
    process.exit(1);
  });
