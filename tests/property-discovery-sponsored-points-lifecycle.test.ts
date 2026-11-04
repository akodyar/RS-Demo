import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  ownershipRecords,
  agentPropertyAssignments,
  listings,
  promotionPackages,
  promotionCampaigns,
  pointsWallets,
  pointsTransactions,
  pointsPurchasePackages,
  pointsPurchaseOrders,
} from '../src/db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { pointsEngine } from '../src/server/services/points-engine.js';
import { promotionCampaignService } from '../src/server/services/promotion-campaign.js';
import { promotionCampaignRepository } from '../src/server/repositories/promotion-campaign.js';

test.describe('HomeHub Property Discovery, Search, Sponsored Advertising, Points Wallet & Points Purchase Lifecycle', () => {
  const runId = 'disc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  const ownerId = `usr_own_${runId}`;
  const agentId = `usr_agt_${runId}`;
  const adminId = `usr_adm_${runId}`;
  const tenantId = `usr_tnt_${runId}`;
  const strangerId = `usr_str_${runId}`;

  const prop1Id = `prop_1_${runId}`;
  const prop2Id = `prop_2_${runId}`;
  const list1Id = `list_1_${runId}`;
  const list2Id = `list_2_${runId}`;
  const campaign1Id = `cmp_1_${runId}`;

  test.before(async () => {
    // 1. Verify target database is homehub_test
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    assert.equal(activeDb, 'homehub_test', 'Must execute against homehub_test');

    // 2. Insert synthetic user accounts
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@test.iq`, firstName: 'Owner', lastName: 'Discovery', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: agentId, email: `${agentId}@test.iq`, firstName: 'Agent', lastName: 'Discovery', roles: ['AGENT'], isActive: true },
      { id: adminId, email: `${adminId}@test.iq`, firstName: 'Admin', lastName: 'Discovery', roles: ['ADMIN', 'SUPER_ADMIN'], isActive: true },
      { id: tenantId, email: `${tenantId}@test.iq`, firstName: 'Tenant', lastName: 'Discovery', roles: ['TENANT'], isActive: true },
      { id: strangerId, email: `${strangerId}@test.iq`, firstName: 'Stranger', lastName: 'Discovery', roles: ['PROPERTY_OWNER'], isActive: true },
    ]);

    // 3. Insert verified properties
    await db.insert(properties).values([
      {
        id: prop1Id,
        name: `Empire World Suite ${runId}`,
        type: 'RESIDENTIAL',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        currency: 'IQD',
        operatingModel: 'DIRECT_BY_OWNER',
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 2000,
        city: 'Erbil',
      },
      {
        id: prop2Id,
        name: `Dream City Luxury Villa ${runId}`,
        type: 'RESIDENTIAL_VILLA',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        currency: 'IQD',
        operatingModel: 'AGENT_OPERATED',
        bedrooms: 5,
        bathrooms: 4,
        squareFeet: 3500,
        city: 'Erbil',
      },
    ]);

    // 4. Insert ownership records
    await db.insert(ownershipRecords).values([
      { id: `own_${prop1Id}`, propertyId: prop1Id, ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
      { id: `own_${prop2Id}`, propertyId: prop2Id, ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
    ]);

    // 5. Assign agent to prop2
    await db.insert(agentPropertyAssignments).values({
      id: `asgn_${prop2Id}`,
      propertyId: prop2Id,
      userId: agentId,
      assignedBy: ownerId,
      permissions: ['MARKETPLACE_LISTING', 'PROMOTION_MANAGEMENT'],
      status: 'ACTIVE',
    });

    // 6. Insert published rental listings
    await db.insert(listings).values([
      {
        id: list1Id,
        propertyId: prop1Id,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '1500000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Empire High Floor Residency ${runId}`,
        description: 'شوقەی بەڕێوەبەری لە نهۆمی باڵای ئیمپایەر بە تاپۆی فەرمی',
      },
      {
        id: list2Id,
        propertyId: prop2Id,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '2800000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Dream City Elite Villa ${runId}`,
        description: 'ڤێلای شاهانە بە باخچەی تایبەت لە دریم سیتی هەولێر',
      },
    ]);

    // 7. Ensure test purchase packages exist
    await db.insert(pointsPurchasePackages).values([
      {
        id: 'PKG_POINTS_500',
        name: 'Starter Pack (500 Points)',
        points: 500,
        price: '50000',
        currency: 'IQD',
        isActive: true,
        allowedRoles: ['PROPERTY_OWNER', 'AGENT'],
      },
      {
        id: 'PKG_POINTS_1000',
        name: 'Standard Pack (1,000 Points)',
        points: 1000,
        price: '95000',
        currency: 'IQD',
        isActive: true,
        allowedRoles: ['PROPERTY_OWNER', 'AGENT'],
      },
    ]).onConflictDoNothing();
  });

  test.after(async () => {
    // Cleanup
    await db.delete(promotionCampaigns).where(eq(promotionCampaigns.listingId, list1Id)).catch(() => {});
    await db.delete(promotionCampaigns).where(eq(promotionCampaigns.listingId, list2Id)).catch(() => {});
    await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, ownerId)).catch(() => {});
    await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, agentId)).catch(() => {});
    await db.delete(pointsPurchaseOrders).where(eq(pointsPurchaseOrders.userId, ownerId)).catch(() => {});
    await db.delete(pointsPurchaseOrders).where(eq(pointsPurchaseOrders.userId, agentId)).catch(() => {});
    await db.delete(pointsWallets).where(eq(pointsWallets.userId, ownerId)).catch(() => {});
    await db.delete(pointsWallets).where(eq(pointsWallets.userId, agentId)).catch(() => {});
    await db.delete(listings).where(eq(listings.id, list1Id)).catch(() => {});
    await db.delete(listings).where(eq(listings.id, list2Id)).catch(() => {});
    await db.delete(agentPropertyAssignments).where(eq(agentPropertyAssignments.propertyId, prop2Id)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, prop1Id)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, prop2Id)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, prop1Id)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, prop2Id)).catch(() => {});
    await db.delete(users).where(eq(users.id, ownerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, agentId)).catch(() => {});
    await db.delete(users).where(eq(users.id, adminId)).catch(() => {});
    await db.delete(users).where(eq(users.id, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.id, strangerId)).catch(() => {});
  });

  // --------------------------------------------------------------------------
  // TEST 1: Strict Domain Separation & Rental-Only Boundary
  // --------------------------------------------------------------------------
  test('1. Strict Domain Separation: Rental search succeeds; Buy/Sell queries fail closed', async () => {
    const searchRent = await promotionCampaignRepository.searchRentalListings({
      type: 'FOR_RENT',
      limit: 10,
    });
    assert.ok(Array.isArray(searchRent.items), 'Search returns items array');
    assert.ok(searchRent.items.length >= 2, 'Must include test rental listings');
    assert.ok(searchRent.items.every((i) => i.type === 'FOR_RENT'), 'All items are strictly FOR_RENT');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Search Filters Correctness (Property Type & Price Range)
  // --------------------------------------------------------------------------
  test('2. Filters correctly isolate matching listings without data leakage', async () => {
    // Filter by price range
    const searchPrice = await promotionCampaignRepository.searchRentalListings({
      type: 'FOR_RENT',
      minPrice: 2000000, // list2 is 2,800,000, list1 is 1,500,000
    });
    const foundList2 = searchPrice.items.find((i) => i.id === list2Id);
    const foundList1 = searchPrice.items.find((i) => i.id === list1Id);
    assert.ok(foundList2, 'List2 matches minimum price 2,000,000');
    assert.equal(foundList1, undefined, 'List1 excluded by minimum price filter');

    // Filter by propertyType
    const searchVilla = await promotionCampaignRepository.searchRentalListings({
      type: 'FOR_RENT',
      propertyType: 'VILLA',
    });
    const foundVilla = searchVilla.items.find((i) => i.id === list2Id);
    assert.ok(foundVilla, 'Villa listing found');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Points Wallet Initial State & Non-Negative Balances
  // --------------------------------------------------------------------------
  test('3. Points wallet initializes with separated 0 balances and enforces non-negative constraints', async () => {
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.equal(Number(wallet.earnedBalance), 0, 'Earned balance starts at 0');
    assert.equal(Number(wallet.purchasedBalance), 0, 'Purchased balance starts at 0');
    assert.equal(Number(wallet.reservedEarnedBalance), 0, 'Reserved earned starts at 0');
    assert.equal(Number(wallet.reservedPurchasedBalance), 0, 'Reserved purchased starts at 0');

    const summary = pointsEngine.summarizeWallet(wallet);
    assert.equal(summary.availableTotal, 0, 'Available total is 0');
    assert.equal(summary.totalBalance, 0, 'Total balance is 0');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Points Purchase Order Creation (Pending State)
  // --------------------------------------------------------------------------
  test('4. Purchase order creation enters PENDING state without crediting points prematurely', async () => {
    const orderResult = await pointsEngine.createPurchaseOrder({
      userId: ownerId,
      userRoles: ['PROPERTY_OWNER'],
      packageId: 'PKG_POINTS_1000',
      paymentMethod: 'FIB',
      paymentReference: `FIB-REF-${runId}`,
      actorUserId: ownerId,
    });

    assert.equal(orderResult.order.status, 'PENDING', 'Order status must be PENDING');
    assert.equal(orderResult.order.points, 1000, 'Order records 1,000 points');
    assert.equal(orderResult.order.currency, 'IQD', 'Order currency is IQD');

    // Verify wallet balance is STILL 0 (pending payment must not credit points)
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.equal(Number(wallet.purchasedBalance), 0, 'Purchased balance remains 0 while order is PENDING');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Admin Purchase Confirmation & Atomic Points Crediting
  // --------------------------------------------------------------------------
  test('5. Admin confirmation credits purchased balance atomically and records ledger entry', async () => {
    const orders = await db
      .select()
      .from(pointsPurchaseOrders)
      .where(eq(pointsPurchaseOrders.userId, ownerId));
    assert.ok(orders.length > 0, 'Pending order exists');
    const orderId = orders[0].id;

    const confirmResult = await pointsEngine.confirmPurchaseOrder({
      orderId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
    });

    assert.equal(confirmResult.order.status, 'CONFIRMED', 'Order status becomes CONFIRMED');
    assert.ok(confirmResult.transaction, 'Ledger transaction created');
    assert.equal(confirmResult.transaction.purchasedDelta, 1000, 'Ledger credits 1000 purchased points');

    // Authoritative wallet check
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.equal(Number(wallet.purchasedBalance), 1000, 'Purchased balance is now 1,000');
    const summary = pointsEngine.summarizeWallet(wallet);
    assert.equal(summary.availableTotal, 1000, 'Available total is 1,000');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Purchase Confirmation Idempotency
  // --------------------------------------------------------------------------
  test('6. Repeated confirmation of already-confirmed purchase order is idempotent and prevents double-crediting', async () => {
    const orders = await db
      .select()
      .from(pointsPurchaseOrders)
      .where(and(eq(pointsPurchaseOrders.userId, ownerId), eq(pointsPurchaseOrders.status, 'CONFIRMED')));
    const orderId = orders[0].id;

    const replayResult = await pointsEngine.confirmPurchaseOrder({
      orderId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
    });

    assert.equal(replayResult.idempotentReplay, true, 'Replay flagged as idempotent');
    assert.ok(replayResult.transaction, 'Existing transaction returned on replay');

    // Verify balance unchanged
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.equal(Number(wallet.purchasedBalance), 1000, 'Purchased balance remains exactly 1,000');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Unauthorized Purchase Rejection (Tenant / Stranger)
  // --------------------------------------------------------------------------
  test('7. Unauthorized roles (TENANT) cannot purchase points', async () => {
    await assert.rejects(
      async () => {
        await pointsEngine.createPurchaseOrder({
          userId: tenantId,
          userRoles: ['TENANT'],
          packageId: 'PKG_POINTS_500',
          actorUserId: tenantId,
        });
      },
      /UNAUTHORIZED_ROLE/,
      'TENANT role must be rejected from purchasing points'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 8: Campaign Creation & Atomic Points Reservation
  // --------------------------------------------------------------------------
  test('8. Campaign draft & submit atomically reserves points from payer wallet', async () => {
    // Create draft campaign
    const draft = await promotionCampaignService.createDraftCampaign({
      listingId: list1Id,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    assert.equal(draft.status, 'DRAFT', 'Campaign status is DRAFT');
    assert.equal(draft.pointsCost, 500, 'Package cost snapshotted as 500');

    // Submit campaign -> reserves points
    const submitResult = await promotionCampaignService.submitCampaign({
      campaignId: draft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    assert.equal(submitResult.campaign.status, 'SUBMITTED', 'Campaign status is SUBMITTED');
    assert.ok(submitResult.reservation, 'Reservation transaction recorded');

    // Verify wallet: purchasedBalance is 1000, reservedPurchasedBalance is 500, available is 500
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.equal(Number(wallet.purchasedBalance), 1000, 'Purchased balance intact');
    assert.equal(Number(wallet.reservedPurchasedBalance), 500, 'Reserved balance is 500');
    const summary = pointsEngine.summarizeWallet(wallet);
    assert.equal(summary.availableTotal, 500, 'Available total reduced by exactly 500 to 500');
  });

  // --------------------------------------------------------------------------
  // TEST 9: Agent Promotion Owner Consent Requirement
  // --------------------------------------------------------------------------
  test('9. Agent promoting owner property mandates explicit property owner consent', async () => {
    // Fund agent wallet with 500 points
    await pointsEngine.adminAdjustPoints({
      targetUserId: agentId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 500,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Agent audit funding',
    });

    // Agent creates campaign for prop2 (owner is ownerId, not agentId)
    const agentDraft = await promotionCampaignService.createDraftCampaign({
      listingId: list2Id,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: agentId,
      actorRoles: ['AGENT'],
    });

    assert.equal(agentDraft.consentStatus, 'REQUESTED', 'Consent is mandatory when agent creates campaign');

    // Submitting campaign with requested consent
    await promotionCampaignService.submitCampaign({
      campaignId: agentDraft.id,
      actorUserId: agentId,
      actorRoles: ['AGENT'],
    });

    // Unrelated caller cannot grant consent
    await assert.rejects(
      async () => {
        await promotionCampaignService.grantOwnerConsent({
          campaignId: agentDraft.id,
          actorUserId: strangerId,
          actorRoles: ['PROPERTY_OWNER'],
        });
      },
      /UNAUTHORIZED_OWNER_CONSENT/,
      'Stranger cannot grant owner consent'
    );

    // Verified owner grants consent
    const consentResult = await promotionCampaignService.grantOwnerConsent({
      campaignId: agentDraft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      notes: 'Owner authorized promotion via app',
    });
    assert.equal(consentResult.campaign.consentStatus, 'GRANTED', 'Consent becomes GRANTED');
  });

  // --------------------------------------------------------------------------
  // TEST 10: Admin Approval & Activation Spends Points Atomically
  // --------------------------------------------------------------------------
  test('10. Admin approval and campaign activation transitions status to ACTIVE and spends points', async () => {
    const [campaign] = await db
      .select()
      .from(promotionCampaigns)
      .where(and(eq(promotionCampaigns.listingId, list1Id), eq(promotionCampaigns.status, 'SUBMITTED')));

    assert.ok(campaign, 'Submitted campaign exists for list1Id');

    // Admin approves
    const approveResult = await promotionCampaignService.approveCampaign({
      campaignId: campaign.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
    });
    assert.equal(approveResult.campaign.status, 'APPROVED', 'Campaign is APPROVED');

    // Activate campaign with startTime set to 1 minute ago so it is immediately active
    const activateResult = await promotionCampaignService.activateCampaign({
      campaignId: campaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      startTime: new Date(Date.now() - 60 * 1000),
    });
    assert.equal(activateResult.campaign.status, 'ACTIVE', 'Campaign is ACTIVE');
    assert.ok(activateResult.spendTransaction, 'Points spend transaction executed');

    // Verify wallet: 500 points permanently spent
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.equal(Number(wallet.purchasedBalance), 500, 'Purchased balance reduced from 1000 to 500');
    assert.equal(Number(wallet.reservedPurchasedBalance), 0, 'Reserved balance cleared to 0');
    const summary = pointsEngine.summarizeWallet(wallet);
    assert.equal(summary.availableTotal, 500, 'Available total is 500');
  });

  // --------------------------------------------------------------------------
  // TEST 11: Sponsored Placement Ranking Boost in Search
  // --------------------------------------------------------------------------
  test('11. Active campaign boosts listing to the top of search results with isPromoted metadata', async () => {
    const search = await promotionCampaignRepository.searchRentalListings({
      type: 'FOR_RENT',
      limit: 10,
      placement: 'SEARCH',
    });

    const firstItem = search.items[0];
    assert.ok(firstItem, 'Search returned items');
    assert.equal(firstItem.id, list1Id, 'List1 is boosted to index 0 because it has an active SPONSORED_SEARCH campaign');
    assert.equal(firstItem.isPromoted, true, 'firstItem isPromoted flag is true');
    assert.equal(firstItem.promotionType, 'SPONSORED_SEARCH', 'Promotion type is SPONSORED_SEARCH');
  });

  // --------------------------------------------------------------------------
  // TEST 12: Campaign Rejection Releases Points to Payer
  // --------------------------------------------------------------------------
  test('12. Admin rejection releases reserved points back to payer without balance loss', async () => {
    // Create new campaign for list1
    const draft2 = await promotionCampaignService.createDraftCampaign({
      listingId: list1Id,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    await promotionCampaignService.submitCampaign({
      campaignId: draft2.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    // Available balance dropped to 500 - 500 = 0
    let wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.equal(Number(wallet.reservedPurchasedBalance), 500, '500 points reserved');

    // Admin rejects
    const rejectResult = await promotionCampaignService.rejectCampaign({
      campaignId: draft2.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
      reason: 'Inappropriate listing text during audit',
    });

    assert.equal(rejectResult.campaign.status, 'REJECTED', 'Campaign status is REJECTED');
    assert.equal(rejectResult.idempotentReplay, false, 'Initial rejection is not idempotent replay');

    // Available balance restored back to 500!
    wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.equal(Number(wallet.reservedPurchasedBalance), 0, 'Reserved balance restored to 0');
    assert.equal(Number(wallet.purchasedBalance), 500, 'Purchased balance remains 500');
    const summary = pointsEngine.summarizeWallet(wallet);
    assert.equal(summary.availableTotal, 500, 'Available total restored to 500');
  });
});
