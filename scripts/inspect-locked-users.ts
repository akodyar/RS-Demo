import 'dotenv/config';
import { pool } from '../src/db/index.js';

async function main() {
  const lockedUsers = await pool.query(`
    SELECT id, email, failed_login_attempts, locked_until, NOW() as current_db_time
    FROM users
    WHERE locked_until IS NOT NULL OR failed_login_attempts > 0;
  `);
  console.log('Users with failed attempts or lock:');
  console.table(lockedUsers.rows);

  await pool.end();
}

main().catch(console.error);

