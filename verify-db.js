import pg from 'pg';

async function run() {
  const adminClient = new pg.Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'homehub_secure_dev_pass_change_me',
    database: 'homehub_production'
  });
  
  await adminClient.connect();
  
  const dbRes = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = 'homehub_production'");
  console.log('1. DB exists:', dbRes.rowCount > 0);
  
  const roleRes = await adminClient.query("SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = 'homehub_app'");
  console.log('2. Role exists:', roleRes.rowCount > 0);
  console.log('3. Is superuser:', roleRes.rows[0].rolsuper);
  console.log('4. Can create DB:', roleRes.rows[0].rolcreatedb);
  console.log('5. Can create role:', roleRes.rows[0].rolcreaterole);
  
  const schemaRes = await adminClient.query("SELECT has_schema_privilege('homehub_app', 'public', 'CREATE')");
  console.log('6. Has CREATE on public:', schemaRes.rows[0].has_schema_privilege);
  
  const versionRes = await adminClient.query("SELECT version()");
  console.log('9. Version:', versionRes.rows[0].version);
  
  const tableRes = await adminClient.query("SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('10/11. Public tables count:', tableRes.rows[0].count);
  
  await adminClient.end();
  
  const appClient = new pg.Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'homehub_app',
    password: 'homehub_app_secret_pass',
    database: 'homehub_production'
  });
  
  try {
    await appClient.connect();
    console.log('7/8. App user authenticated and connected: true');
    const selectRes = await appClient.query("SELECT 1 as val");
    console.log('App user SELECT 1:', selectRes.rows[0].val);
    await appClient.end();
  } catch (e) {
    console.log('7/8. App user auth failed:', e.message);
  }
}
run();
