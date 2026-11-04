import { pool } from '../src/db/index.js';

async function check() {
  const res = await pool.query(`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'leases' AND c.conname = 'leases_status_check';
  `);
  console.log('Constraint:', res.rows);
  await pool.end();
}

check().catch(console.error);
