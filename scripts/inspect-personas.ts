import 'dotenv/config';
import { pool } from '../src/db/index.js';

async function main() {
  const personas = [
    'owner@homehub.iq',
    'tenant@homehub.iq',
    'agent@homehub.iq',
    'vendor@homehub.iq',
    'admin@homehub.iq',
    'kaywan.sabir@gmail.com',
  ];

  const res = await pool.query(`
    SELECT id, email, first_name, last_name, roles, is_active, 
           CASE WHEN password_hash IS NULL THEN 'NULL' ELSE 'HASHED' END as pwd_status,
           failed_login_attempts, locked_until
    FROM users
    WHERE email = ANY($1);
  `, [personas]);

  console.log('Test personas status:');
  console.table(res.rows);

  await pool.end();
}

main().catch(console.error);

