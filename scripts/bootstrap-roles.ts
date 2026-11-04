import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

export async function bootstrapDatabaseRoles(options?: {
  sqlFilePath?: string;
  adminConfig?: pg.ClientConfig;
}) {
  console.log('================================================================');
  console.log('  HOMEHUB — DATABASE ROLE BOOTSTRAP ENGINE');
  console.log('================================================================');

  const sqlPath = options?.sqlFilePath || path.resolve(process.cwd(), 'scripts/bootstrap-db-roles.sql');
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`BOOTSTRAP_SQL_MISSING: File not found at ${sqlPath}`);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  const clientConfig: pg.ClientConfig = options?.adminConfig || {
    host: process.env.SQL_HOST || '127.0.0.1',
    port: parseInt(process.env.SQL_PORT || '5432', 10),
    user: process.env.SQL_ADMIN_USER || 'postgres',
    password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || 'postgres',
    database: (() => {
      const isProduction = process.env.NODE_ENV === 'production';
      const target = process.env.SQL_DB_NAME || (isProduction ? 'homehub_production' : 'homehub_test');
      if (!isProduction && target === 'homehub_production') {
        throw new Error("HARD SAFETY GATE TRIGGERED: Role bootstrapping on 'homehub_production' is prohibited in non-production environments.");
      }
      return target;
    })(),
    ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 10000,
  };

  const client = new pg.Client(clientConfig);
  await client.connect();
  console.log(`✅ Connected as admin (${clientConfig.user}) to database (${clientConfig.database}).`);

  try {
    console.log('[BOOTSTRAP] Executing least-privilege role bootstrap commands...');
    await client.query(sqlContent);
    console.log('✅ PostgreSQL roles (homehub_app, homehub_migration, homehub_backup) provisioned and hardened successfully.');

    // Verify existence of roles
    const rolesRes = await client.query<{ rolname: string }>(`
      SELECT rolname FROM pg_catalog.pg_roles 
      WHERE rolname IN ('homehub_app', 'homehub_migration', 'homehub_backup')
      ORDER BY rolname;
    `);

    const provisionedRoles = rolesRes.rows.map(r => r.rolname);
    console.log(`[VERIFIED] Active database roles: ${provisionedRoles.join(', ')}`);

    return { success: true, roles: provisionedRoles };
  } finally {
    await client.end();
  }
}

// CLI execution
const isDirectCli = Boolean(process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/bootstrap-roles.ts'));
if (isDirectCli) {
  bootstrapDatabaseRoles()
    .then(() => {
      console.log('✅ Database role bootstrap completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Database role bootstrap failed:', err);
      process.exit(1);
    });
}
