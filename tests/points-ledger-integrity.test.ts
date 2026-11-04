import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import {
  users,
  pointsWallets,
  pointsTransactions,
  pointsRewardRules,
  pointsRewardGrants,
  pointsPurchasePackages,
  pointsPurchaseOrders,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { pointsEngine } from '../src/server/services/points-engine.js';
import { assertSafeDatabaseConfig } from './safe-test-env.js';

process.env.SQL_HOST = process.env.SQL_HOST || 'localhost';
process.env.SQL_DB_NAME = process.env.SQL_DB_NAME || 'homehub_test';
assertSafeDatabaseConfig();

test('Points Ledger Engine & Financial Integrity Test Suite (homehub_test)', async (t) => {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);

  // Setup synthetic test users
  const [ownerUser] = await db
    .insert(users)
    .values({
      firstName: 'Owner',
      lastName: 'PointsTest',
      email: `owner_${timestamp}_${rand}@homehub.test`,
      roles: ['PROPERTY_OWNER'],
    })
    .returning();

  const [tenantUser] = await db
    .insert(users)
    .values({
      firstName: 'Tenant',
      lastName: 'PointsTest',
      email: `tenant_${timestamp}_${rand}@homehub.test`,
      roles: ['TENANT'],
    })
    .returning();

  const [agentUser] = await db
    .insert(users)
    .values({
      firstName: 'Agent',
      lastName: 'PointsTest',
      email: `agent_${timestamp}_${rand}@homehub.test`,
      roles: ['AGENT'],
    })
    .returning();

  const [adminUser] = await db
    .insert(users)
    .values({
      firstName: 'Admin',
      lastName: 'PointsTest',
      email: `admin_${timestamp}_${rand}@homehub.test`,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    })
    .returning();

  // Helper to test PostgreSQL check constraint rejections
  const isCheckConstraintViolation = (err: any) => {
    return (
      err?.code === '23514' ||
      err?.cause?.code === '23514' ||
      (typeof err?.message === 'string' && (err.message.includes('23514') || err.message.includes('check constraint')))
    );
  };

  // =========================================================================
  // Test 1: Earned and purchased balances remain separate
  // =========================================================================
  await t.test('1. Earned and purchased balances remain separate', async () => {
    const userWallet = await pointsEngine.getOrCreateWallet(ownerUser.id);
    assert.strictEqual(userWallet.earnedBalance, 0);
    assert.strictEqual(userWallet.purchasedBalance, 0);
    assert.strictEqual(userWallet.totalBalance, 0);

    // Grant earned reward points (OWNER_FIRST_LISTING rule is 200 points in DB)
    const rewardResult = await pointsEngine.grantRewardPoints({
      userId: ownerUser.id,
      userRoles: ['PROPERTY_OWNER'],
      ruleKey: 'OWNER_FIRST_LISTING',
      referenceEventId: `evt_init_${timestamp}_1`,
    });

    assert.strictEqual(rewardResult.wallet.earnedBalance, 200);
    assert.strictEqual(rewardResult.wallet.purchasedBalance, 0);
    assert.strictEqual(rewardResult.wallet.totalBalance, 200);

    // Purchase 500 points (PKG_POINTS_500 is 500 points in DB)
    const { order } = await pointsEngine.createPurchaseOrder({
      userId: ownerUser.id,
      userRoles: ['PROPERTY_OWNER'],
      packageId: 'PKG_POINTS_500',
    });

    const confirmResult = await pointsEngine.confirmPurchaseOrder({
      orderId: order.id,
      adminUserId: adminUser.id,
      adminRoles: ['SUPER_ADMIN'],
    });

    assert.strictEqual(confirmResult.wallet.earnedBalance, 200);
    assert.strictEqual(confirmResult.wallet.purchasedBalance, 500);
    assert.strictEqual(confirmResult.wallet.availableEarned, 200);
    assert.strictEqual(confirmResult.wallet.availablePurchased, 500);
    assert.strictEqual(confirmResult.wallet.availableTotal, 700);
    assert.strictEqual(confirmResult.wallet.totalBalance, 700);

    // Confirm that the database row stores separate columns
    const [rawWallet] = await db
      .select()
      .from(pointsWallets)
      .where(eq(pointsWallets.userId, ownerUser.id));
    assert.strictEqual(rawWallet.earnedBalance, 200);
    assert.strictEqual(rawWallet.purchasedBalance, 500);
  });

  // =========================================================================
  // Test 2: Duplicate reward events do not grant points twice
  // =========================================================================
  await t.test('2. Duplicate reward events do not grant points twice', async () => {
    const refEventId = `evt_dedup_${timestamp}_2`;

    // First grant for agent (AGENT_VERIFIED_PROFILE is 150 points)
    const firstGrant = await pointsEngine.grantRewardPoints({
      userId: agentUser.id,
      userRoles: ['AGENT'],
      ruleKey: 'AGENT_VERIFIED_PROFILE',
      referenceEventId: refEventId,
    });
    assert.strictEqual(firstGrant.idempotentReplay, false);
    assert.strictEqual(firstGrant.wallet.earnedBalance, 150);

    // Replay with identical event ID
    const duplicateGrant = await pointsEngine.grantRewardPoints({
      userId: agentUser.id,
      userRoles: ['AGENT'],
      ruleKey: 'AGENT_VERIFIED_PROFILE',
      referenceEventId: refEventId,
    });
    assert.strictEqual(duplicateGrant.idempotentReplay, true);
    assert.strictEqual(duplicateGrant.wallet.earnedBalance, 150); // Still 150, not 300!
    assert.strictEqual(duplicateGrant.transaction.id, firstGrant.transaction.id);

    // Attempting a second grant with a new event ID must be rejected by maxGrantsPerUser (1)
    await assert.rejects(
      pointsEngine.grantRewardPoints({
        userId: agentUser.id,
        userRoles: ['AGENT'],
        ruleKey: 'AGENT_VERIFIED_PROFILE',
        referenceEventId: `evt_different_${timestamp}`,
      }),
      /MAX_GRANTS_EXCEEDED/
    );
  });

  // =========================================================================
  // Test 3: Duplicate purchase confirmation does not credit points twice
  // =========================================================================
  await t.test('3. Duplicate purchase confirmation does not credit points twice', async () => {
    const { order } = await pointsEngine.createPurchaseOrder({
      userId: agentUser.id,
      userRoles: ['AGENT'],
      packageId: 'PKG_POINTS_1000',
    });

    const firstConfirm = await pointsEngine.confirmPurchaseOrder({
      orderId: order.id,
      adminUserId: adminUser.id,
      adminRoles: ['ADMIN'],
    });
    assert.strictEqual(firstConfirm.idempotentReplay, false);
    assert.strictEqual(firstConfirm.wallet.purchasedBalance, 1000);

    // Repeated confirmation
    const secondConfirm = await pointsEngine.confirmPurchaseOrder({
      orderId: order.id,
      adminUserId: adminUser.id,
      adminRoles: ['ADMIN'],
    });
    assert.strictEqual(secondConfirm.idempotentReplay, true);
    assert.strictEqual(secondConfirm.wallet.purchasedBalance, 1000); // Remained 1000, not 2000!
    assert.strictEqual(secondConfirm.transaction.id, firstConfirm.transaction.id);
  });

  // =========================================================================
  // Test 4: Unauthorized roles cannot purchase points or alter another user's wallet
  // =========================================================================
  await t.test("4. Unauthorized roles cannot purchase points or alter another user's wallet", async () => {
    // 1. Tenant role attempting to purchase points
    await assert.rejects(
      pointsEngine.createPurchaseOrder({
        userId: tenantUser.id,
        userRoles: ['TENANT'],
        packageId: 'PKG_POINTS_500',
      }),
      /UNAUTHORIZED_ROLE: Only property owners and verified agents are authorized to purchase points/
    );

    // 2. Non-admin attempting to confirm purchase order
    const { order } = await pointsEngine.createPurchaseOrder({
      userId: ownerUser.id,
      userRoles: ['PROPERTY_OWNER'],
      packageId: 'PKG_POINTS_500',
    });

    await assert.rejects(
      pointsEngine.confirmPurchaseOrder({
        orderId: order.id,
        adminUserId: tenantUser.id,
        adminRoles: ['TENANT'],
      }),
      /UNAUTHORIZED_ROLE: Administrative authorization required to confirm points purchase/
    );

    // 3. Non-admin attempting admin adjust
    await assert.rejects(
      pointsEngine.adminAdjustPoints({
        targetUserId: ownerUser.id,
        adminUserId: tenantUser.id,
        adminRoles: ['TENANT'],
        amount: 50,
        direction: 'CREDIT',
        source: 'EARNED',
        reason: 'Unauthorized attempt to grant points',
      }),
      /UNAUTHORIZED_ROLE: Administrative points adjustment requires an administrator role/
    );
  });

  // =========================================================================
  // Test 5: Reservation rejects insufficient available balance
  // =========================================================================
  await t.test('5. Reservation rejects insufficient available balance', async () => {
    // tenant currently has 0 points
    const tenantWallet = await pointsEngine.getOrCreateWallet(tenantUser.id);
    assert.strictEqual(tenantWallet.availableTotal, 0);

    await assert.rejects(
      pointsEngine.reservePoints({
        userId: tenantUser.id,
        amount: 100,
        referenceId: `ref_promo_fail_${timestamp}`,
      }),
      /INSUFFICIENT_AVAILABLE_POINTS/
    );

    // Check that wallet was untouched
    const after = await pointsEngine.getOrCreateWallet(tenantUser.id);
    assert.strictEqual(after.reservedTotal, 0);
    assert.strictEqual(after.availableTotal, 0);
  });

  // =========================================================================
  // Test 6: Release restores the exact earned/purchased source split
  // =========================================================================
  await t.test('6. Release restores the exact earned/purchased source split', async () => {
    // Create dedicated user with known split: 200 earned, 100 purchased (total 300)
    const [splitUser] = await db
      .insert(users)
      .values({
        firstName: 'Split',
        lastName: 'User',
        email: `split_${timestamp}_${rand}@homehub.test`,
        roles: ['PROPERTY_OWNER'],
      })
      .returning();

    // 200 earned via rule
    await pointsEngine.grantRewardPoints({
      userId: splitUser.id,
      userRoles: ['PROPERTY_OWNER'],
      ruleKey: 'OWNER_FIRST_LISTING',
      referenceEventId: `evt_split_${timestamp}`,
    });

    // 100 purchased via admin adjustment
    await pointsEngine.adminAdjustPoints({
      targetUserId: splitUser.id,
      adminUserId: adminUser.id,
      adminRoles: ['SUPER_ADMIN'],
      amount: 100,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Setup initial purchased balance for split testing',
    });

    const beforeReserve = await pointsEngine.getOrCreateWallet(splitUser.id);
    assert.strictEqual(beforeReserve.earnedBalance, 200);
    assert.strictEqual(beforeReserve.purchasedBalance, 100);
    assert.strictEqual(beforeReserve.availableTotal, 300);

    // Reserve 250 points (earned-first allocation: 200 earned + 50 purchased)
    const reserveRef = `ref_split_res_${timestamp}`;
    const reserveResult = await pointsEngine.reservePoints({
      userId: splitUser.id,
      amount: 250,
      referenceId: reserveRef,
    });

    assert.strictEqual(reserveResult.transaction.reservedEarnedDelta, 200);
    assert.strictEqual(reserveResult.transaction.reservedPurchasedDelta, 50);
    assert.strictEqual(reserveResult.wallet.reservedEarnedBalance, 200);
    assert.strictEqual(reserveResult.wallet.reservedPurchasedBalance, 50);
    assert.strictEqual(reserveResult.wallet.availableEarned, 0);
    assert.strictEqual(reserveResult.wallet.availablePurchased, 50);
    assert.strictEqual(reserveResult.wallet.availableTotal, 50);
    assert.strictEqual(reserveResult.wallet.totalBalance, 300); // Total untouched during reservation

    // Release reservation
    const releaseResult = await pointsEngine.releasePoints({
      userId: splitUser.id,
      referenceId: reserveRef,
    });

    assert.strictEqual(releaseResult.transaction.reservedEarnedDelta, -200);
    assert.strictEqual(releaseResult.transaction.reservedPurchasedDelta, -50);
    assert.strictEqual(releaseResult.wallet.reservedEarnedBalance, 0);
    assert.strictEqual(releaseResult.wallet.reservedPurchasedBalance, 0);
    assert.strictEqual(releaseResult.wallet.availableEarned, 200); // Exact 200 earned restored
    assert.strictEqual(releaseResult.wallet.availablePurchased, 100); // Exact 100 purchased restored
    assert.strictEqual(releaseResult.wallet.availableTotal, 300);
    assert.strictEqual(releaseResult.wallet.totalBalance, 300);
  });

  // =========================================================================
  // Test 7: Spend atomically reduces the reserved and original source balances
  // =========================================================================
  await t.test('7. Spend atomically reduces the reserved and original source balances', async () => {
    const [spendUser] = await db
      .insert(users)
      .values({
        firstName: 'Spend',
        lastName: 'User',
        email: `spend_${timestamp}_${rand}@homehub.test`,
        roles: ['PROPERTY_OWNER'],
      })
      .returning();

    // 200 earned, 100 purchased (total 300)
    await pointsEngine.grantRewardPoints({
      userId: spendUser.id,
      userRoles: ['PROPERTY_OWNER'],
      ruleKey: 'OWNER_FIRST_LISTING',
      referenceEventId: `evt_spend_${timestamp}`,
    });
    await pointsEngine.adminAdjustPoints({
      targetUserId: spendUser.id,
      adminUserId: adminUser.id,
      adminRoles: ['SUPER_ADMIN'],
      amount: 100,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Setup initial purchased balance for spend testing',
    });

    const spendRef = `ref_spend_campaign_${timestamp}`;
    await pointsEngine.reservePoints({
      userId: spendUser.id,
      amount: 250,
      referenceId: spendRef,
    });

    // Now spend the 250 reserved points (200 earned, 50 purchased)
    const spendResult = await pointsEngine.spendReservedPoints({
      userId: spendUser.id,
      referenceId: spendRef,
    });

    assert.strictEqual(spendResult.transaction.type, 'SPENT');
    assert.strictEqual(spendResult.transaction.earnedDelta, -200);
    assert.strictEqual(spendResult.transaction.purchasedDelta, -50);
    assert.strictEqual(spendResult.transaction.reservedEarnedDelta, -200);
    assert.strictEqual(spendResult.transaction.reservedPurchasedDelta, -50);

    // Check balances
    assert.strictEqual(spendResult.wallet.earnedBalance, 0); // 200 - 200
    assert.strictEqual(spendResult.wallet.purchasedBalance, 50); // 100 - 50
    assert.strictEqual(spendResult.wallet.reservedEarnedBalance, 0);
    assert.strictEqual(spendResult.wallet.reservedPurchasedBalance, 0);
    assert.strictEqual(spendResult.wallet.availableTotal, 50);
    assert.strictEqual(spendResult.wallet.totalBalance, 50); // Dropped from 300 to 50

    // Settled reservation cannot be released or spent again
    await assert.rejects(
      pointsEngine.releasePoints({
        userId: spendUser.id,
        referenceId: spendRef,
      }),
      /RESERVATION_ALREADY_SETTLED/
    );
  });

  // =========================================================================
  // Test 8: Concurrent reservation attempts cannot overspend a wallet
  // =========================================================================
  await t.test('8. Concurrent reservation attempts cannot overspend a wallet', async () => {
    const [concurrentUser] = await db
      .insert(users)
      .values({
        firstName: 'Concurrent',
        lastName: 'User',
        email: `concurrent_${timestamp}_${rand}@homehub.test`,
        roles: ['PROPERTY_OWNER'],
      })
      .returning();

    // Give 200 earned points
    await pointsEngine.grantRewardPoints({
      userId: concurrentUser.id,
      userRoles: ['PROPERTY_OWNER'],
      ruleKey: 'OWNER_FIRST_LISTING',
      referenceEventId: `evt_conc_${timestamp}`,
    });

    // Launch two parallel reservation requests of 120 points each (sum = 240 > 200 available)
    const [res1, res2] = await Promise.allSettled([
      pointsEngine.reservePoints({
        userId: concurrentUser.id,
        amount: 120,
        referenceId: `ref_conc_a_${timestamp}`,
      }),
      pointsEngine.reservePoints({
        userId: concurrentUser.id,
        amount: 120,
        referenceId: `ref_conc_b_${timestamp}`,
      }),
    ]);

    // Due to exclusive row-level locking (FOR UPDATE), exactly one succeeds, and one is rejected
    const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejected = [res1, res2].filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent reservation must succeed');
    assert.strictEqual(rejected.length, 1, 'Exactly one concurrent reservation must be rejected');

    const walletAfter = await pointsEngine.getOrCreateWallet(concurrentUser.id);
    assert.strictEqual(walletAfter.reservedEarnedBalance, 120);
    assert.strictEqual(walletAfter.availableTotal, 80);
    assert.strictEqual(walletAfter.totalBalance, 200);
  });

  // =========================================================================
  // Test 9: Failed ledger writes roll back the associated balance changes
  // =========================================================================
  await t.test('9. Failed ledger writes roll back the associated balance changes', async () => {
    const [rollbackUser] = await db
      .insert(users)
      .values({
        firstName: 'Rollback',
        lastName: 'User',
        email: `rollback_${timestamp}_${rand}@homehub.test`,
        roles: ['PROPERTY_OWNER'],
      })
      .returning();

    const initialWallet = await pointsEngine.getOrCreateWallet(rollbackUser.id);
    assert.strictEqual(initialWallet.earnedBalance, 0);

    // Simulate an aborted transaction where wallet balance update fails before commit
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx
          .update(pointsWallets)
          .set({ earnedBalance: 999 })
          .where(eq(pointsWallets.userId, rollbackUser.id));

        // Intentionally throw inside transaction
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      }),
      /SIMULATED_TRANSACTION_FAILURE/
    );

    // Verify wallet was completely rolled back in PostgreSQL
    const freshWallet = await pointsEngine.getOrCreateWallet(rollbackUser.id);
    assert.strictEqual(freshWallet.earnedBalance, 0);
  });

  // =========================================================================
  // Test 10: Negative balances and over-reservation are rejected by PostgreSQL constraints
  // =========================================================================
  await t.test('10. Negative balances and over-reservation are rejected by PostgreSQL constraints', async () => {
    const [constraintUser] = await db
      .insert(users)
      .values({
        firstName: 'Constraint',
        lastName: 'User',
        email: `constraint_${timestamp}_${rand}@homehub.test`,
        roles: ['PROPERTY_OWNER'],
      })
      .returning();

    const wallet = await pointsEngine.getOrCreateWallet(constraintUser.id);

    // Direct SQL attempt to set negative earned balance
    await assert.rejects(
      db.execute(sql`UPDATE points_wallets SET earned_balance = -50 WHERE id = ${wallet.id}`),
      isCheckConstraintViolation,
      'Expected check constraint violation on negative earned_balance'
    );

    // Direct SQL attempt to set over-reservation (reserved_earned > earned_balance)
    await assert.rejects(
      db.execute(sql`UPDATE points_wallets SET reserved_earned_balance = 500 WHERE id = ${wallet.id}`),
      isCheckConstraintViolation,
      'Expected check constraint violation on reserved_earned_within_balance'
    );

    // Direct SQL attempt to record non-positive transaction amount
    await assert.rejects(
      db.execute(sql`
        INSERT INTO points_transactions (
          wallet_id, user_id, type, source_type, amount, earned_delta,
          purchased_delta, reserved_earned_delta, reserved_purchased_delta,
          available_balance_after, total_balance_after, reference_type, reference_id
        ) VALUES (
          ${wallet.id}, ${constraintUser.id}, 'EARNED_REWARD', 'EARNED', 0, 0,
          0, 0, 0, 0, 0, 'REWARD_EVENT', 'evt_invalid'
        )
      `),
      isCheckConstraintViolation,
      'Expected check constraint violation on points_tx_amount_positive'
    );
  });

  // =========================================================================
  // Test 11: Points do not expire
  // =========================================================================
  await t.test('11. Points do not expire', async () => {
    // Check points_wallets columns
    const walletCols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'points_wallets' AND column_name IN ('expires_at', 'expiration_date', 'valid_until')
    `);
    assert.strictEqual(walletCols.rows.length, 0, 'points_wallets must not contain expiration columns');

    // Check points_transactions columns
    const txCols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'points_transactions' AND column_name IN ('expires_at', 'expiration_date', 'valid_until')
    `);
    assert.strictEqual(txCols.rows.length, 0, 'points_transactions must not contain expiration columns');

    // Confirm that point balances persist and no scheduled expiration decay exists
    const [w] = await db
      .select()
      .from(pointsWallets)
      .where(eq(pointsWallets.userId, ownerUser.id));
    assert.ok(w.earnedBalance > 0);
  });

  // =========================================================================
  // Test 12: Administrative adjustments enforce authorization, reason, and audit requirements
  // =========================================================================
  await t.test('12. Administrative adjustments enforce authorization, reason, and audit requirements', async () => {
    const [adjUser] = await db
      .insert(users)
      .values({
        firstName: 'Adjustment',
        lastName: 'User',
        email: `adjust_${timestamp}_${rand}@homehub.test`,
        roles: ['PROPERTY_OWNER'],
      })
      .returning();

    // 1. Authorization check: Non-admin fails
    await assert.rejects(
      pointsEngine.adminAdjustPoints({
        targetUserId: adjUser.id,
        adminUserId: tenantUser.id,
        adminRoles: ['TENANT'],
        amount: 250,
        direction: 'CREDIT',
        source: 'EARNED',
        reason: 'Customer service compensation',
      }),
      /UNAUTHORIZED_ROLE/
    );

    // 2. Reason validation: Missing or short reason fails
    await assert.rejects(
      pointsEngine.adminAdjustPoints({
        targetUserId: adjUser.id,
        adminUserId: adminUser.id,
        adminRoles: ['SUPER_ADMIN'],
        amount: 250,
        direction: 'CREDIT',
        source: 'EARNED',
        reason: '   ',
      }),
      /MANDATORY_REASON_REQUIRED/
    );

    // 3. Valid CREDIT adjustment
    const creditResult = await pointsEngine.adminAdjustPoints({
      targetUserId: adjUser.id,
      adminUserId: adminUser.id,
      adminRoles: ['SUPER_ADMIN'],
      amount: 250,
      direction: 'CREDIT',
      source: 'EARNED',
      reason: 'Customer service goodwill credit for verified incident',
    });

    assert.strictEqual(creditResult.wallet.earnedBalance, 250);
    assert.strictEqual(creditResult.transaction.type, 'ADMIN_ADJUSTMENT');
    assert.strictEqual(creditResult.transaction.earnedDelta, 250);

    // Capture complete baseline ledger record before any mutation attempts
    const [baselineRow] = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.id, creditResult.transaction.id));
    assert.ok(baselineRow, 'Baseline ledger row must be present');

    // 3a. PostgreSQL enforces append-only semantics, rejecting UPDATE and DELETE at database layer
    const isAppendOnlyViolation = (err: any) =>
      err?.code === '55000' ||
      err?.cause?.code === '55000' ||
      String(err?.message ?? '').includes('POINTS_TRANSACTIONS_APPEND_ONLY') ||
      String(err?.cause?.message ?? '').includes('POINTS_TRANSACTIONS_APPEND_ONLY');

    // Attempt direct no-op UPDATE (SET notes = notes)
    await assert.rejects(
      db.execute(sql`
        UPDATE points_transactions
        SET notes = notes
        WHERE id = ${creditResult.transaction.id}
      `),
      isAppendOnlyViolation,
      'Direct no-op UPDATE (SET notes = notes) must be rejected by PostgreSQL append-only trigger'
    );

    // Verify complete row (all returned columns) remains unchanged after rejected no-op UPDATE
    const [rowAfterNoOpUpdate] = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.id, creditResult.transaction.id));
    assert.deepStrictEqual(
      rowAfterNoOpUpdate,
      baselineRow,
      'Complete original row must remain entirely unchanged across all columns after rejected no-op UPDATE'
    );

    // Attempt direct mutating UPDATE (SET notes = ..., amount = ...)
    await assert.rejects(
      db.execute(sql`
        UPDATE points_transactions
        SET notes = 'MALICIOUS_TAMPER_ATTEMPT', amount = 999999
        WHERE id = ${creditResult.transaction.id}
      `),
      isAppendOnlyViolation,
      'Direct mutating UPDATE must be rejected by PostgreSQL append-only trigger'
    );

    // Verify complete row (all returned columns) remains unchanged after rejected mutating UPDATE
    const [rowAfterMutatingUpdate] = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.id, creditResult.transaction.id));
    assert.deepStrictEqual(
      rowAfterMutatingUpdate,
      baselineRow,
      'Complete original row must remain entirely unchanged across all columns after rejected mutating UPDATE'
    );

    // Attempt direct DELETE
    await assert.rejects(
      db.execute(sql`
        DELETE FROM points_transactions
        WHERE id = ${creditResult.transaction.id}
      `),
      isAppendOnlyViolation,
      'Direct DELETE must be rejected by PostgreSQL append-only trigger'
    );

    // Verify complete row (all returned columns) remains present and unchanged after rejected DELETE
    const [rowAfterDelete] = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.id, creditResult.transaction.id));
    assert.deepStrictEqual(
      rowAfterDelete,
      baselineRow,
      'Complete original row must remain present and entirely unchanged across all columns after rejected DELETE'
    );

    // 4. Audit Log verification
    const [auditEntry] = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actorUserId, adminUser.id),
          eq(auditLogs.action, 'POINTS_ADMIN_ADJUSTMENT'),
          eq(auditLogs.resourceId, creditResult.wallet.id)
        )
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(1);

    assert.ok(auditEntry, 'Authoritative audit log must be persisted in audit_logs table');
    assert.strictEqual(auditEntry.actorRole, 'SUPER_ADMIN');
    assert.strictEqual(auditEntry.changes?.targetUserId, adjUser.id);
    assert.strictEqual(auditEntry.changes?.amount, 250);
    assert.strictEqual(auditEntry.changes?.reason, 'Customer service goodwill credit for verified incident');

    // 5. Valid DEBIT adjustment
    const debitResult = await pointsEngine.adminAdjustPoints({
      targetUserId: adjUser.id,
      adminUserId: adminUser.id,
      adminRoles: ['SUPER_ADMIN'],
      amount: 50,
      direction: 'DEBIT',
      source: 'EARNED',
      reason: 'Reversal of erroneous credit per supervisor request',
    });

    assert.strictEqual(debitResult.wallet.earnedBalance, 200); // 250 - 50 = 200
    assert.strictEqual(debitResult.transaction.earnedDelta, -50);

    // 6. Excessive DEBIT fails
    await assert.rejects(
      pointsEngine.adminAdjustPoints({
        targetUserId: adjUser.id,
        adminUserId: adminUser.id,
        adminRoles: ['SUPER_ADMIN'],
        amount: 500,
        direction: 'DEBIT',
        source: 'EARNED',
        reason: 'Attempting to debit more points than available',
      }),
      /INSUFFICIENT_AVAILABLE_EARNED_BALANCE/
    );
  });
});
