import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/homehub_test' });

async function main() {
  const query = `
    SELECT tc.table_name, kcu.column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'properties';
  `;
  const res = await pool.query(query);
  console.log('FK references to properties:', res.rows);
  await pool.end();
}

main().catch(console.error);
