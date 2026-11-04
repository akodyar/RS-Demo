import { pool } from '../src/db/index.js';

async function checkOwner() {
  const res = await pool.query(`
    SELECT tablename, tableowner 
    FROM pg_tables 
    WHERE tablename = 'properties';
  `);
  console.log('Properties owner:', res.rows[0]);
  const user = await pool.query('SELECT current_user, session_user');
  console.log('Current user:', user.rows[0]);
  await pool.end();
}
checkOwner().catch(console.error);
