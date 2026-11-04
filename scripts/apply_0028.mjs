import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function apply0028() {
  const client = new pg.Client({
    host: process.env.SQL_HOST || 'localhost',
    port: Number(process.env.SQL_PORT) || 5432,
    database: process.env.SQL_DB_NAME || 'homehub_test',
    user: 'postgres',
    password: process.env.DB_MIGRATION_PASSWORD || 'postgres',
  });

  await client.connect();
  console.log('Connected as postgres user.');

  const sql = fs.readFileSync('drizzle/0028_property_management_preference_alignment.sql', 'utf8');
  const statements = sql.split('--> statement-breakpoint');
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (trimmed) {
      console.log('Executing:', trimmed.slice(0, 60), '...');
      await client.query(trimmed);
    }
  }
  
  const col = await client.query(`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'management_preference'
  `);
  console.log('Updated column info:', col.rows[0]);
  await client.end();
}
apply0028().catch(console.error);
