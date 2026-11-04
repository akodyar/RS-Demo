import 'dotenv/config';
import { pool } from '../src/db/index.js';
import { resolveEligibleWorkspaces } from '../src/server/routes/auth.js';

async function main() {
  const user = await pool.query(`SELECT * FROM users WHERE email = 'kaywan.sabir@gmail.com'`);
  const u = user.rows[0];
  console.log('User roles:', u.roles);

  const workspaces = await resolveEligibleWorkspaces(u.id, u.roles);
  console.log('Resolved eligible workspaces for kaywan.sabir@gmail.com:');
  console.table(workspaces);

  await pool.end();
}

main().catch(console.error);

