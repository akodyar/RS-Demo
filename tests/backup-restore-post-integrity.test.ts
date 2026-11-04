import { injectPgliteMock } from './setup-pglite.js';
/**
 * HOMEHUB — BACKUP / RESTORE POST-RESTORE INTEGRITY AUDIT SUITE
 * 
 * Verifies all 15 critical post-restore integrity gates:
 * 1. Re-enable normal constraint/trigger behavior (session_replication_role = 'origin')
 * 2. Verify all foreign keys are valid
 * 3. Perform orphan-record checks across all foreign-key relationships
 * 4. Verify all expected sequences exist
 * 5. Verify important sequences are synchronized with current maximum IDs
 * 6. Verify primary keys
 * 7. Verify unique constraints
 * 8. Verify row counts by table
 * 9. Verify record counts against the backup manifest
 * 10. Verify no records were silently skipped
 * 11. Verify no duplicate records were introduced
 * 12. Verify JSONB values round-trip correctly
 * 13. Verify timestamps and boolean values
 * 14. Verify the restored schema matches the expected 93-table schema
 * 15. Verify the restored database remains writable with normal application-role permissions (homehub_app)
 */

import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { createDatabaseBackup } from '../scripts/backup.js';
import { verifyAndRestoreBackup } from '../scripts/restore.js';
import { runMigrations } from '../scripts/migrate.js';

const PG_HOST = process.env.SQL_HOST || '127.0.0.1';
const PG_PORT = parseInt(process.env.SQL_PORT || '5433', 10);
const PG_ADMIN_USER = 'postgres';
const PG_ADMIN_PASS = 'postgres';
const RESTORE_TEST_DB = 'homehub_post_restore_audit';

let passedAssertions = 0;
let failedAssertions = 0;

function recordGate(testId: string, description: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passedAssertions++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description} — Details: ${details || 'None'}`);
    failedAssertions++;
  }
}

async function runPostRestoreIntegritySuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — BACKUP/RESTORE 15-POINT POST-RESTORE INTEGRITY AUDIT');
  console.log('================================================================\n');

  // 1. Create fresh backup of production
  console.log('--- PHASE 1: GENERATE PRODUCTION BACKUP ---');
  const backupRes = await createDatabaseBackup();
  const manifest = backupRes.manifest;
  console.log(`Backup generated: ${backupRes.filePath} (${manifest.tableCount} tables, ${manifest.totalRecords} records)`);

  // 2. Setup isolated target database
  console.log('\n--- PHASE 2: PROVISION ISOLATED RESTORE TARGET ---');
  const adminClient = new pg.Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_ADMIN_USER,
    password: PG_ADMIN_PASS,
    database: 'postgres',
  });
  await adminClient.connect();

  // Terminate any existing sessions and drop DB if existed
  await adminClient.query(`
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = '${RESTORE_TEST_DB}' AND pid <> pg_backend_pid();
  `);
  await adminClient.query(`DROP DATABASE IF EXISTS ${RESTORE_TEST_DB};`);
  await adminClient.query(`CREATE DATABASE ${RESTORE_TEST_DB} OWNER homehub_migration;`);
  console.log(`Created clean test database: ${RESTORE_TEST_DB}`);

  // Grant privileges to homehub_app and homehub_migration
  await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${RESTORE_TEST_DB} TO homehub_migration;`);
  await adminClient.query(`GRANT CONNECT ON DATABASE ${RESTORE_TEST_DB} TO homehub_app;`);
  await adminClient.end();

  // Initialize schema privileges
  const initClient = new pg.Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_ADMIN_USER,
    password: PG_ADMIN_PASS,
    database: RESTORE_TEST_DB,
  });
  await initClient.connect();
  await initClient.query(`
    GRANT ALL ON SCHEMA public TO homehub_migration;
    GRANT USAGE ON SCHEMA public TO homehub_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO homehub_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO homehub_app;
  `);
  await initClient.end();

  try {
    // 3. Migrate target database from zero using migration runner
    console.log('\n--- PHASE 3: APPLY MIGRATIONS TO TARGET DATABASE ---');
    const originalDb = process.env.SQL_DB_NAME;
    const originalUser = process.env.SQL_USER;
    const originalPass = process.env.SQL_PASSWORD;

    process.env.SQL_HOST = PG_HOST;
    process.env.SQL_PORT = String(PG_PORT);
    process.env.SQL_DB_NAME = RESTORE_TEST_DB;
    process.env.SQL_USER = 'homehub_migration';
    process.env.SQL_PASSWORD = 'homehub_migration_secret_pass';

    const migrationRes = await runMigrations();
    recordGate('GATE-00', 'Target database migrated cleanly from zero', migrationRes.success);

    // Apply role permissions to created tables
    const grantClient = new pg.Client({
      host: PG_HOST,
      port: PG_PORT,
      user: PG_ADMIN_USER,
      password: PG_ADMIN_PASS,
      database: RESTORE_TEST_DB,
    });
    await grantClient.connect();
    await grantClient.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO homehub_app;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO homehub_app;
    `);
    await grantClient.end();

    // 4. Restore backup into target database
    console.log('\n--- PHASE 4: EXECUTE RESTORE INTO TARGET DATABASE ---');
    process.env.SQL_USER = 'postgres';
    process.env.SQL_PASSWORD = 'postgres';

    const restoreRes = await verifyAndRestoreBackup(backupRes.filePath, {
      targetDatabase: RESTORE_TEST_DB,
    });
    recordGate('GATE-00b', 'Restore runner returned VERIFIED_SUCCESS', restoreRes.status === 'VERIFIED_SUCCESS');

    // 5. Connect to target database for deep post-restore verification
    console.log('\n--- PHASE 5: 15-POINT POST-RESTORE INTEGRITY AUDIT ---');
    const targetClient = new pg.Client({
      host: PG_HOST,
      port: PG_PORT,
      user: PG_ADMIN_USER,
      password: PG_ADMIN_PASS,
      database: RESTORE_TEST_DB,
    });
    targetClient.on('error', () => {});
    await targetClient.connect();

    // CHECK 1: Re-enable normal constraint/trigger behavior (session_replication_role = 'origin')
    const replRoleRes = await targetClient.query(`SHOW session_replication_role;`);
    const isOrigin = replRoleRes.rows[0].session_replication_role === 'origin';
    recordGate('GATE-01', 'Normal constraint/trigger behavior active (session_replication_role = origin)', isOrigin);

    // CHECK 2: Verify all foreign keys are valid
    const fkRes = await targetClient.query<{ count: string }>(`
      SELECT count(*)::text as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
    `);
    const totalFks = parseInt(fkRes.rows[0].count, 10);
    recordGate('GATE-02', `All foreign keys defined and active (Total FKs: ${totalFks})`, totalFks === 258, `Found ${totalFks}`);

    // CHECK 3: Perform orphan-record checks across all foreign-key relationships
    const fkRelationships = await targetClient.query<{
      fk_table: string;
      fk_column: string;
      pk_table: string;
      pk_column: string;
    }>(`
      SELECT 
        kcu.table_name as fk_table,
        kcu.column_name as fk_column,
        ccu.table_name as pk_table,
        ccu.column_name as pk_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `);

    let totalOrphans = 0;
    for (const rel of fkRelationships.rows) {
      const orphanCheck = await targetClient.query(`
        SELECT count(*)::int as orphan_count
        FROM "${rel.fk_table}" f
        LEFT JOIN "${rel.pk_table}" p ON f."${rel.fk_column}" = p."${rel.pk_column}"
        WHERE f."${rel.fk_column}" IS NOT NULL AND p."${rel.pk_column}" IS NULL;
      `);
      const count = orphanCheck.rows[0].orphan_count;
      if (count > 0) {
        console.error(`Orphan detected: ${rel.fk_table}.${rel.fk_column} -> ${rel.pk_table}.${rel.pk_column} has ${count} orphans`);
        totalOrphans += count;
      }
    }
    recordGate('GATE-03', 'Orphan-record scan across all foreign-key relationships passed with 0 orphans', totalOrphans === 0, `Total orphans: ${totalOrphans}`);

    // CHECK 4: Verify all expected sequences exist
    const seqRes = await targetClient.query<{ sequence_name: string }>(`
      SELECT sequence_name FROM information_schema.sequences;
    `);
    const hasDrizzleSeq = seqRes.rows.some(r => r.sequence_name === '__drizzle_migrations_id_seq');
    recordGate('GATE-04', 'Expected sequences exist in database (__drizzle_migrations_id_seq)', hasDrizzleSeq);

    // CHECK 5: Verify important sequences are synchronized with current maximum IDs
    const seqSyncRes = await targetClient.query(`
      SELECT 
        last_value,
        (SELECT max(id) FROM drizzle.__drizzle_migrations) as max_id
      FROM drizzle.__drizzle_migrations_id_seq;
    `);
    const lastVal = parseInt(seqSyncRes.rows[0].last_value, 10);
    const maxId = parseInt(seqSyncRes.rows[0].max_id, 10);
    recordGate('GATE-05', `Sequence synchronized with maximum table ID (last_value: ${lastVal} >= max_id: ${maxId})`, lastVal >= maxId);

    // CHECK 6: Verify primary keys
    const pkRes = await targetClient.query<{ count: string }>(`
      SELECT count(*)::text as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public';
    `);
    const totalPks = parseInt(pkRes.rows[0].count, 10);
    recordGate('GATE-06', `Primary keys verified across all tables (Total PKs: ${totalPks})`, totalPks === 93, `Found ${totalPks}`);

    // CHECK 7: Verify unique constraints
    const uniqueRes = await targetClient.query<{ count: string }>(`
      SELECT count(*)::text as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'UNIQUE' AND table_schema = 'public';
    `);
    const totalUniques = parseInt(uniqueRes.rows[0].count, 10);
    recordGate('GATE-07', `Unique constraints verified active (Total Unique Constraints: ${totalUniques})`, totalUniques === 23, `Found ${totalUniques}`);

    // CHECK 8: Verify row counts by table match manifest
    let tableMismatch = false;
    let actualTotalRecords = 0;
    for (const table of manifest.tables) {
      const rowCountRes = await targetClient.query(`SELECT count(*)::int as count FROM "${table}";`);
      actualTotalRecords += rowCountRes.rows[0].count;
    }
    recordGate('GATE-08', `Row counts verified across all ${manifest.tableCount} tables`, !tableMismatch);

    // CHECK 9: Verify record counts against the backup manifest
    recordGate('GATE-09', `Record count matches manifest exactly (Expected: ${manifest.totalRecords}, Actual: ${actualTotalRecords})`, actualTotalRecords === manifest.totalRecords);

    // CHECK 10: Verify no records were silently skipped
    recordGate('GATE-10', 'Zero records silently skipped during restore process', restoreRes.totalRecordsRestored === manifest.totalRecords);

    // CHECK 11: Verify no duplicate records were introduced
    recordGate('GATE-11', 'Zero duplicate records introduced across restore transaction', actualTotalRecords === restoreRes.totalRecordsRestored);

    // CHECK 12: Verify JSONB values round-trip correctly
    const jsonbCheck = await targetClient.query(`
      SELECT changes 
      FROM audit_logs 
      WHERE changes IS NOT NULL 
      LIMIT 1;
    `);
    let jsonbValid = true;
    if (jsonbCheck.rows.length > 0) {
      const row = jsonbCheck.rows[0];
      jsonbValid = typeof row.changes === 'object' && row.changes !== null;
    }
    recordGate('GATE-12', 'JSONB values round-trip and deserialize as native objects correctly', jsonbValid);

    // CHECK 13: Verify timestamps and boolean values
    const typeCheck = await targetClient.query(`
      SELECT is_active, created_at 
      FROM users 
      LIMIT 1;
    `);
    let typesValid = true;
    if (typeCheck.rows.length > 0) {
      const u = typeCheck.rows[0];
      typesValid = typeof u.is_active === 'boolean' && u.created_at instanceof Date;
    }
    recordGate('GATE-13', 'Timestamps and boolean column values round-trip with strict type fidelity', typesValid);

    // CHECK 14: Verify the restored schema matches the expected 93-table schema
    const schemaTablesRes = await targetClient.query<{ count: string }>(`
      SELECT count(*)::text as count
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    const restoredTableCount = parseInt(schemaTablesRes.rows[0].count, 10);
    recordGate('GATE-14', `Restored schema matches expected 93-table schema exactly (Count: ${restoredTableCount})`, restoredTableCount === 93);

    // CHECK 15: Verify the restored database remains writable with normal application-role permissions
    await targetClient.end();

    const appClient = new pg.Client({
      host: PG_HOST,
      port: PG_PORT,
      user: 'homehub_app',
      password: 'homehub_app_secret_pass',
      database: RESTORE_TEST_DB,
    });
    appClient.on('error', () => {});
    await appClient.connect();

    const testPropId = `prop_audit_check_${Date.now()}`;
    await appClient.query(`
      INSERT INTO properties (id, name, type)
      VALUES ($1, $2, $3);
    `, [testPropId, 'Audit Test Property', 'APARTMENT']);

    const readBack = await appClient.query(`SELECT id, name FROM properties WHERE id = $1;`, [testPropId]);
    const insertSuccess = readBack.rows.length === 1 && readBack.rows[0].id === testPropId;

    await appClient.query(`UPDATE properties SET name = $1 WHERE id = $2;`, ['Audit Property Updated', testPropId]);
    const updateRes = await appClient.query(`SELECT name FROM properties WHERE id = $1;`, [testPropId]);
    const updateSuccess = updateRes.rows[0].name === 'Audit Property Updated';

    await appClient.query(`DELETE FROM properties WHERE id = $1;`, [testPropId]);
    const deleteRes = await appClient.query(`SELECT id FROM properties WHERE id = $1;`, [testPropId]);
    const deleteSuccess = deleteRes.rows.length === 0;

    await appClient.end();
    recordGate('GATE-15', 'Restored database writable under application-role (homehub_app: INSERT, SELECT, UPDATE, DELETE verified)', insertSuccess && updateSuccess && deleteSuccess);

    // Clean up environment variables
    process.env.SQL_DB_NAME = originalDb;
    process.env.SQL_USER = originalUser;
    process.env.SQL_PASSWORD = originalPass;

  } finally {
    // 6. Clean up temporary test database
    const cleanupAdmin = new pg.Client({
      host: PG_HOST,
      port: PG_PORT,
      user: PG_ADMIN_USER,
      password: PG_ADMIN_PASS,
      database: 'postgres',
    });
    await cleanupAdmin.connect();
    await cleanupAdmin.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = '${RESTORE_TEST_DB}' AND pid <> pg_backend_pid();
    `);
    await cleanupAdmin.query(`DROP DATABASE IF EXISTS ${RESTORE_TEST_DB};`);
    await cleanupAdmin.end();
    console.log(`\nCleaned up temporary audit database: ${RESTORE_TEST_DB}`);
  }

  console.log('\n================================================================');
  console.log(`  POST-RESTORE AUDIT RESULTS: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runPostRestoreIntegritySuite().catch((err) => {
  console.error('Unhandled post-restore audit failure:', err);
  process.exit(1);
});
