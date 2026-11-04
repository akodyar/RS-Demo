import { pool } from '../src/db/index.js';

async function main() {
  console.log('=== Inspecting Recent Properties & Test Row Genesis ===\n');

  const total = await pool.query('SELECT count(*) FROM properties');
  console.log('Total properties in table:', total.rows[0].count);

  // Inspect properties created on 2026-10-21 (today's test run date)
  const todayProps = await pool.query(`
    SELECT id, name, operating_model, management_preference, management_arrangement_status, created_at
    FROM properties
    WHERE created_at >= '2026-10-21 00:00:00+00'
    ORDER BY created_at ASC;
  `);

  console.log(`\nProperties created on 2026-10-21 (${todayProps.rowCount} rows):`);
  console.table(todayProps.rows.map(r => ({
    id: r.id.substring(0, 36),
    name: r.name.substring(0, 32),
    operating_model: r.operating_model,
    management_preference: r.management_preference,
    management_arrangement_status: r.management_arrangement_status,
    created_at: r.created_at.toISOString()
  })));

  // Group by name patterns to attribute to test suites
  const attribution = await pool.query(`
    SELECT 
      CASE 
        WHEN id LIKE 'pv_test_%' OR name LIKE 'Gulan Tower Apartment 402%' OR name LIKE 'ALPM Preserved Model Property%' THEN 'SUITE-01: property-verification-and-owner-management-choice.test.ts'
        WHEN name LIKE 'Generic Route Apartment%' OR name LIKE 'Owner Route Villa%' OR name LIKE 'Rental Listing Prop%' OR name LIKE 'Private Portfolio Prop%' OR name LIKE 'Padded Name Property%' THEN 'SUITE-02: property-creation-validation.test.ts'
        WHEN id LIKE 'idemp_test_%' OR name LIKE 'Idempotent Tower%' THEN 'SUITE-03: property-creation-idempotency.test.ts'
        ELSE 'OTHER_OR_PRE_EXISTING'
      END as attribution_source,
      count(*) as count
    FROM properties
    WHERE created_at >= '2026-10-21 00:00:00+00'
    GROUP BY attribution_source
    ORDER BY count DESC;
  `);

  console.log('\nAttribution of 2026-10-21 test records:');
  console.table(attribution.rows);

  // Check the cutoff: What was the latest property created BEFORE 2026-10-21?
  const preMigrationProps = await pool.query(`
    SELECT count(*) as count, MAX(created_at) as latest_pre_test_date
    FROM properties
    WHERE created_at < '2026-10-21 00:00:00+00';
  `);
  console.log('\nPre-test properties count (created before 2026-10-21):', preMigrationProps.rows[0]);

  await pool.end();
}

main().catch(console.error);
