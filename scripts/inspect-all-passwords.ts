import 'dotenv/config';
import { pool } from '../src/db/index.js';

async function main() {
  const counts = await pool.query(`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE password_hash IS NULL) as null_passwords,
      count(*) FILTER (WHERE password_hash IS NOT NULL) as hashed_passwords
    FROM users;
  `);
  console.log('User password stats:');
  console.table(counts.rows);

  const hashedUsers = await pool.query(`
    SELECT id, email, roles FROM users WHERE password_hash IS NOT NULL LIMIT 5;
  `);
  console.log('Sample users WITH password_hash:');
  console.table(hashedUsers.rows);

  await pool.end();
}

main().catch(console.error);

