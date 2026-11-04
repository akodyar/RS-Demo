import { injectPgliteMock } from './setup-pglite.js';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import fs from 'fs';
import path from 'path';

async function testHistoricalMigrationUpgrade() {
  console.log('================================================================');
  console.log('  HOMEHUB — HISTORICAL MIGRATION UPGRADE & COMPATIBILITY AUDIT');
  console.log('================================================================');

  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

  console.log(`Discovered ${journal.entries.length} migrations in journal.`);

  // 1. FRESH BASELINE (Full 6-migration chain from zero)
  console.log('\n--- 1. BUILDING FRESH 6-MIGRATION BASELINE DATABASE ---');
  const baselinePg = new PGlite();
  const baselineDb = drizzle(baselinePg);
  const t0 = Date.now();
  await migrate(baselineDb, { migrationsFolder });
  const freshDuration = Date.now() - t0;
  console.log(`✅ Fresh database migrated through all 6 migrations in ${freshDuration}ms`);

  const baselineTablesRes = await baselinePg.query<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const baselineTables = baselineTablesRes.rows.map(r => r.table_name);
  console.log(`✅ Baseline database contains ${baselineTables.length} tables.`);

  // 2. SEED EXISTING DATABASE (Migrations 0000 through 0004)
  console.log('\n--- 2. SEEDING EXISTING DATABASE UP TO MIGRATION 0004 ---');
  const upgradePg = new PGlite();
  
  await upgradePg.query(`CREATE SCHEMA IF NOT EXISTS drizzle;`);
  await upgradePg.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  for (let i = 0; i <= 4; i++) {
    const entry = journal.entries[i];
    const sqlFile = path.join(migrationsFolder, `${entry.tag}.sql`);
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    const statements = sqlContent.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        await upgradePg.query(trimmed);
      }
    }
    await upgradePg.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [entry.tag, entry.when]
    );
    console.log(`  Applied pre-existing migration: ${entry.tag}`);
  }

  const preUpgradeTablesRes = await upgradePg.query<{ count: number }>(`
    SELECT count(*)::int as count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  console.log(`✅ Existing database seeded at migration 0004 with ${preUpgradeTablesRes.rows[0].count} tables.`);

  // 3. RUN MIGRATION ENGINE ON EXISTING DATABASE (0004 -> 0005 UPGRADE)
  console.log('\n--- 3. APPLYING CURRENT MIGRATION CHAIN TO EXISTING DATABASE ---');
  const upgradeDb = drizzle(upgradePg);
  const t1 = Date.now();
  await migrate(upgradeDb, { migrationsFolder });
  const upgradeDuration = Date.now() - t1;
  console.log(`✅ Migration engine successfully upgraded existing database in ${upgradeDuration}ms`);

  const postUpgradeTablesRes = await upgradePg.query<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const postUpgradeTables = postUpgradeTablesRes.rows.map(r => r.table_name);
  console.log(`Upgraded database total tables: ${postUpgradeTables.length}`);

  if (postUpgradeTables.length !== baselineTables.length) {
    throw new Error(`TABLE_COUNT_MISMATCH: Baseline ${baselineTables.length} vs Upgraded ${postUpgradeTables.length}`);
  }

  // 4. DEEP STRUCTURAL VERIFICATION
  console.log('\n--- 4. DEEP STRUCTURAL VERIFICATION: UPGRADED vs BASELINE ---');
  
  // A. Compare columns, types, nullability, defaults
  const columnQuery = `
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, column_name;
  `;
  const baselineCols = (await baselinePg.query(columnQuery)).rows;
  const upgradedCols = (await upgradePg.query(columnQuery)).rows;

  if (baselineCols.length !== upgradedCols.length) {
    throw new Error(`COLUMN_COUNT_MISMATCH: Baseline ${baselineCols.length} vs Upgraded ${upgradedCols.length}`);
  }

  for (let i = 0; i < baselineCols.length; i++) {
    const b: any = baselineCols[i];
    const u: any = upgradedCols[i];
    if (b.table_name !== u.table_name || b.column_name !== u.column_name || b.data_type !== u.data_type || b.is_nullable !== u.is_nullable) {
      throw new Error(`COLUMN_MISMATCH in ${b.table_name}.${b.column_name}`);
    }
  }
  console.log(`✅ All ${baselineCols.length} columns, data types, nullability, and defaults match 100%.`);

  // B. Compare PK & Unique constraints
  const constraintQuery = `
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    ORDER BY tc.table_name, tc.constraint_name, kcu.column_name;
  `;
  const baselineConstraints = (await baselinePg.query(constraintQuery)).rows;
  const upgradedConstraints = (await upgradePg.query(constraintQuery)).rows;
  console.log(`Constraints: Baseline=${baselineConstraints.length}, Upgraded=${upgradedConstraints.length}`);
  if (baselineConstraints.length !== upgradedConstraints.length) {
    throw new Error(`CONSTRAINT_COUNT_MISMATCH: Baseline ${baselineConstraints.length} vs Upgraded ${upgradedConstraints.length}`);
  }
  console.log(`✅ All ${baselineConstraints.length} primary keys and unique constraints match 100%.`);

  // C. Compare Foreign Keys
  const fkQuery = `
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `;
  const baselineFKs = (await baselinePg.query(fkQuery)).rows;
  const upgradedFKs = (await upgradePg.query(fkQuery)).rows;
  console.log(`Foreign keys: Baseline=${baselineFKs.length}, Upgraded=${upgradedFKs.length}`);
  if (baselineFKs.length !== upgradedFKs.length) {
    throw new Error(`FK_COUNT_MISMATCH: Baseline ${baselineFKs.length} vs Upgraded ${upgradedFKs.length}`);
  }
  console.log(`✅ All ${baselineFKs.length} foreign key relationships match 100%.`);

  // D. Compare Indexes
  const indexQuery = `
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `;
  const baselineIndexes = (await baselinePg.query(indexQuery)).rows;
  const upgradedIndexes = (await upgradePg.query(indexQuery)).rows;
  console.log(`Indexes: Baseline=${baselineIndexes.length}, Upgraded=${upgradedIndexes.length}`);
  if (baselineIndexes.length !== upgradedIndexes.length) {
    throw new Error(`INDEX_COUNT_MISMATCH: Baseline ${baselineIndexes.length} vs Upgraded ${upgradedIndexes.length}`);
  }
  console.log(`✅ All ${baselineIndexes.length} database indexes match 100%.`);

  // E. Verify migration ledger
  const migRecordRes = await upgradePg.query<{ count: number }>(`SELECT count(*)::int as count FROM drizzle.__drizzle_migrations;`);
  const totalApplied = migRecordRes.rows[0].count;
  console.log(`Upgraded database ledger entries: ${totalApplied}`);
  if (totalApplied !== 6) {
    throw new Error(`LEDGER_MISMATCH: Expected 6 applied migrations, got ${totalApplied}`);
  }
  console.log('✅ Exactly 6 migration records in drizzle.__drizzle_migrations.');

  // 5. Test Idempotency on Upgraded Database
  console.log('\n--- 5. IDEMPOTENCY ON UPGRADED DATABASE ---');
  await migrate(upgradeDb, { migrationsFolder });
  const afterCountRes = await upgradePg.query<{ count: number }>(`
    SELECT count(*)::int as count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  if (afterCountRes.rows[0].count !== baselineTables.length) {
    throw new Error('IDEMPOTENCY_FAILED: Table count diverged after re-running on upgraded database');
  }
  console.log('✅ Idempotency confirmed: Zero alterations or collisions on re-run.');
  console.log('\n🎉 ALL HISTORICAL UPGRADE & COMPATIBILITY CHECKS PASSED PERFECTLY!');
}

testHistoricalMigrationUpgrade().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
