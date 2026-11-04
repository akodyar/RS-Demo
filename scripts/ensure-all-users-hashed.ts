import 'dotenv/config';
import { pool } from '../src/db/index.js';
import { hashPassword } from '../src/server/utils/auth.js';

export async function ensureAllUsersHashed(): Promise<{ totalUsers: number; unhashedUpdated: number; unlockedCount: number }> {
  // Count total and null passwords
  const countRes = await pool.query(`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE password_hash IS NULL) as null_passwords,
      count(*) FILTER (WHERE locked_until IS NOT NULL OR failed_login_attempts > 0) as locked_or_failed
    FROM users;
  `);

  const total = parseInt(countRes.rows[0].total, 10);
  const nullPasswords = parseInt(countRes.rows[0].null_passwords, 10);
  const lockedOrFailed = parseInt(countRes.rows[0].locked_or_failed, 10);

  console.log(`[Audit] Total users: ${total}, Unhashed users: ${nullPasswords}, Locked/Failed attempts: ${lockedOrFailed}`);

  let updatedUnhashed = 0;
  if (nullPasswords > 0) {
    const defaultHash = await hashPassword('password123');
    const updateRes = await pool.query(
      `UPDATE users 
       SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL 
       WHERE password_hash IS NULL`,
      [defaultHash]
    );
    updatedUnhashed = updateRes.rowCount || 0;
    console.log(`[Remediation] Updated ${updatedUnhashed} unhashed users with standard Argon2id hash ('password123').`);
  }

  // Also unlock any legacy users that were locked out due to previous failed attempts
  let unlocked = 0;
  if (lockedOrFailed > 0) {
    const unlockRes = await pool.query(
      `UPDATE users 
       SET failed_login_attempts = 0, locked_until = NULL 
       WHERE locked_until IS NOT NULL OR failed_login_attempts > 0`
    );
    unlocked = unlockRes.rowCount || 0;
    console.log(`[Remediation] Cleared lockouts and reset failed login attempts for ${unlocked} users.`);
  }

  return {
    totalUsers: total,
    unhashedUpdated: updatedUnhashed,
    unlockedCount: unlocked,
  };
}

if (process.argv[1]?.endsWith('ensure-all-users-hashed.ts')) {
  ensureAllUsersHashed()
    .then((stats) => {
      console.log('✅ Password hash audit & remediation completed successfully:', stats);
      return pool.end();
    })
    .catch((err) => {
      console.error('❌ Failed password hash remediation:', err);
      process.exit(1);
    });
}

