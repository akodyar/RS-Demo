import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function verifyDb() {
  try {
    const res = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'rent_schedules' AND indexname = 'rent_schedules_lease_period_idx';
    `);
    console.log("Index check:", res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

verifyDb();
