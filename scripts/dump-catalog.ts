import { pool } from '../src/db/index.js';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const catalogDir = path.resolve(process.cwd(), 'artifacts/multi-role-enrollment-final-audit/catalog');
  fs.mkdirSync(catalogDir, { recursive: true });

  const tables = ['users', 'organizations', 'organization_members', 'agent_profiles', 'vendor_profiles', 'audit_logs'];

  for (const table of tables) {
    const res = await pool.query(`
      SELECT column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `, [table]);

    fs.writeFileSync(path.join(catalogDir, `${table}-catalog.json`), JSON.stringify(res.rows, null, 2));
    console.log(`Wrote catalog for ${table}: ${res.rows.length} columns`);
  }

  // List all tables
  const allTables = await pool.query(`
    SELECT table_schema, table_name, table_type
    FROM information_schema.tables 
    WHERE table_schema IN ('public', 'drizzle')
    ORDER BY table_schema, table_name;
  `);
  fs.writeFileSync(path.join(catalogDir, 'all-tables.json'), JSON.stringify(allTables.rows, null, 2));
  console.log(`Wrote all-tables: ${allTables.rows.length} tables found`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
