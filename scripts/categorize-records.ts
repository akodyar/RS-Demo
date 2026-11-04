import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function categorizeRecords() {
  const client = new pg.Client({
    host: process.env.SQL_HOST || '127.0.0.1',
    port: Number(process.env.SQL_PORT) || 5432,
    user: process.env.SQL_USER || 'homehub_app',
    password: process.env.SQL_PASSWORD || 'homehub_app_secret_pass',
    database: process.env.SQL_DB_NAME || 'homehub_test',
  });

  await client.connect();

  console.log('--- CHECKING CANONICAL SYSTEM DATA ---');
  const coa = await client.query('SELECT code, name, account_type, system_account FROM chart_of_accounts ORDER BY code ASC');
  console.log('Chart of Accounts:');
  console.table(coa.rows);

  const fp = await client.query('SELECT id, policy_type, policy_value, active FROM financial_policies');
  console.log('Financial Policies:');
  console.table(fp.rows);

  const pp = await client.query('SELECT id, type, name, points_cost, duration_days FROM promotion_packages');
  console.log('Promotion Packages:');
  console.table(pp.rows);

  const ppp = await client.query('SELECT id, name, points, price, currency FROM points_purchase_packages');
  console.log('Points Purchase Packages:');
  console.table(ppp.rows);

  const prr = await client.query('SELECT rule_key, role, points_amount FROM points_reward_rules');
  console.log('Points Reward Rules:');
  console.table(prr.rows);

  console.log('\n--- CHECKING BUSINESS DATA PATTERNS ---');
  // Check users that do NOT look like demo or test
  const nonDemoUsers = await client.query(`
    SELECT id, email, first_name, last_name, roles, created_at
    FROM users
    WHERE email NOT LIKE '%@homehub.iq'
      AND email NOT LIKE '%@homehub.test'
      AND email NOT LIKE '%@test.%'
      AND email NOT LIKE '%@t.com'
      AND email NOT LIKE '%@example.com'
      AND email NOT LIKE '%@c.com'
      AND email NOT LIKE '%@o.com'
      AND email NOT LIKE '%@a.com'
      AND email NOT LIKE '%@s.com'
      AND email NOT LIKE '%@tenant.iq'
      AND email NOT LIKE '%@mgmt.iq'
      AND email NOT LIKE '%@agency.iq'
      AND email NOT LIKE '%@audit.com'
      AND email NOT LIKE '%@sd.test'
      AND email NOT LIKE '%@nt.com'
      AND email NOT LIKE '%@oa.com'
      AND email NOT LIKE '%@ob.com';
  `);
  console.log(`Users with other domains: ${nonDemoUsers.rows.length}`);
  if (nonDemoUsers.rows.length > 0) {
    console.table(nonDemoUsers.rows);
  }

  await client.end();
}

categorizeRecords().catch(console.error);
