const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Client } = require('pg');

async function run() {
  const c = new Client({connectionString: 'postgresql://postgres:postgres@127.0.0.1:5433/postgres'});
  await c.connect();
  await c.query(`SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'homehub' AND pid <> pg_backend_pid();`);
  await c.query('DROP DATABASE IF EXISTS homehub');
  await c.query('CREATE DATABASE homehub');
  await c.end();

  const c2 = new Client({connectionString: 'postgresql://postgres:postgres@127.0.0.1:5433/homehub'});
  await c2.connect();
  const db = drizzle(c2);
  await migrate(db, { migrationsFolder: './drizzle' });
  await c2.end();
  console.log('MIGRATED_SUCCESS');
}

run().catch(console.error);
