import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new pg.Client({
    host: '127.0.0.1',
    port: 5432,
    user: process.env.SQL_USER || 'homehub_app',
    password: process.env.SQL_PASSWORD || 'homehub_app_secret_pass',
    database: process.env.SQL_DB_NAME || 'homehub_test'
  });

  await client.connect();

  try {
    const res = await client.query('SELECT current_database(), current_user, current_schema()');
    console.log('Current DB/user/schema:', res.rows[0]);

    const colRes = await client.query(`
      SELECT table_schema, column_name 
      FROM information_schema.columns 
      WHERE table_name = 'leases'
    `);
    console.log('Leases columns for homehub_app user:', colRes.rows);

    // Try selecting deposit_reconciliation_status directly with homehub_app
    const testSelect = await client.query('SELECT deposit_reconciliation_status FROM leases LIMIT 1');
    console.log('Test select result count:', testSelect.rowCount);

  } catch (err) {
    console.error('Error with homehub_app:', err);
  } finally {
    await client.end();
  }
}

main();
