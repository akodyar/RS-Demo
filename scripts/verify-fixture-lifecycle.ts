import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/homehub_test' });

async function verifyFixtures() {
  console.log('--- VERIFYING POSTGRESQL TEST FIXTURES LIFECYCLE ---');

  const props = await pool.query(
    `SELECT id, name, type, status, verification_status FROM properties WHERE id LIKE 'E2E-RENTAL-SEARCH-20261030-%' ORDER BY id`
  );
  const listings = await pool.query(
    `SELECT id, property_id, type, status, price, currency FROM listings WHERE id LIKE 'E2E-RENTAL-SEARCH-20261030-%' ORDER BY id`
  );
  const ownerships = await pool.query(
    `SELECT id, property_id, owner_id, status FROM ownership_records WHERE id LIKE 'E2E-RENTAL-SEARCH-20261030-%' ORDER BY id`
  );
  const user = await pool.query(
    `SELECT id, email, roles, is_active FROM users WHERE id = 'E2E-RENTAL-SEARCH-20261030-user'`
  );

  console.log('Seeded properties count:', props.rowCount);
  console.log('Seeded listings count:', listings.rowCount);
  console.log('Seeded ownership records count:', ownerships.rowCount);
  console.log('Seeded test user exists:', user.rowCount === 1, user.rows[0]);

  const allVerified = props.rows.every((p) => p.verification_status === 'VERIFIED');
  const allPublished = listings.rows.every((l) => l.status === 'PUBLISHED' && l.type === 'FOR_RENT');
  const allOwnershipVerified = ownerships.rows.every((o) => o.status === 'VERIFIED');

  console.log('All properties verified:', allVerified);
  console.log('All listings published & FOR_RENT:', allPublished);
  console.log('All ownership records verified:', allOwnershipVerified);

  const typeMap: Record<string, number> = {};
  props.rows.forEach((p) => {
    typeMap[p.type] = (typeMap[p.type] || 0) + 1;
  });
  console.log('Breakdown by property type:');
  console.table(typeMap);

  // Check foreign key consistency
  const unlinkedListings = listings.rows.filter(
    (l) => !props.rows.some((p) => p.id === l.property_id)
  );
  const unlinkedOwnerships = ownerships.rows.filter(
    (o) => !props.rows.some((p) => p.id === o.property_id)
  );
  console.log('Unlinked listings:', unlinkedListings.length);
  console.log('Unlinked ownership records:', unlinkedOwnerships.length);

  await pool.end();
}

verifyFixtures().catch((e) => {
  console.error(e);
  pool.end();
});
