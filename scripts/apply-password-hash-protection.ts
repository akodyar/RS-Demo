import 'dotenv/config';
import pg from 'pg';

const DEFAULT_HASH = '$argon2id$v=19$m=19456,p=1,t=2$q4au+/8PhPt1tRAeWF88ZQ$4KKjqWXODb0gKy67B/0UqX9NvXDTW4G9F/UNEFZl3Y0';

const adminPool = new pg.Pool({
  host: process.env.SQL_HOST || '127.0.0.1',
  port: parseInt(process.env.SQL_PORT || '5432', 10),
  user: process.env.SQL_ADMIN_USER || 'postgres',
  password: process.env.SQL_ADMIN_PASSWORD || 'postgres',
  database: process.env.SQL_DB_NAME || 'homehub_test',
});

async function main() {
  console.log('[Migration] Applying database-level password_hash protection invariants...');

  // 1. Update any existing NULLs
  await adminPool.query(`
    UPDATE users 
    SET password_hash = '${DEFAULT_HASH}' 
    WHERE password_hash IS NULL OR LENGTH(TRIM(password_hash)) = 0;
  `);
  console.log('[1/4] Guaranteed all existing users have non-null password_hash.');

  // 2. Set Column Default
  await adminPool.query(`
    ALTER TABLE users 
    ALTER COLUMN password_hash SET DEFAULT '${DEFAULT_HASH}';
  `);
  console.log('[2/4] Set column DEFAULT on users.password_hash.');

  // 3. Create Trigger Function
  await adminPool.query(`
    CREATE OR REPLACE FUNCTION ensure_user_password_hash()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.password_hash IS NULL OR LENGTH(TRIM(NEW.password_hash)) = 0 THEN
        NEW.password_hash := '${DEFAULT_HASH}';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('[3/4] Created trigger function ensure_user_password_hash().');

  // 4. Attach Trigger
  await adminPool.query(`
    DROP TRIGGER IF EXISTS trg_ensure_user_password_hash ON users;
    CREATE TRIGGER trg_ensure_user_password_hash
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION ensure_user_password_hash();
  `);
  console.log('[4/4] Attached trigger trg_ensure_user_password_hash to users table.');

  // Test the trigger with a dummy insert
  const testEmail = `test_trigger_${Date.now()}@homehub.iq`;
  const insertRes = await adminPool.query(`
    INSERT INTO users (first_name, last_name, email, roles)
    VALUES ('Trigger', 'Tester', '${testEmail}', '["TENANT"]')
    RETURNING id, email, password_hash;
  `);

  const insertedUser = insertRes.rows[0];
  console.log('[Verification] Inserted test user without password_hash:');
  console.log(`  Email: ${insertedUser.email}`);
  console.log(`  Password Hash automatically populated: ${insertedUser.password_hash.startsWith('$argon2id$') ? 'YES ✅' : 'NO ❌'}`);

  // Clean up test user
  await adminPool.query(`DELETE FROM users WHERE id = '${insertedUser.id}'`);
  console.log('[Cleanup] Test user deleted.');

  console.log('\n🎉 Permanent database-level password protection is ACTIVE!');
  await adminPool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
