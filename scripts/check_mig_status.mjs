import { pool } from '../src/db/index.js';

async function check() {
  const migs = await pool.query('SELECT * FROM "drizzle"."__drizzle_migrations" ORDER BY id');
  console.log('Applied migrations:', migs.rows.map(r => r.tag || r.hash || r.id));
  
  const col = await pool.query(`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'management_preference'
  `);
  console.log('Column info:', col.rows[0]);
  await pool.end();
}
check().catch(console.error);
