import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';
import assert from 'node:assert';

async function verifyPhase1Schema() {
  console.log('================================================================');
  console.log('  HOMEHUB — PHASE 1 SCHEMA & MIGRATION VERIFICATION');
  console.log('================================================================');

  // 1. Verify active database
  const dbCheck = await db.execute(sql`SELECT current_database() as db_name, current_user as db_user`);
  const activeDb = (dbCheck.rows[0] as any).db_name;
  console.log(`[DATABASE] Connected to: ${activeDb}`);
  assert.strictEqual(activeDb, 'homehub_test', 'Must be connected to local homehub_test');

  // 2. Verify all 8 new tables exist
  const expectedTables = [
    'points_wallets',
    'points_transactions',
    'points_reward_rules',
    'points_reward_grants',
    'points_purchase_packages',
    'points_purchase_orders',
    'promotion_packages',
    'promotion_campaigns',
  ];

  const tableQuery = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('points_wallets', 'points_transactions', 'points_reward_rules', 'points_reward_grants', 'points_purchase_packages', 'points_purchase_orders', 'promotion_packages', 'promotion_campaigns')
  `);
  const foundTables = tableQuery.rows.map((r: any) => r.table_name);
  console.log(`[TABLES] Found ${foundTables.length}/${expectedTables.length} expected tables:`);
  for (const t of expectedTables) {
    const exists = foundTables.includes(t);
    console.log(`  - ${t}: ${exists ? 'EXISTS (OK)' : 'MISSING (FAIL)'}`);
    assert.ok(exists, `Table ${t} must exist`);
  }

  // 3. Verify Check Constraints
  const checkQuery = await db.execute(sql`
    SELECT conname, relname 
    FROM pg_constraint c
    JOIN pg_class r ON c.conrelid = r.oid
    WHERE r.relname IN ('points_wallets', 'points_transactions', 'points_reward_rules', 'points_reward_grants', 'points_purchase_packages', 'points_purchase_orders', 'promotion_packages', 'promotion_campaigns')
      AND c.contype = 'c'
    ORDER BY relname, conname
  `);
  console.log(`\n[CHECK CONSTRAINTS] Found ${checkQuery.rows.length} check constraints:`);
  for (const row of checkQuery.rows as any[]) {
    console.log(`  - ${row.relname}.${row.conname}`);
  }
  const checkNames = checkQuery.rows.map((r: any) => r.conname);
  assert.ok(checkNames.includes('points_wallets_earned_balance_non_negative'));
  assert.ok(checkNames.includes('points_wallets_reserved_earned_within_balance'));
  assert.ok(checkNames.includes('points_wallets_reserved_purchased_within_balance'));
  assert.ok(checkNames.includes('campaigns_points_cost_positive'));

  // 4. Verify Foreign Keys and Deletion Rules via pg_constraint
  const fkQuery = await db.execute(sql`
    SELECT 
      c.conname,
      r1.relname AS table_name,
      r2.relname AS foreign_table_name,
      c.confdeltype
    FROM pg_constraint c
    JOIN pg_class r1 ON c.conrelid = r1.oid
    JOIN pg_class r2 ON c.confrelid = r2.oid
    WHERE c.contype = 'f'
      AND r1.relname IN ('points_wallets', 'points_transactions', 'points_reward_rules', 'points_reward_grants', 'points_purchase_packages', 'points_purchase_orders', 'promotion_packages', 'promotion_campaigns')
    ORDER BY r1.relname, c.conname
  `);
  console.log(`\n[FOREIGN KEYS] Found ${fkQuery.rows.length} foreign key constraints:`);
  for (const fk of fkQuery.rows as any[]) {
    const deleteAction = fk.confdeltype === 'r' ? 'RESTRICT' : fk.confdeltype === 'n' ? 'SET NULL' : fk.confdeltype === 'c' ? 'CASCADE' : 'NO ACTION';
    console.log(`  - ${fk.table_name}: ${fk.conname} -> ${fk.foreign_table_name} (ON DELETE ${deleteAction})`);
  }
  assert.ok(fkQuery.rows.length >= 15, 'Must have at least 15 foreign keys across points and promotions');

  // Verify wallet -> users is RESTRICT (confdeltype === 'r')
  const walletFk = fkQuery.rows.find((r: any) => r.table_name === 'points_wallets' && r.foreign_table_name === 'users') as any;
  assert.ok(walletFk, 'points_wallets must have FK to users');
  assert.strictEqual(walletFk.confdeltype, 'r', 'points_wallets FK to users must be RESTRICT');

  // Verify campaign -> properties is RESTRICT (confdeltype === 'r')
  const campaignPropFk = fkQuery.rows.find((r: any) => r.table_name === 'promotion_campaigns' && r.foreign_table_name === 'properties') as any;
  assert.ok(campaignPropFk, 'promotion_campaigns must have FK to properties');
  assert.strictEqual(campaignPropFk.confdeltype, 'r', 'promotion_campaigns FK to properties must be RESTRICT');

  // 5. Verify Indexes
  const indexQuery = await db.execute(sql`
    SELECT tablename, indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename IN ('points_wallets', 'points_transactions', 'points_reward_rules', 'points_reward_grants', 'points_purchase_packages', 'points_purchase_orders', 'promotion_packages', 'promotion_campaigns')
    ORDER BY tablename, indexname
  `);
  console.log(`\n[INDEXES] Found ${indexQuery.rows.length} indexes:`);
  for (const idx of indexQuery.rows as any[]) {
    console.log(`  - ${idx.tablename}: ${idx.indexname}`);
  }
  const indexNames = indexQuery.rows.map((r: any) => r.indexname);
  assert.ok(indexNames.includes('points_tx_user_created_idx'));
  assert.ok(indexNames.includes('campaigns_status_idx'));
  assert.ok(indexNames.includes('campaigns_active_time_idx'));

  // 6. Verify Initial Configurable Packages & Rules
  const promPkgs = await db.execute(sql`SELECT id, type, points_cost, duration_days FROM promotion_packages ORDER BY id`);
  console.log(`\n[CONFIG: PROMOTION PACKAGES] Found ${promPkgs.rows.length} packages:`);
  for (const pkg of promPkgs.rows as any[]) {
    console.log(`  - ${pkg.id} (${pkg.type}): ${pkg.points_cost} points, ${pkg.duration_days} days`);
  }
  assert.strictEqual(promPkgs.rows.length, 3, 'Must have 3 promotion packages seeded');

  const buyPkgs = await db.execute(sql`SELECT id, name, points, price, currency FROM points_purchase_packages ORDER BY id`);
  console.log(`\n[CONFIG: PURCHASE PACKAGES] Found ${buyPkgs.rows.length} purchase packages:`);
  for (const pkg of buyPkgs.rows as any[]) {
    console.log(`  - ${pkg.id}: ${pkg.points} points for ${pkg.price} ${pkg.currency}`);
  }
  assert.strictEqual(buyPkgs.rows.length, 3, 'Must have 3 purchase packages seeded');

  const rules = await db.execute(sql`SELECT rule_key, role, points_amount FROM points_reward_rules ORDER BY rule_key`);
  console.log(`\n[CONFIG: REWARD RULES] Found ${rules.rows.length} reward rules:`);
  for (const r of rules.rows as any[]) {
    console.log(`  - ${r.rule_key} (${r.role}): ${r.points_amount} points`);
  }
  assert.strictEqual(rules.rows.length, 3, 'Must have 3 reward rules seeded');

  // 7. Verify Enforcement of Check Constraints under direct SQL execution
  console.log('\n[CONSTRAINT ENFORCEMENT VERIFICATION]');
  
  // 7A: Negative earned_balance rejection
  let caughtNegative = false;
  try {
    await db.execute(sql`
      INSERT INTO points_wallets (id, user_id, earned_balance, purchased_balance, reserved_earned_balance, reserved_purchased_balance)
      VALUES (gen_random_uuid(), 'test_fake_user_1', -50, 0, 0, 0)
    `);
  } catch (err: any) {
    const fullErr = `${err.message || ''} ${err.cause?.message || ''} ${err.cause?.code || ''} ${err.code || ''}`;
    if (fullErr.includes('points_wallets_earned_balance_non_negative') || fullErr.includes('23514')) {
      caughtNegative = true;
      console.log('  ✔ Negative balance correctly rejected by PostgreSQL CHECK constraint (23514)');
    } else {
      throw err;
    }
  }
  assert.ok(caughtNegative, 'Database must enforce non-negative check constraint');

  // 7B: Reserved exceeding balance rejection
  let caughtOverReserve = false;
  try {
    await db.execute(sql`
      INSERT INTO points_wallets (id, user_id, earned_balance, purchased_balance, reserved_earned_balance, reserved_purchased_balance)
      VALUES (gen_random_uuid(), 'test_fake_user_2', 100, 0, 150, 0)
    `);
  } catch (err: any) {
    const fullErr = `${err.message || ''} ${err.cause?.message || ''} ${err.cause?.code || ''} ${err.code || ''}`;
    if (fullErr.includes('points_wallets_reserved_earned_within_balance') || fullErr.includes('23514')) {
      caughtOverReserve = true;
      console.log('  ✔ Over-reservation (150 > 100) correctly rejected by PostgreSQL CHECK constraint (23514)');
    } else {
      throw err;
    }
  }
  assert.ok(caughtOverReserve, 'Database must enforce reserved <= balance check constraint');

  console.log('\n================================================================');
  console.log('  ALL PHASE 1 SCHEMA & MIGRATION VERIFICATIONS PASSED (100%)');
  console.log('================================================================');
  process.exit(0);
}

verifyPhase1Schema().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
