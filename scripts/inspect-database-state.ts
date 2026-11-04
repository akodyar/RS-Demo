import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function inspectDb() {
  const client = new pg.Client({
    host: process.env.SQL_HOST || '127.0.0.1',
    port: Number(process.env.SQL_PORT) || 5432,
    user: process.env.SQL_USER || 'homehub_app',
    password: process.env.SQL_PASSWORD || 'homehub_app_secret_pass',
    database: process.env.SQL_DB_NAME || 'homehub_test',
  });

  await client.connect();

  const infoRes = await client.query(`
    SELECT current_database() as db_name, 
           current_user as db_user, 
           inet_server_addr() as server_ip, 
           inet_server_port() as server_port,
           version() as pg_version;
  `);
  console.log('--- DATABASE CONNECTION INFO ---');
  console.table(infoRes.rows);

  const tablesRes = await client.query<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `);

  console.log(`Discovered ${tablesRes.rows.length} public tables.`);

  const tableStats: Array<{
    table: string;
    total: number;
    demo_id_count: number;
    demo_prefix_count: number;
  }> = [];

  for (const { table_name } of tablesRes.rows) {
    try {
      const countRes = await client.query(`SELECT count(*)::int as count FROM "${table_name}"`);
      const total = countRes.rows[0].count;

      // Check if table has 'id' column
      const colRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'id'
      `, [table_name]);

      let demoIdCount = 0;
      if (colRes.rows.length > 0) {
        const demoRes = await client.query(`
          SELECT count(*)::int as count 
          FROM "${table_name}" 
          WHERE "id"::text LIKE 'demo_%' 
             OR "id"::text LIKE 'seed_%'
             OR "id"::text LIKE 'sample_%'
        `);
        demoIdCount = demoRes.rows[0].count;
      }

      if (total > 0) {
        tableStats.push({
          table: table_name,
          total,
          demo_id_count: demoIdCount,
          demo_prefix_count: demoIdCount,
        });
      }
    } catch (err: any) {
      console.error(`Error querying ${table_name}:`, err.message);
    }
  }

  console.log('\n--- POPULATED TABLES STATS ---');
  console.table(tableStats);

  await client.end();
}

inspectDb().catch(console.error);
