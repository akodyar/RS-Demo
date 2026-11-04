import test from 'node:test';
import assert from 'node:assert';
import { db, pool } from '../src/db/index.js';
import {
  users,
  properties,
  ownershipRecords,
  listings,
  promotionCampaigns,
  pointsTransactions,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { promotionCampaignService } from '../src/server/services/promotion-campaign.js';
import { pointsEngine } from '../src/server/services/points-engine.js';
import { cronService } from '../src/server/services/cron.js';
import { assertSafeDatabaseConfig } from './safe-test-env.js';

process.env.SQL_HOST = process.env.SQL_HOST || 'localhost';
process.env.SQL_DB_NAME = process.env.SQL_DB_NAME || 'homehub_test';
assertSafeDatabaseConfig();

test('Promotion Expiry Scheduler Wiring & Resilience Suite (homehub_test)', async (t) => {
  const runId = 'sched_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const ownerId = `usr_own_${runId}`;
  const adminId = `usr_adm_${runId}`;
  const propRentalId = `prop_rent_${runId}`;
  const listingRentalId = `list_rent_${runId}`;

  const createdCampaignIds: string[] = [];

  t.before(async () => {
    // 1. Verify connection to authorized test database
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    assert.strictEqual(activeDb, 'homehub_test', 'Must connect to homehub_test');

    // 2. Insert synthetic user identities
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@test.iq`, firstName: 'Owner', lastName: 'Scheduler', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: adminId, email: `${adminId}@test.iq`, firstName: 'Admin', lastName: 'Scheduler', roles: ['ADMIN', 'SUPER_ADMIN'], isActive: true },
    ]);

    // 3. Insert property
    await db.insert(properties).values([
      { id: propRentalId, name: `Scheduler Property ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', currency: 'IQD', operatingModel: 'AGENT_OPERATED' },
    ]);

    // 4. Insert ownership record
    await db.insert(ownershipRecords).values([
      { id: `own_rent_${runId}`, propertyId: propRentalId, ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
    ]);

    // 5. Insert rental listing
    await db.insert(listings).values([
      {
        id: listingRentalId,
        propertyId: propRentalId,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '1000000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Scheduler Test Listing ${runId}`,
      },
    ]);

    // 6. Fund owner wallet
    await pointsEngine.adminAdjustPoints({
      targetUserId: ownerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 10000,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Fund owner wallet for scheduler test suite',
    });
  });

  t.after(async () => {
    // Ensure cronService timer is stopped if test started it
    cronService.stop();
  });

  // Helper to create and activate a campaign with custom dates
  const createAndActivateCampaign = async (startTime: Date) => {
    const draft = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draft.id);

    await promotionCampaignService.submitCampaign({
      campaignId: draft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    await promotionCampaignService.approveCampaign({
      campaignId: draft.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
    });

    const activated = await promotionCampaignService.activateCampaign({
      campaignId: draft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      startTime,
    });

    return activated.campaign;
  };

  // --------------------------------------------------------------------------
  // TEST 1: Due Active Campaigns Expired by Scheduler
  // --------------------------------------------------------------------------
  let dueCampaign: any = null;
  await t.test('1. Due active campaigns are expired by the scheduler-triggered path', async () => {
    // Campaign started 2026-09-01, duration 7 days -> ends 2026-09-08
    dueCampaign = await createAndActivateCampaign(new Date('2026-09-01T00:00:00Z'));
    assert.strictEqual(dueCampaign.status, 'ACTIVE');

    // Run scheduler as of 2026-09-10 (after endTime)
    const runResult = await cronService.runJobs(new Date('2026-09-10T00:00:00Z'));

    assert.strictEqual(runResult.skipped, false);
    assert.ok(runResult.promotionResult);
    assert.ok(runResult.promotionResult.expiredCount >= 1);

    // Verify in database that dueCampaign is now EXPIRED
    const [persisted] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, dueCampaign.id));
    assert.strictEqual(persisted.status, 'EXPIRED');

    // Verify 0 points refunded
    const refundTxs = await db.select().from(pointsTransactions).where(
      and(
        eq(pointsTransactions.referenceId, dueCampaign.id),
        eq(pointsTransactions.type, 'RELEASED')
      )
    );
    assert.strictEqual(refundTxs.length, 0, 'No points refunded on natural expiry via scheduler');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Future-Ending Campaigns Remain Active
  // --------------------------------------------------------------------------
  let futureCampaign: any = null;
  await t.test('2. Future-ending campaigns remain active through scheduler runs', async () => {
    // Campaign started 2026-11-01, duration 7 days -> ends 2026-11-08
    futureCampaign = await createAndActivateCampaign(new Date('2026-11-01T00:00:00Z'));
    assert.strictEqual(futureCampaign.status, 'ACTIVE');

    // Run scheduler as of 2026-11-03 (before endTime 2026-11-08)
    const runResult = await cronService.runJobs(new Date('2026-11-03T00:00:00Z'));

    assert.strictEqual(runResult.skipped, false);

    // Verify in database that futureCampaign remains ACTIVE
    const [persisted] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, futureCampaign.id));
    assert.strictEqual(persisted.status, 'ACTIVE');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Repeated Scheduler Runs Do Not Duplicate Expiry
  // --------------------------------------------------------------------------
  await t.test('3. Repeated scheduler runs do not duplicate expiry or points-ledger effects', async () => {
    // Run scheduler again as of 2026-09-10 (dueCampaign is already EXPIRED)
    const runResult = await cronService.runJobs(new Date('2026-09-10T00:00:00Z'));

    assert.strictEqual(runResult.skipped, false);
    // Should not expire the already expired campaign again
    const expiredIds = runResult.promotionResult?.campaigns.map((c: any) => c.id) || [];
    assert.ok(!expiredIds.includes(dueCampaign.id), 'Already expired campaign must not be processed again');

    // Total points transactions for dueCampaign should have exactly 1 RESERVED and 1 SPENT
    const txs = await db.select().from(pointsTransactions).where(eq(pointsTransactions.referenceId, dueCampaign.id));
    assert.strictEqual(txs.filter(t => t.type === 'RESERVED').length, 1);
    assert.strictEqual(txs.filter(t => t.type === 'SPENT').length, 1);
    assert.strictEqual(txs.filter(t => t.type === 'RELEASED').length, 0);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Multiple Due Campaigns Processed Safely When One Fails
  // --------------------------------------------------------------------------
  await t.test('4. Multiple due campaigns are processed safely when one campaign fails (error isolation)', async () => {
    // Create two due campaigns: badCampaign and goodCampaign
    const badCampaign = await createAndActivateCampaign(new Date('2026-08-01T00:00:00Z'));
    const goodCampaign = await createAndActivateCampaign(new Date('2026-08-05T00:00:00Z'));

    // Corrupt badCampaign: remove its endTime directly via SQL
    await pool.query('UPDATE promotion_campaigns SET end_time = null WHERE id = $1', [badCampaign.id]);

    // Sweep as of 2026-08-20
    const sweepResult = await cronService.processExpiredPromotionCampaigns(new Date('2026-08-20T00:00:00Z'));

    // Verify failure isolation
    assert.strictEqual(sweepResult.failedCount, 1, 'Exactly one campaign must fail');
    assert.strictEqual(sweepResult.failedCampaigns[0].campaignId, badCampaign.id);
    assert.match(sweepResult.failedCampaigns[0].error, /CORRUPTED_CAMPAIGN_STATE/);

    // Verify goodCampaign successfully expired despite badCampaign failure
    const [goodPersisted] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, goodCampaign.id));
    assert.strictEqual(goodPersisted.status, 'EXPIRED');
    assert.ok(sweepResult.campaigns.some((c: any) => c.id === goodCampaign.id));

    // Restore badCampaign endTime for clean teardown
    await pool.query('UPDATE promotion_campaigns SET end_time = $1, status = $2 WHERE id = $3', [
      new Date('2026-08-08T00:00:00Z'),
      'EXPIRED',
      badCampaign.id,
    ]);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Overlapping Executions Prevent Duplicate Processing
  // --------------------------------------------------------------------------
  await t.test('5. Overlapping executions do not cause duplicate effects', async () => {
    // Test that when cronService is already running, runJobs skips cleanly
    // We simulate isRunning state
    const originalIsRunning = (cronService as any).isRunning;
    (cronService as any).isRunning = true;

    try {
      const skippedResult = await cronService.runJobs();
      assert.strictEqual(skippedResult.skipped, true);
      assert.strictEqual(skippedResult.promotionResult, null);
    } finally {
      (cronService as any).isRunning = originalIsRunning;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Scheduler Errors Are Observable and Do Not Falsely Report Success
  // --------------------------------------------------------------------------
  await t.test('6. Scheduler errors are observable and do not falsely report success', async () => {
    // Create a campaign with missing endTime
    const brokenCamp = await createAndActivateCampaign(new Date('2026-07-01T00:00:00Z'));
    await pool.query('UPDATE promotion_campaigns SET end_time = null WHERE id = $1', [brokenCamp.id]);

    const result = await cronService.processExpiredPromotionCampaigns(new Date('2026-07-15T00:00:00Z'));

    // Errors must be observable in return value
    assert.ok(result.failedCount >= 1, 'failedCount must report at least 1 failure');
    assert.ok(result.failedCampaigns.length >= 1, 'failedCampaigns must contain failure details');
    const brokenFailure = result.failedCampaigns.find((f: any) => f.campaignId === brokenCamp.id);
    assert.ok(brokenFailure, 'Broken campaign must be explicitly identified');
    assert.match(brokenFailure.error, /CORRUPTED_CAMPAIGN_STATE/);

    // Teardown brokenCamp
    await pool.query('UPDATE promotion_campaigns SET end_time = $1, status = $2 WHERE id = $3', [
      new Date('2026-07-08T00:00:00Z'),
      'EXPIRED',
      brokenCamp.id,
    ]);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Domain & Financial Invariants Intact Across Scheduler Runs
  // --------------------------------------------------------------------------
  await t.test('7. Domain and financial invariants intact across scheduler execution', async () => {
    // Snapshot table counts
    const getCounts = async () => {
      const leases = await pool.query('SELECT count(*)::int as c FROM leases');
      const schedules = await pool.query('SELECT count(*)::int as c FROM rent_schedules');
      const payments = await pool.query('SELECT count(*)::int as c FROM payment_records');
      const deposits = await pool.query('SELECT count(*)::int as c FROM security_deposits');
      const commissions = await pool.query('SELECT count(*)::int as c FROM commissions');
      const rewardRules = await pool.query('SELECT count(*)::int as c FROM points_reward_rules');
      const rewardGrants = await pool.query('SELECT count(*)::int as c FROM points_reward_grants');
      return {
        leases: Number(leases.rows[0].c),
        schedules: Number(schedules.rows[0].c),
        payments: Number(payments.rows[0].c),
        deposits: Number(deposits.rows[0].c),
        commissions: Number(commissions.rows[0].c),
        rewardRules: Number(rewardRules.rows[0].c),
        rewardGrants: Number(rewardGrants.rows[0].c),
      };
    };

    const before = await getCounts();

    // Run scheduler
    await cronService.runJobs();

    const after = await getCounts();

    assert.strictEqual(after.leases, before.leases);
    assert.strictEqual(after.schedules, before.schedules);
    assert.strictEqual(after.payments, before.payments);
    assert.strictEqual(after.deposits, before.deposits);
    assert.strictEqual(after.commissions, before.commissions);
    assert.strictEqual(after.rewardRules, before.rewardRules);
    assert.strictEqual(after.rewardGrants, before.rewardGrants);

    // Verify trigger 0030 append-only immutability continues to function
    const [spentRow] = (await pool.query("SELECT id FROM points_transactions WHERE type = 'SPENT' LIMIT 1")).rows;
    if (spentRow) {
      await assert.rejects(
        async () => {
          await pool.query('UPDATE points_transactions SET notes = $1 WHERE id = $2', ['malicious', spentRow.id]);
        },
        (err: any) => {
          assert.strictEqual(err.code, '55000');
          assert.match(err.message, /POINTS_TRANSACTIONS_APPEND_ONLY/);
          return true;
        }
      );
    }
  });
});
