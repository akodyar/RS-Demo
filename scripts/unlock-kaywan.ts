import 'dotenv/config';
import { pool } from '../src/db/index.js';

async function main() {
  const res = await pool.query(`
    UPDATE users 
    SET failed_login_attempts = 0, locked_until = NULL 
    WHERE email = 'kaywan.sabir@gmail.com'
    RETURNING id, email, failed_login_attempts, locked_until, password_hash;
  `);

  console.log('Unlocked Kaywan user:');
  console.table(res.rows);

  await pool.end();
}

main().catch(console.error);

