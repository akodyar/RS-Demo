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
import { assertSafeDatabaseConfig } from './safe-test-env.js';

process.env.SQL_HOST = process.env.SQL_HOST || 'localhost';
process.env.SQL_DB_NAME = process.env.SQL_DB_NAME || 'homehub_test';
assertSafeDatabaseConfig();

test('Marketplace Promotion Ranking Boost & Lifecycle Integration Suite (homehub_test)', async (t) => {
  const runId = 'rank_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const ownerId = `usr_own_${runId}`;
  const adminId = `usr_adm_${runId}`;

  // 3 distinct properties and listings with staggered creation times
  const propAId = `prop_a_${runId}`;
  const propBId = `prop_b_${runId}`;
  const propCId = `prop_c_${runId}`;
  const listingAId = `list_a_${runId}`;
  const listingBId = `list_b_${runId}`;
  const listingCId = `list_c_${runId}`;

  const createdCampaignIds: string[] = [];

  t.before(async () => {
    // 1. Safe DB check
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    assert.strictEqual(activeDb, 'homehub_test', 'Must connect to homehub_test');

    // 2. Synthetic users
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@test.iq`, firstName: 'Owner', lastName: 'Ranking', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: adminId, email: `${adminId}@test.iq`, firstName: 'Admin', lastName: 'Ranking', roles: ['ADMIN', 'SUPER_ADMIN'], isActive: true },
    ]);

    // 3. Properties (All VERIFIED)
    await db.insert(properties).values([
      { id: propAId, name: `Property A ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', currency: 'IQD', operatingModel: 'AGENT_OPERATED', verificationStatus: 'VERIFIED' },
      { id: propBId, name: `Property B ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', currency: 'IQD', operatingModel: 'AGENT_OPERATED', verificationStatus: 'VERIFIED' },
      { id: propCId, name: `Property C ${runId}`, type: 'COMMERCIAL', status: 'ACTIVE', currency: 'IQD', operatingModel: 'AGENT_OPERATED', verificationStatus: 'VERIFIED' },
    ]);

    // 4. Ownership records (All VERIFIED)
    await db.insert(ownershipRecords).values([
      { id: `own_a_${runId}`, propertyId: propAId, ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
      { id: `own_b_${runId}`, propertyId: propBId, ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
      { id: `own_c_${runId}`, propertyId: propCId, ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
    ]);

    // 5. Rental listings with staggered createdAt
    // Listing A: oldest (created 3 hours ago, price 1,000,000 IQD)
    // Listing B: middle (created 2 hours ago, price 2,000,000 IQD)
    // Listing C: newest (created 1 hour ago, price 3,000,000 IQD)
    const baseTime = Date.now();
    await db.insert(listings).values([
      {
        id: listingAId,
        propertyId: propAId,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '1000000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Listing A (Oldest) ${runId}`,
        createdAt: new Date(baseTime - 3 * 3600 * 1000),
      },
      {
        id: listingBId,
        propertyId: propBId,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '2000000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Listing B (Middle) ${runId}`,
        createdAt: new Date(baseTime - 2 * 3600 * 1000),
      },
      {
        id: listingCId,
        propertyId: propCId,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '3000000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Listing C (Newest) ${runId}`,
        createdAt: new Date(baseTime - 1 * 3600 * 1000),
      },
    ]);

    // 6. Fund owner wallet
    await pointsEngine.adminAdjustPoints({
      targetUserId: ownerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 50000,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Fund owner wallet for ranking test suite',
    });
  });

  // Helper to activate a campaign for a listing
  const activateCampaignForListing = async (listingId: string, packageId: string, startTime: Date) => {
    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId,
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
  // TEST 1: Baseline Natural Ordering Without Active Promotions
  // --------------------------------------------------------------------------
  await t.test('1. Baseline natural ordering: listings sorted newest first (createdAt DESC)', async () => {
    const res = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      limit: 50,
    });

    // Filter to our test listings
    const testItems = res.items.filter(i => [listingAId, listingBId, listingCId].includes(i.id));
    assert.strictEqual(testItems.length, 3);
    assert.strictEqual(testItems[0].id, listingCId, 'Newest Listing C must be first');
    assert.strictEqual(testItems[1].id, listingBId, 'Middle Listing B must be second');
    assert.strictEqual(testItems[2].id, listingAId, 'Oldest Listing A must be last');
    assert.strictEqual(testItems.every(i => !i.isPromoted), true, 'None should be promoted initially');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Active SPONSORED_SEARCH Promotes Oldest Listing to First Position
  // --------------------------------------------------------------------------
  let campaignA: any = null;
  await t.test('2. Active SPONSORED_SEARCH campaign boosts Listing A above newer listings in search', async () => {
    // Activate promotion for Listing A: starts 1 day ago, ends 6 days in future
    const now = new Date();
    const startTime = new Date(now.getTime() - 24 * 3600 * 1000);
    campaignA = await activateCampaignForListing(listingAId, 'PKG_SPONSORED_SEARCH_7D', startTime);
    assert.strictEqual(campaignA.status, 'ACTIVE');

    const res = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      limit: 50,
      asOf: now,
      placement: 'SEARCH',
    });

    const testItems = res.items.filter(i => [listingAId, listingBId, listingCId].includes(i.id));
    assert.strictEqual(testItems.length, 3);

    // Listing A must jump to the top!
    assert.strictEqual(testItems[0].id, listingAId, 'Promoted Listing A must rank first');
    assert.strictEqual(testItems[0].isPromoted, true);
    assert.strictEqual(testItems[0].promotionType, 'SPONSORED_SEARCH');

    // Remaining unpromoted listings retain natural newest-first order
    assert.strictEqual(testItems[1].id, listingCId, 'Unpromoted newest Listing C ranks second');
    assert.strictEqual(testItems[1].isPromoted, false);
    assert.strictEqual(testItems[2].id, listingBId, 'Unpromoted middle Listing B ranks third');
    assert.strictEqual(testItems[2].isPromoted, false);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Package Placement Scope (SEARCH vs HOMEPAGE)
  // --------------------------------------------------------------------------
  await t.test('3. Package placement scope: HOME_FEATURED affects HOMEPAGE only, not SEARCH', async () => {
    // Activate HOME_FEATURED for Listing B
    const now = new Date();
    const startTime = new Date(now.getTime() - 12 * 3600 * 1000);
    const campaignB = await activateCampaignForListing(listingBId, 'PKG_HOME_FEATURED_7D', startTime);
    assert.strictEqual(campaignB.status, 'ACTIVE');

    // Query with placement = 'SEARCH'
    // Listing A (SPONSORED_SEARCH) gets boost; Listing B (HOME_FEATURED) does NOT get boost in SEARCH
    const searchRes = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      limit: 50,
      asOf: now,
      placement: 'SEARCH',
    });
    const searchItems = searchRes.items.filter(i => [listingAId, listingBId, listingCId].includes(i.id));
    assert.strictEqual(searchItems[0].id, listingAId, 'Listing A boosted in SEARCH');
    assert.strictEqual(searchItems[1].id, listingCId, 'Listing C (newest unpromoted in SEARCH)');
    assert.strictEqual(searchItems[2].id, listingBId, 'Listing B not boosted in SEARCH');
    assert.strictEqual(searchItems[2].isPromoted, false);

    // Query with placement = 'HOMEPAGE'
    // Listing B (HOME_FEATURED) gets boost; Listing A (SPONSORED_SEARCH) does NOT get boost in HOMEPAGE
    const homeRes = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      limit: 50,
      asOf: now,
      placement: 'HOMEPAGE',
    });
    const homeItems = homeRes.items.filter(i => [listingAId, listingBId, listingCId].includes(i.id));
    assert.strictEqual(homeItems[0].id, listingBId, 'Listing B boosted on HOMEPAGE');
    assert.strictEqual(homeItems[0].isPromoted, true);
    assert.strictEqual(homeItems[0].promotionType, 'HOME_FEATURED');
    assert.strictEqual(homeItems[1].id, listingCId, 'Listing C (newest unpromoted on HOMEPAGE)');
    assert.strictEqual(homeItems[2].id, listingAId, 'Listing A not boosted on HOMEPAGE');
    assert.strictEqual(homeItems[2].isPromoted, false);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Time-Window Boundary Enforcement (Immediate Expiry Without Sweep)
  // --------------------------------------------------------------------------
  await t.test('4. Time-window boundary: ranking effect disappears immediately at or after endTime', async () => {
    // campaignA has startTime = now - 24h, duration = 7d -> ends now + 6d
    // If asOf is after endTime, campaignA MUST NOT receive a boost, even before any expiry sweeper runs!
    const farFuture = new Date(Date.now() + 10 * 24 * 3600 * 1000); // 10 days in future

    const resFuture = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      limit: 50,
      asOf: farFuture,
      placement: 'SEARCH',
    });

    const testItems = resFuture.items.filter(i => [listingAId, listingBId, listingCId].includes(i.id));
    // Since both campaigns have expired as of farFuture, order reverts to natural createdAt DESC!
    assert.strictEqual(testItems[0].id, listingCId, 'Reverts to newest Listing C');
    assert.strictEqual(testItems[1].id, listingBId, 'Reverts to middle Listing B');
    assert.strictEqual(testItems[2].id, listingAId, 'Reverts to oldest Listing A');
    assert.strictEqual(testItems.every(i => !i.isPromoted), true, 'All promotions lapsed as of future time');

    // Similarly, if asOf is before startTime (not yet started)
    const farPast = new Date(Date.now() - 30 * 24 * 3600 * 1000); // 30 days in past
    const resPast = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      limit: 50,
      asOf: farPast,
      placement: 'SEARCH',
    });
    const pastItems = resPast.items.filter(i => [listingAId, listingBId, listingCId].includes(i.id));
    assert.strictEqual(pastItems.every(i => !i.isPromoted), true, 'No boost before campaign startTime');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Non-Active Statuses Never Receive Ranking Boost
  // --------------------------------------------------------------------------
  await t.test('5. Non-active campaigns (DRAFT, SUBMITTED, APPROVED, REJECTED, CANCELLED) never boost ranking', async () => {
    const testTime = new Date();

    // Create DRAFT campaign on Listing C
    const draftC = await promotionCampaignService.createDraftCampaign({
      listingId: listingCId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draftC.id);

    // Force draftC times to overlap testTime directly
    await pool.query('UPDATE promotion_campaigns SET start_time = $1, end_time = $2 WHERE id = $3', [
      new Date(testTime.getTime() - 3600000),
      new Date(testTime.getTime() + 3600000),
      draftC.id,
    ]);

    // Test across all non-active statuses
    const statuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'];
    for (const st of statuses) {
      await pool.query('UPDATE promotion_campaigns SET status = $1 WHERE id = $2', [st, draftC.id]);

      const res = await promotionCampaignService.searchRentalListings({
        type: 'FOR_RENT',
        limit: 50,
        asOf: testTime,
        placement: 'SEARCH',
      });

      const itemC = res.items.find(i => i.id === listingCId);
      assert.ok(itemC);
      assert.strictEqual(itemC.isPromoted, false, `Campaign in status '${st}' must NOT receive boost`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Search Filters & Relevance Preservation (Promotions Cannot Bypass Filters)
  // --------------------------------------------------------------------------
  await t.test('6. Search filters preserved: price and propertyType filters exclude promoted listings if criteria not met', async () => {
    const now = new Date();
    // Listing A is promoted, but has price 1,000,000 and propertyType RESIDENTIAL
    // Filter minPrice: 2,500,000 (only Listing C at 3,000,000 matches)
    const priceRes = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      minPrice: 2500000,
      asOf: now,
      placement: 'SEARCH',
    });

    const priceIds = priceRes.items.map(i => i.id);
    assert.ok(!priceIds.includes(listingAId), 'Promoted Listing A must be excluded by minPrice filter');
    assert.ok(priceIds.includes(listingCId), 'Listing C must be included');

    // Filter propertyType: 'commercial' (only Listing C matches)
    const typeRes = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      propertyType: 'commercial',
      asOf: now,
      placement: 'SEARCH',
    });

    const typeIds = typeRes.items.map(i => i.id);
    assert.ok(!typeIds.includes(listingAId), 'Promoted Listing A must be excluded by propertyType filter');
    assert.ok(typeIds.includes(listingCId), 'Commercial Listing C must be included');

    // Unverified property check: if property is unverified, it is excluded even with active promotion
    await pool.query("UPDATE properties SET verification_status = 'PENDING' WHERE id = $1", [propAId]);
    const unverifiedRes = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      asOf: now,
      placement: 'SEARCH',
    });
    const unverifiedIds = unverifiedRes.items.map(i => i.id);
    assert.ok(!unverifiedIds.includes(listingAId), 'Unverified property must be excluded from search');
    await pool.query("UPDATE properties SET verification_status = 'VERIFIED' WHERE id = $1", [propAId]);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Deduplication and Stability (Multiple Campaigns Never Duplicate Rows)
  // --------------------------------------------------------------------------
  await t.test('7. Multiple active campaigns on a single listing do not duplicate rows or destabilize pagination', async () => {
    const now = new Date();
    // Add a second active campaign (MULTI_PAGE) to Listing A
    const secondCampA = await activateCampaignForListing(
      listingAId,
      'PKG_MULTI_PAGE_7D',
      new Date(now.getTime() - 12 * 3600 * 1000)
    );
    assert.strictEqual(secondCampA.status, 'ACTIVE');

    const res = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      limit: 50,
      asOf: now,
      placement: 'SEARCH',
    });

    // Check occurrences of Listing A in results
    const occurrencesOfA = res.items.filter(i => i.id === listingAId);
    assert.strictEqual(occurrencesOfA.length, 1, 'Listing A must appear exactly ONCE (zero duplicate rows)');

    // Total count matches distinct listing count
    const totalMatching = res.items.filter(i => [listingAId, listingBId, listingCId].includes(i.id));
    assert.strictEqual(totalMatching.length, 3, 'All 3 test listings present exactly once');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Financial Invariants and Immutability
  // --------------------------------------------------------------------------
  await t.test('8. Points ledger and financial invariants intact across search operations', async () => {
    // Count transactions for owner
    const txRows = await db.select().from(pointsTransactions).where(eq(pointsTransactions.userId, ownerId));
    assert.ok(txRows.length > 0);

    // Ledger rows must remain append-only
    const firstTx = txRows[0];
    await assert.rejects(
      async () => {
        await pool.query('UPDATE points_transactions SET notes = $1 WHERE id = $2', ['malicious', firstTx.id]);
      },
      (err: any) => {
        assert.strictEqual(err.code, '55000');
        assert.match(err.message, /POINTS_TRANSACTIONS_APPEND_ONLY/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 9: HTTP Route Integration (/api/marketplace/listings/search)
  // --------------------------------------------------------------------------
  await t.test('9. HTTP route /api/marketplace/listings/search returns boosted listings with isPromoted and promotionType', async () => {
    const express = (await import('express')).default;
    const marketplaceRouter = (await import('../src/server/routes/marketplace.js')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/marketplace', marketplaceRouter);

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. GET /api/marketplace/listings/search?type=FOR_RENT
      const res = await fetch(`${baseUrl}/api/marketplace/listings/search?type=FOR_RENT&limit=50`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.items));

      const testItems = data.items.filter((i: any) => [listingAId, listingBId, listingCId].includes(i.id));
      assert.strictEqual(testItems[0].id, listingAId, 'Listing A with active promotion ranks first via HTTP API');
      assert.strictEqual(testItems[0].isPromoted, true);
      assert.ok(testItems[0].promotionType);

      // 2. Strict Domain Separation: FOR_SALE rejected with 403 BUY_SELL_DISABLED
      const saleRes = await fetch(`${baseUrl}/api/marketplace/listings/search?type=FOR_SALE`);
      assert.strictEqual(saleRes.status, 403);
      const saleData = await saleRes.json();
      assert.strictEqual(saleData.error, 'BUY_SELL_DISABLED');
    } finally {
      server.close();
    }
  });
});
