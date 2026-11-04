import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function inspectPatterns() {
  const client = new pg.Client({
    host: process.env.SQL_HOST || '127.0.0.1',
    port: Number(process.env.SQL_PORT) || 5432,
    user: process.env.SQL_USER || 'homehub_app',
    password: process.env.SQL_PASSWORD || 'homehub_app_secret_pass',
    database: process.env.SQL_DB_NAME || 'homehub_test',
  });

  await client.connect();

  console.log('--- USERS EMAIL / ID SAMPLES ---');
  const userSamples = await client.query(`
    SELECT id, email, first_name, last_name, roles, created_at 
    FROM users 
    LIMIT 25;
  `);
  console.table(userSamples.rows);

  console.log('--- USERS DOMAIN BREAKDOWN ---');
  const domains = await client.query(`
    SELECT substring(email from '@(.*)$') as domain, count(*) as count 
    FROM users 
    GROUP BY domain 
    ORDER BY count DESC 
    LIMIT 20;
  `);
  console.table(domains.rows);

  console.log('--- USER ID PATTERNS ---');
  const idPatterns = await client.query(`
    SELECT 
      CASE 
        WHEN id LIKE 'user_%' THEN 'user_* (seed/demo)'
        WHEN id LIKE 'admin_%' THEN 'admin_* (seed/demo)'
        WHEN id LIKE 'demo_%' THEN 'demo_*'
        WHEN id LIKE '%test%' THEN '*test*'
        WHEN id LIKE 't-%' THEN 't-*'
        WHEN id LIKE 'usr_%' THEN 'usr_*'
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID (native register / test)'
        ELSE 'OTHER'
      END as id_group,
      count(*) as count
    FROM users
    GROUP BY id_group
    ORDER BY count DESC;
  `);
  console.table(idPatterns.rows);

  console.log('--- PROPERTIES ID PATTERNS ---');
  const propPatterns = await client.query(`
    SELECT 
      CASE 
        WHEN id LIKE 'demo_%' THEN 'demo_*'
        WHEN id LIKE 'prop_%' THEN 'prop_*'
        WHEN id LIKE '%test%' THEN '*test*'
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID'
        ELSE 'OTHER'
      END as id_group,
      count(*) as count
    FROM properties
    GROUP BY id_group
    ORDER BY count DESC;
  `);
  console.table(propPatterns.rows);

  await client.end();
}

inspectPatterns().catch(console.error);
