import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';
async function run() {
  const res = await db.execute(sql`SELECT lease_id, period_start, count(*) as c FROM rent_schedules GROUP BY lease_id, period_start HAVING count(*) > 1`);
  console.log('Duplicates:', res.rows);
  process.exit(0);
}
run();
