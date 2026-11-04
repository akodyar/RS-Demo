import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';
async function run() {
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS rent_schedules_lease_period_idx ON rent_schedules(lease_id, period_start);`);
  console.log('Index created');
  process.exit(0);
}
run();
