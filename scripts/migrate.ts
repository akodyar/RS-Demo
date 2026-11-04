import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Migration lock ID for PostgreSQL advisory lock (hash of 'homehub_migration_lock')
const MIGRATION_LOCK_ID = 849204829;

export async function runMigrations(options?: { dryRun?: boolean }) {
  console.log('================================================================');
  console.log('  HOMEHUB — PRODUCTION DATABASE MIGRATION ENGINE');
  console.log('================================================================');

  // 1. Verify migration journal consistency
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');

  if (!fs.existsSync(journalPath)) {
    throw new Error(`MIGRATION_JOURNAL_MISSING: Journal not found at ${journalPath}`);
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  console.log(`[JOURNAL] Version: ${journal.version}, Dialect: ${journal.dialect}, Entries: ${journal.entries.length}`);

  for (const entry of journal.entries) {
    const migrationFile = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`MIGRATION_FILE_MISSING: Referenced migration file ${entry.tag}.sql does not exist.`);
    }
  }
  console.log(`✅ All ${journal.entries.length} migration files verified in journal order.`);

  if (options?.dryRun) {
    console.log(`ℹ️ Dry run requested. Pre-flight checks passed. All ${journal.entries.length} migration files verified in journal order.`);
    return { success: true, verifiedEntries: journal.entries.length, dryRun: true };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const targetDbName = process.env.SQL_DB_NAME || (isProduction ? 'homehub_production' : 'homehub_test');
  if (!isProduction && targetDbName === 'homehub_production') {
    console.error("❌ MIGRATION FAILED: Direct migrations to 'homehub_production' are strictly prohibited in non-production environments.");
    throw new Error('PRODUCTION_MIGRATION_FORBIDDEN_IN_NON_PROD');
  }
  console.log(`[TARGET DATABASE] Connecting to database: "${targetDbName}"`);
  const hasConfig = process.env.SQL_HOST || process.env.DATABASE_URL || process.env.INSTANCE_CONNECTION_NAME;
  if (!hasConfig) {
    console.error('❌ MIGRATION FAILED: PostgreSQL configuration missing (SQL_HOST, DATABASE_URL, or INSTANCE_CONNECTION_NAME required).');
    throw new Error('DATABASE_NOT_CONFIGURED');
  }

  // 2. Connect to database
  const migUser = process.env.DB_MIGRATION_USER || (process.env.NODE_ENV === 'production' ? 'homehub_migration' : 'postgres');
  const migPassword = process.env.DB_MIGRATION_PASSWORD || 'postgres';

  let clientConfig: pg.ClientConfig;
  if (process.env.INSTANCE_CONNECTION_NAME) {
    clientConfig = {
      host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
      user: migUser,
      password: migPassword,
      database: targetDbName,
      connectionTimeoutMillis: 10000,
    };
  } else if (process.env.DATABASE_URL) {
    clientConfig = { connectionString: process.env.DATABASE_URL };
  } else {
    clientConfig = {
      host: process.env.SQL_HOST,
      port: parseInt(process.env.SQL_PORT || '5432', 10),
      user: migUser,
      password: migPassword,
      database: targetDbName,
      ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
      connectionTimeoutMillis: 10000,
    };
  }

  const client = new pg.Client(clientConfig);
  await client.connect();
  const who = await client.query('SELECT current_database(), current_user');
  console.log(`✅ Connected to: ${JSON.stringify(who.rows[0])}`);

  try {
    // 3. Acquire advisory lock to prevent concurrent deployment migration race
    console.log('[LOCK] Acquiring migration advisory lock...');
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    console.log('✅ Migration advisory lock acquired.');

    const db = drizzle(client);

    const startTime = Date.now();
    console.log('[MIGRATING] Applying versioned migrations from ./drizzle...');
    await migrate(db, { migrationsFolder });
    const duration = Date.now() - startTime;

    console.log(`✅ Migrations completed successfully in ${duration}ms.`);
    return { success: true, verifiedEntries: journal.entries.length, durationMs: duration };
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
      console.log('✅ Migration advisory lock released.');
    } catch (e: any) {
      console.warn('⚠️ Warning releasing advisory lock:', e.message);
    }
    await client.end();
    console.log('✅ Database connection closed cleanly.');
  }
}

// Allow direct execution via CLI
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  const isDryRun = process.argv.includes('--dry-run');
  runMigrations({ dryRun: isDryRun })
    .then(() => {
      console.log('🎉 Migration execution finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration runner failed:', err.message);
      process.exit(1);
    });
}
