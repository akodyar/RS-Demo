import 'dotenv/config';
import { pool } from '../src/db/index.js';

async function main() {
  const user = await pool.query(`
    SELECT id, email, first_name, last_name, roles, is_active, password_hash, failed_login_attempts, locked_until, created_at, updated_at
    FROM users
    WHERE email = 'kaywan.sabir@gmail.com';
  `);
  console.log('User details:');
  console.log(user.rows[0]);

  const audit = await pool.query(`
    SELECT id, actor_user_id, action, resource_id, changes, created_at
    FROM audit_logs
    WHERE resource_id ILIKE '%kaywan%' OR actor_user_id ILIKE '%kaywan%' OR resource_id = $1
    ORDER BY created_at DESC
    LIMIT 10;
  `, [user.rows[0]?.id || 'none']);
  console.log('\nAudit logs:');
  console.table(audit.rows);

  await pool.end();
}

main().catch(console.error);

