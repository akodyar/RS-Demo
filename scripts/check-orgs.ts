import { pool } from '../src/db/index.js';

async function main() {
  const res = await pool.query("SELECT id, name, type FROM organizations WHERE id IN ('org_company_01', 'org_company_02')");
  console.log('Organizations in DB:', res.rows);
  await pool.end();
}

main();
