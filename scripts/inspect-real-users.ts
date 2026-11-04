import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function inspectUserRecords() {
  const client = new pg.Client({
    host: process.env.SQL_HOST || '127.0.0.1',
    port: Number(process.env.SQL_PORT) || 5432,
    user: process.env.SQL_USER || 'homehub_app',
    password: process.env.SQL_PASSWORD || 'homehub_app_secret_pass',
    database: process.env.SQL_DB_NAME || 'homehub_test',
  });

  await client.connect();

  const userIds = [
    '3af3b096-d1a7-4881-969d-a01948746c11', // Kaywan Sabir
    'c31c96a9-4a05-49e8-a231-952b10bedecb', // Aniq Iraq
  ];

  for (const uid of userIds) {
    const uRes = await client.query('SELECT * FROM users WHERE id = $1', [uid]);
    console.log(`\nUser: ${uRes.rows[0]?.email} (${uid})`);

    const ownRes = await client.query('SELECT * FROM ownership_records WHERE owner_id = $1', [uid]);
    console.log(`- Ownership records: ${ownRes.rows.length}`);
    for (const own of ownRes.rows) {
      const pRes = await client.query('SELECT id, name, type, status FROM properties WHERE id = $1', [own.property_id]);
      console.log(`  * Property: ${own.property_id} - ${pRes.rows[0]?.name} (${pRes.rows[0]?.status})`);
    }

    const orgMemb = await client.query('SELECT * FROM organization_members WHERE user_id = $1', [uid]);
    console.log(`- Org memberships: ${orgMemb.rows.length}`);
    for (const m of orgMemb.rows) {
      const oRes = await client.query('SELECT id, name, type FROM organizations WHERE id = $1', [m.organization_id]);
      console.log(`  * Org: ${m.organization_id} - ${oRes.rows[0]?.name} (${m.role})`);
    }

    const agentProf = await client.query('SELECT * FROM agent_profiles WHERE user_id = $1', [uid]);
    console.log(`- Agent profiles: ${agentProf.rows.length}`);
  }

  await client.end();
}

inspectUserRecords().catch(console.error);
