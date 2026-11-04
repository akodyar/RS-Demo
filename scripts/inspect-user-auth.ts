import 'dotenv/config';
import { pool } from '../src/db/index.js';

async function main() {
  const userRes = await pool.query(`
    SELECT id, email, first_name, last_name, roles, is_active, password_hash, failed_login_attempts, locked_until
    FROM users
    WHERE email ILIKE '%kaywan%' OR email ILIKE '%sabir%';
  `);

  console.log('Matching users for kaywan / sabir:');
  console.table(userRes.rows);

  // Also check general users count and password_hash sample
  const sampleUsers = await pool.query(`
    SELECT id, email, roles, is_active, 
           CASE WHEN password_hash IS NULL THEN 'NULL' ELSE substring(password_hash from 1 for 20) || '...' END as pwd_sample
    FROM users
    LIMIT 15;
  `);
  console.log('\nSample users in database:');
  console.table(sampleUsers.rows);

  await pool.end();
}

main().catch(console.error);

