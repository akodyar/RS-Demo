import 'dotenv/config';
import { pool } from '../src/db/index.js';

async function main() {
  const dbRes = await pool.query('SELECT current_database()');
  console.log('Current DB:', dbRes.rows[0]);

  const counts = await pool.query(`
    SELECT p.type, count(*) as count 
    FROM properties p 
    JOIN listings l ON p.id = l.property_id 
    WHERE l.status = 'PUBLISHED' 
    GROUP BY p.type
    ORDER BY p.type;
  `);

  console.log('Current published rental listings by property type:');
  console.table(counts.rows);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

