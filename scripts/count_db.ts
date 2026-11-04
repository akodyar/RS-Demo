import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const res: any = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM listings) AS listings_count,
      (SELECT COUNT(*) FROM promotion_campaigns) AS campaigns_count,
      (SELECT COUNT(*) FROM properties) AS properties_count,
      (SELECT COUNT(*) FROM users) AS users_count
  `);
  console.log('Counts:', res.rows ? res.rows[0] : res);
  process.exit(0);
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
