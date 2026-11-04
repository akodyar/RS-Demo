import pg from 'pg';
const client = new pg.Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres'
});

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT 1 as result');
    console.log('SUCCESS', res.rows);
    
    // Check if db exists
    const dbRes = await client.query("SELECT 1 FROM pg_database WHERE datname = 'homehub_production'");
    if (dbRes.rowCount === 0) {
      await client.query('CREATE DATABASE homehub_production;');
      console.log('Database created.');
    } else {
      console.log('Database exists.');
    }
    
    process.exit(0);
  } catch(err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
