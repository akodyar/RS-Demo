import 'dotenv/config';
import { db } from './src/db/index.ts';

async function run() {
  const res = await db.execute("SELECT COUNT(table_name) as count FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables in DB:', res.rows[0].count);
  process.exit(0);
}
run();
