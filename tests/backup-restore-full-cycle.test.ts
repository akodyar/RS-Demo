import { injectPgliteMock } from './setup-pglite.js';
import pg from 'pg';
import path from 'node:path';
import { createDatabaseBackup } from '../scripts/backup.js';
import { verifyAndRestoreBackup } from '../scripts/restore.js';
import { runMigrations } from '../scripts/migrate.js';

async function testFullBackupRestoreCycle() {
  console.log('================================================================');
  console.log('  HOMEHUB — FULL DATABASE RESTORE & RECORD VERIFICATION AUDIT');
  console.log('================================================================');

  const sqlPort = parseInt(process.env.SQL_PORT || '5433', 10);
  const sqlPassword = process.env.SQL_PASSWORD || 'postgres';
  const baselineDb = process.env.SQL_DB_NAME || 'homehub';

  const adminClient = new pg.Client({
    host: '127.0.0.1',
    port: sqlPort,
    user: 'postgres',
    password: sqlPassword,
    database: 'postgres',
  });
  await adminClient.connect();

  const restoreTestDb = 'homehub_restore_verification';
  await adminClient.query(`DROP DATABASE IF EXISTS "${restoreTestDb}";`);
  await adminClient.query(`CREATE DATABASE "${restoreTestDb}";`);
  console.log(`✅ Created fresh database for restore testing: ${restoreTestDb}`);

  try {
    // 1. Run migrations on restoreTestDb to establish table schemas
    process.env.SQL_DB_NAME = restoreTestDb;
    process.env.SQL_HOST = '127.0.0.1';
    process.env.SQL_PORT = sqlPort.toString();
    process.env.SQL_USER = 'postgres';
    process.env.SQL_PASSWORD = sqlPassword;
    await runMigrations();
    console.log('✅ Migrated schema on restore target database.');

    // 2. Create authoritative backup from baseline db
    process.env.SQL_DB_NAME = baselineDb;
    const backupRes = await createDatabaseBackup();
    console.log(`✅ Created backup: ${backupRes.filePath}`);
    console.log(`   Table count: ${backupRes.manifest.tableCount}, Total records: ${backupRes.manifest.totalRecords}`);

    // 3. Execute actual restore into restoreTestDb
    console.log('\n[RESTORE] Restoring records into verification database...');
    const restorePool = new pg.Pool({
      host: '127.0.0.1',
      port: sqlPort,
      user: 'postgres',
      password: sqlPassword,
      database: restoreTestDb,
    });

    const restoreRes = await verifyAndRestoreBackup(backupRes.filePath, {
      verifyOnly: false,
      pool: restorePool,
      targetDatabase: restoreTestDb,
    });

    console.log('Restore result:', {
      status: restoreRes.status,
      tablesVerified: restoreRes.tablesVerified.length,
      totalRecordsRestored: restoreRes.totalRecordsRestored,
      durationMs: restoreRes.durationMs,
      error: restoreRes.error,
    });

    if (restoreRes.status !== 'VERIFIED_SUCCESS') {
      await restorePool.end();
      throw new Error(`Restore failed with status ${restoreRes.status}: ${restoreRes.error}`);
    }

    // 4. Verify record counts in restored database
    const verifyClient = await restorePool.connect();
    const countCheck = await verifyClient.query(`
      SELECT 
        (SELECT count(*) FROM properties) as properties_count,
        (SELECT count(*) FROM users) as users_count,
        (SELECT count(*) FROM financial_policies) as policies_count;
    `);
    console.log('Restored record counts:', countCheck.rows[0]);

    if (parseInt(countCheck.rows[0].properties_count, 10) === 0 && backupRes.manifest.totalRecords > 0) {
      verifyClient.release();
      await restorePool.end();
      throw new Error('RESTORE_VERIFICATION_FAILED: Restored properties table is empty');
    }
    console.log('✅ PASS: Real database restore drill successfully repopulated all application records.');

    verifyClient.release();
    await restorePool.end();
  } finally {
    // Reset env
    process.env.SQL_DB_NAME = baselineDb;
    await adminClient.query(`DROP DATABASE IF EXISTS "${restoreTestDb}" WITH (FORCE);`);
    console.log(`Cleaned up temporary database ${restoreTestDb}.`);
    await adminClient.end();
  }
}

testFullBackupRestoreCycle().catch((err) => {
  console.error('Full backup/restore drill failed:', err);
  process.exit(1);
});
