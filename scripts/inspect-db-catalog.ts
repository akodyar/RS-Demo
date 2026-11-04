import { pool } from '../src/db/index.js';

async function main() {
  try {
    console.log('--- USERS.ROLES COLUMN ---');
    const cols = await pool.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'roles';
    `);
    console.log(JSON.stringify(cols.rows, null, 2));

    console.log('--- ORGANIZATIONS COLUMNS ---');
    const orgCols = await pool.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'organizations'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(orgCols.rows, null, 2));

    console.log('--- ORGANIZATION_MEMBERS COLUMNS ---');
    const memCols = await pool.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'organization_members'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(memCols.rows, null, 2));

    console.log('--- AGENT_PROFILES COLUMNS ---');
    const agentCols = await pool.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'agent_profiles'
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(agentCols.rows, null, 2));

    console.log('--- DISTINCT ORGANIZATION TYPES IN DB ---');
    const orgTypes = await pool.query(`
      SELECT DISTINCT type FROM organizations;
    `);
    console.log(JSON.stringify(orgTypes.rows, null, 2));

    console.log('--- DISTINCT ORGANIZATION STATUSES IN DB ---');
    const orgStatuses = await pool.query(`
      SELECT DISTINCT status FROM organizations;
    `);
    console.log(JSON.stringify(orgStatuses.rows, null, 2));

    console.log('--- DISTINCT ORGANIZATION_MEMBERS ROLES IN DB ---');
    const memRoles = await pool.query(`
      SELECT DISTINCT role FROM organization_members;
    `);
    console.log(JSON.stringify(memRoles.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error querying catalog:', err);
    process.exit(1);
  }
}

main();
