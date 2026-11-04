import pg from 'pg';

async function run() {
  const adminClient = new pg.Client({
    host: '127.0.0.1', port: 5432, user: 'postgres', password: 'homehub_secure_dev_pass_change_me', database: 'homehub_production'
  });
  await adminClient.connect();

  console.log('--- DB ADMIN CHECKS ---');
  try {
    const metaRes = await adminClient.query("SELECT count(*) as count FROM __drizzle_migrations");
    console.log('1. Migration records count:', metaRes.rows[0].count);
  } catch(e) {
    console.log('1. __drizzle_migrations table not found!');
  }

  const tablesRes = await adminClient.query("SELECT tablename as table_name, tableowner FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  console.log('2. Tables found:');
  for (const row of tablesRes.rows) {
    console.log(`   - ${row.table_name} (owner: ${row.tableowner})`);
  }

  const seqRes = await adminClient.query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'");
  console.log('3. Sequences found:');
  for (const row of seqRes.rows) {
     const owner = await adminClient.query("SELECT pg_get_userbyid(relowner) as owner FROM pg_class WHERE relname = $1", [row.sequence_name]);
     console.log(`   - ${row.sequence_name} (owner: ${owner.rows[0]?.owner})`);
  }
  
  const pkRes = await adminClient.query("SELECT constraint_name, table_name, constraint_type FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')");
  console.log(`4. Found ${pkRes.rowCount} PK/FK constraints.`);
  
  let totalData = 0;
  for (const row of tablesRes.rows) {
    if (row.table_name !== '__drizzle_migrations') {
      const cnt = await adminClient.query(`SELECT count(*) as count FROM "${row.table_name}"`);
      totalData += parseInt(cnt.rows[0].count, 10);
    }
  }
  console.log('5. Total business rows found:', totalData);

  await adminClient.end();

  console.log('\n--- APP RUNTIME CHECKS ---');
  const appClient = new pg.Client({
    host: '127.0.0.1', port: 5432, user: 'homehub_app', password: 'homehub_app_secret_pass', database: 'homehub_production'
  });
  
  try {
    await appClient.connect();
    console.log('App user authenticated and connected');
    const versionRes = await appClient.query("SELECT version()");
    console.log('Version:', versionRes.rows[0].version.split(',')[0]);
    
    const dbName = await appClient.query("SELECT current_database(), current_user");
    console.log('Context:', dbName.rows[0]);

    const privRes = await appClient.query(`
      SELECT table_name, 
             has_table_privilege('homehub_app', table_name, 'SELECT') as can_select,
             has_table_privilege('homehub_app', table_name, 'INSERT') as can_insert,
             has_table_privilege('homehub_app', table_name, 'UPDATE') as can_update,
             has_table_privilege('homehub_app', table_name, 'DELETE') as can_delete
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    console.log('App table permissions on "users":');
    console.log(privRes.rows[0]);
    
    const schemaPriv = await appClient.query("SELECT has_schema_privilege('homehub_app', 'public', 'CREATE') as can_create");
    console.log('App schema CREATE privilege on public:', schemaPriv.rows[0].can_create);
    
    await appClient.end();
  } catch (e) {
    console.error('App connection failed:', e.message);
  }
}
run();
