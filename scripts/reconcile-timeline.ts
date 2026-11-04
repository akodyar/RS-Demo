import { pool } from '../src/db/index.js';

async function main() {
  console.log('=== Exact Timeline Reconciliation of Properties ===\n');

  // Exact count at migration 0028 execution timestamp (2026-10-21 13:34:36 UTC)
  const migrationTimestamp = '2026-10-21T13:34:36.000Z';

  const atMigration = await pool.query(`
    SELECT count(*) as count
    FROM properties
    WHERE created_at <= $1;
  `, [migrationTimestamp]);
  console.log(`Count at Migration 0028 execution (${migrationTimestamp}):`, atMigration.rows[0].count);

  // Rows created AFTER migration 0028 execution
  const afterMigration = await pool.query(`
    SELECT count(*) as count
    FROM properties
    WHERE created_at > $1;
  `, [migrationTimestamp]);
  console.log(`Count created AFTER Migration 0028 execution:`, afterMigration.rows[0].count);

  // Total current count
  const total = await pool.query('SELECT count(*) as count FROM properties;');
  console.log('Total current properties:', total.rows[0].count);

  // Details of rows created after migration
  const afterRows = await pool.query(`
    SELECT id, name, operating_model, management_preference, management_arrangement_status, created_at
    FROM properties
    WHERE created_at > $1
    ORDER BY created_at ASC;
  `, [migrationTimestamp]);
  console.log(`\nDetailed breakdown of the ${afterRows.rowCount} rows created AFTER migration 0028:`);
  console.table(afterRows.rows.map(r => ({
    id: r.id.substring(0, 32),
    name: r.name.substring(0, 32),
    operating_model: r.operating_model,
    management_preference: r.management_preference,
    arrangement_status: r.management_arrangement_status,
    created_at: r.created_at.toISOString()
  })));

  await pool.end();
}

main().catch(console.error);
