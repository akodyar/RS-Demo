import 'dotenv/config';
import { pool } from '../src/db/index.js';

async function main() {
  const campaigns = await pool.query(`
    SELECT pc.id, pc.campaign_type, pc.status, pc.start_time, pc.end_time, pc.listing_id, p.name as prop_name, p.type as prop_type
    FROM promotion_campaigns pc
    JOIN listings l ON pc.listing_id = l.id
    JOIN properties p ON l.property_id = p.id;
  `);
  console.log('Current promotion campaigns in DB:');
  console.table(campaigns.rows);
  await pool.end();
}

main().catch(console.error);

