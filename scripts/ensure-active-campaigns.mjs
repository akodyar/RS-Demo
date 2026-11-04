import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/homehub_test',
});

async function main() {
  const query = `
    SELECT l.id as listing_id, l.title, l.publisher_user_id, p.id as property_id, p.name as property_name, o.owner_id
    FROM listings l
    JOIN properties p ON l.property_id = p.id
    JOIN ownership_records o ON o.property_id = p.id AND o.status = 'VERIFIED'
    WHERE l.status = 'PUBLISHED' 
      AND l.type = 'FOR_RENT'
      AND (p.verification_status = 'VERIFIED' OR p.status = 'VERIFIED')
    ORDER BY l.created_at DESC
    LIMIT 4
  `;

  const { rows } = await pool.query(query);
  console.log(`Found ${rows.length} eligible published rental listings with verified properties & ownership:`);

  const now = new Date();
  const startTime = new Date(Date.now() - 24 * 3600 * 1000);
  const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  for (const r of rows) {
    const userId = r.publisher_user_id || r.owner_id;
    console.log(`- ${r.listing_id}: ${r.title} (User: ${userId})`);

    const existing = await pool.query(
      'SELECT id FROM promotion_campaigns WHERE listing_id = $1 LIMIT 1',
      [r.listing_id]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE promotion_campaigns 
         SET status = 'ACTIVE', 
             campaign_type = 'HOME_FEATURED', 
             placement_scope = $1::jsonb, 
             start_time = $2, 
             end_time = $3,
             updated_at = $4
         WHERE id = $5`,
        [JSON.stringify(['HOMEPAGE']), startTime, nextMonth, now, existing.rows[0].id]
      );
      console.log(`  Updated existing campaign ${existing.rows[0].id} to ACTIVE HOME_FEATURED`);
    } else {
      const newId = 'camp_' + Math.random().toString(36).substring(2, 10);
      await pool.query(
        `INSERT INTO promotion_campaigns (
           id, listing_id, property_id, requester_user_id, payer_user_id, 
           package_id, package_version, campaign_type, placement_scope, 
           points_cost, duration_days, status, start_time, end_time, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $15)`,
        [
          newId,
          r.listing_id,
          r.property_id,
          userId,
          userId,
          'PKG_HOME_FEATURED_7D',
          1,
          'HOME_FEATURED',
          JSON.stringify(['HOMEPAGE']),
          600,
          7,
          'ACTIVE',
          startTime,
          nextMonth,
          now,
        ]
      );
      console.log(`  Inserted new campaign ${newId} as ACTIVE HOME_FEATURED`);
    }
  }

  // Also query GET /api/promotions/placements/HOMEPAGE directly to verify!
  console.log('Verifying active campaigns via SQL...');
  const verify = await pool.query(`
    SELECT c.id, c.campaign_type, c.status, l.title, p.name 
    FROM promotion_campaigns c
    JOIN listings l ON c.listing_id = l.id
    JOIN properties p ON l.property_id = p.id
    WHERE c.status = 'ACTIVE' 
      AND (c.campaign_type IN ('HOME_FEATURED', 'MULTI_PAGE') OR c.placement_scope::text LIKE '%"HOMEPAGE"%')
      AND c.start_time <= NOW()
      AND c.end_time > NOW()
  `);
  console.log(`Active HOMEPAGE Campaigns: ${verify.rows.length}`);
  verify.rows.forEach(v => console.log(`  - [${v.id}] ${v.title}`));

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
