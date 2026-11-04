import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function fullAudit() {
  const client = new pg.Client({
    host: process.env.SQL_HOST || '127.0.0.1',
    port: Number(process.env.SQL_PORT) || 5432,
    user: process.env.SQL_USER || 'homehub_app',
    password: process.env.SQL_PASSWORD || 'homehub_app_secret_pass',
    database: process.env.SQL_DB_NAME || 'homehub_test',
  });

  await client.connect();

  const realUserIds = [
    '3af3b096-d1a7-4881-969d-a01948746c11', // Kaywan Sabir
    'c31c96a9-4a05-49e8-a231-952b10bedecb', // Aniq Iraq
  ];

  const tablesRes = await client.query<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `);

  console.log(`Auditing ${tablesRes.rows.length} tables in ${process.env.SQL_DB_NAME}...`);

  const report: any[] = [];

  for (const { table_name } of tablesRes.rows) {
    const countRes = await client.query(`SELECT count(*)::int as count FROM "${table_name}"`);
    const total = countRes.rows[0].count;

    if (total === 0) continue;

    // Check FKs referencing this table or referenced by this table
    const fkRes = await client.query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1;
    `, [table_name]);

    report.push({
      table: table_name,
      total,
      fk_count: fkRes.rows.length,
      fks: fkRes.rows.map(r => `${r.column_name}->${r.foreign_table_name}`).join(', '),
    });
  }

  console.table(report);

  await client.end();
}

fullAudit().catch(console.error);
