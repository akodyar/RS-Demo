import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { db, pool } from '../src/db/index.js';
import {
  users,
  properties,
  ownershipRecords,
  listings,
  promotionPackages,
  promotionCampaigns,
  pointsWallets,
  pointsTransactions,
  pointsPurchasePackages,
  pointsPurchaseOrders,
} from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { assertSafeDatabaseConfig } from './safe-test-env.js';

process.env.SQL_HOST = process.env.SQL_HOST || 'localhost';
process.env.SQL_DB_NAME = process.env.SQL_DB_NAME || 'homehub_test';
assertSafeDatabaseConfig();

test('Points & Promotions HTTP API Routes Integration Suite (homehub_test)', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const runId = 'route_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  // User identities
  const ownerId = `usr_own_${runId}`;
  const tenantId = `usr_tnt_${runId}`;
  const adminId = `usr_adm_${runId}`;
  const strangerId = `usr_str_${runId}`;

  // Property & listing identities
  const propId = `prop_${runId}`;
  const listingId = `list_${runId}`;

  let createdOrderId: string = '';
  let createdCampaignId: string = '';

  const ownerToken = signAuthToken({
    id: ownerId,
    email: `${ownerId}@homehub.iq`,
    roles: ['PROPERTY_OWNER'],
  });

  const tenantToken = signAuthToken({
    id: tenantId,
    email: `${tenantId}@homehub.iq`,
    roles: ['TENANT'],
  });

  const adminToken = signAuthToken({
    id: adminId,
    email: `${adminId}@homehub.iq`,
    roles: ['ADMIN', 'SUPER_ADMIN'],
  });

  const strangerToken = signAuthToken({
    id: strangerId,
    email: `${strangerId}@homehub.iq`,
    roles: ['PROPERTY_OWNER'],
  });

  t.before(async () => {
    // 1. Verify connection to authorized test database
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    assert.strictEqual(activeDb, 'homehub_test', 'Must execute against homehub_test exclusively');

    // 2. Insert synthetic user identities
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@homehub.iq`, firstName: 'Owner', lastName: 'RouteTest', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: tenantId, email: `${tenantId}@homehub.iq`, firstName: 'Tenant', lastName: 'RouteTest', roles: ['TENANT'], isActive: true },
      { id: adminId, email: `${adminId}@homehub.iq`, firstName: 'Admin', lastName: 'RouteTest', roles: ['ADMIN', 'SUPER_ADMIN'], isActive: true },
      { id: strangerId, email: `${strangerId}@homehub.iq`, firstName: 'Stranger', lastName: 'RouteTest', roles: ['PROPERTY_OWNER'], isActive: true },
    ]);

    // 3. Insert property
    await db.insert(properties).values({
      id: propId,
      name: `Route Test Property ${runId}`,
      type: 'RESIDENTIAL',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currency: 'IQD',
      operatingModel: 'DIRECT_BY_OWNER',
    });

    // 4. Insert ownership record
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`,
      propertyId: propId,
      ownerId: ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    // 5. Insert published rental listing
    await db.insert(listings).values({
      id: listingId,
      propertyId: propId,
      publisherUserId: ownerId,
      type: 'FOR_RENT',
      price: '1200000',
      currency: 'IQD',
      title: `Route Test Rental Listing ${runId}`,
      description: 'Cozy verified rental apartment in Erbil',
      status: 'PUBLISHED',
    });
  });

  t.after(async () => {
    try {
      await db.delete(promotionCampaigns).where(eq(promotionCampaigns.listingId, listingId)).catch(() => {});
      await db.delete(listings).where(eq(listings.id, listingId)).catch(() => {});
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
      await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
      await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, ownerId)).catch(() => {});
      await db.delete(pointsPurchaseOrders).where(eq(pointsPurchaseOrders.userId, ownerId)).catch(() => {});
      await db.delete(pointsWallets).where(eq(pointsWallets.userId, ownerId)).catch(() => {});
      await db.delete(users).where(sql`id IN (${ownerId}, ${tenantId}, ${adminId}, ${strangerId})`).catch(() => {});
    } catch {
      // Ignore cleanup errors
    } finally {
      await pool.end().catch(() => {});
    }
  });

  // ==========================================
  // POINTS ROUTE TESTS
  // ==========================================

  await t.test('GET /api/points/packages returns active purchase packages', async () => {
    const res = await request(app).get('/api/points/packages');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 3, 'Expected at least 3 seeded purchase packages');
    const pkg1000 = res.body.find((p: any) => p.id === 'PKG_POINTS_1000');
    assert.ok(pkg1000, 'PKG_POINTS_1000 must be present');
    assert.strictEqual(pkg1000.points, 1000);
  });

  await t.test('GET /api/points/wallet rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/points/wallet');
    assert.strictEqual(res.status, 401);
  });

  await t.test('GET /api/points/wallet returns initialized wallet for authenticated owner', async () => {
    const res = await request(app)
      .get('/api/points/wallet')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.wallet);
    assert.strictEqual(res.body.wallet.userId, ownerId);
    assert.strictEqual(res.body.wallet.totalBalance, 0);
    assert.strictEqual(res.body.wallet.availableTotal, 0);
    assert.ok(Array.isArray(res.body.transactions));
  });

  await t.test('POST /api/points/purchase rejects unauthorized role (TENANT) with 403', async () => {
    const res = await request(app)
      .post('/api/points/purchase')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ packageId: 'PKG_POINTS_1000', paymentMethod: 'CASH' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'FORBIDDEN');
  });

  await t.test('POST /api/points/purchase creates pending purchase order for PROPERTY_OWNER', async () => {
    const res = await request(app)
      .post('/api/points/purchase')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        packageId: 'PKG_POINTS_1000',
        paymentMethod: 'CASH',
        paymentReference: `REF_${runId}`,
        idempotencyKey: `idemp_order_${runId}`,
      });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.order);
    assert.strictEqual(res.body.order.userId, ownerId);
    assert.strictEqual(res.body.order.packageId, 'PKG_POINTS_1000');
    assert.strictEqual(res.body.order.points, 1000);
    assert.strictEqual(res.body.order.status, 'PENDING');
    createdOrderId = res.body.order.id;
  });

  await t.test('GET /api/points/admin/purchase-orders rejects non-admin with 403', async () => {
    const res = await request(app)
      .get('/api/points/admin/purchase-orders')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.strictEqual(res.status, 403);
  });

  await t.test('GET /api/points/admin/purchase-orders returns orders list for ADMIN', async () => {
    const res = await request(app)
      .get('/api/points/admin/purchase-orders?status=PENDING')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const order = res.body.find((o: any) => o.id === createdOrderId);
    assert.ok(order, 'Created order should be present in admin list');
    assert.strictEqual(order.status, 'PENDING');
  });

  await t.test('POST /api/points/admin/purchase-orders/:id/confirm credits purchased points', async () => {
    const res = await request(app)
      .post(`/api/points/admin/purchase-orders/${createdOrderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: `idemp_confirm_${runId}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.order.status, 'CONFIRMED');
    assert.strictEqual(res.body.wallet.purchasedBalance, 1000);
    assert.strictEqual(res.body.wallet.availablePurchased, 1000);
    assert.strictEqual(res.body.transaction.type, 'PURCHASED');
  });

  await t.test('GET /api/points/wallet reflects confirmed 1000 purchased points balance', async () => {
    const res = await request(app)
      .get('/api/points/wallet')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.wallet.purchasedBalance, 1000);
    assert.strictEqual(res.body.wallet.availableTotal, 1000);
    assert.strictEqual(res.body.transactions.length, 1);
  });

  // ==========================================
  // PROMOTIONS & PLACEMENTS ROUTE TESTS
  // ==========================================

  await t.test('GET /api/promotions/packages returns active promotion packages', async () => {
    const res = await request(app).get('/api/promotions/packages');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 3);
    const multiPkg = res.body.find((p: any) => p.id === 'PKG_MULTI_PAGE_7D');
    assert.ok(multiPkg);
    assert.strictEqual(multiPkg.pointsCost, 1000);
  });

  await t.test('GET /api/promotions/placements/:scope validates scope input', async () => {
    const invalidRes = await request(app).get('/api/promotions/placements/UNKNOWN');
    assert.strictEqual(invalidRes.status, 400);
    assert.strictEqual(invalidRes.body.error, 'INVALID_PLACEMENT_SCOPE');

    const homeRes = await request(app).get('/api/promotions/placements/HOMEPAGE');
    assert.strictEqual(homeRes.status, 200);
    assert.strictEqual(homeRes.body.placement, 'HOMEPAGE');
    assert.ok(Array.isArray(homeRes.body.items));

    const searchRes = await request(app).get('/api/promotions/placements/SEARCH');
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.placement, 'SEARCH');
    assert.ok(Array.isArray(searchRes.body.items));
  });

  await t.test('POST /api/promotions/campaigns creates DRAFT campaign for verified owner', async () => {
    const res = await request(app)
      .post('/api/promotions/campaigns')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        listingId,
        packageId: 'PKG_MULTI_PAGE_7D',
      });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.status, 'DRAFT');
    assert.strictEqual(res.body.campaignType, 'MULTI_PAGE');
    assert.strictEqual(res.body.pointsCost, 1000);
    assert.strictEqual(res.body.durationDays, 7);
    assert.strictEqual(res.body.consentStatus, 'NOT_REQUIRED'); // Owner created for their own property
    createdCampaignId = res.body.id;
  });

  await t.test('GET /api/promotions/campaigns/:id rejects stranger with 403', async () => {
    const res = await request(app)
      .get(`/api/promotions/campaigns/${createdCampaignId}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    assert.strictEqual(res.status, 403);
  });

  await t.test('GET /api/promotions/campaigns/:id returns campaign to authorized owner', async () => {
    const res = await request(app)
      .get(`/api/promotions/campaigns/${createdCampaignId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, createdCampaignId);
    assert.strictEqual(res.body.status, 'DRAFT');
  });

  await t.test('POST /api/promotions/campaigns/:id/submit reserves points atomically', async () => {
    const res = await request(app)
      .post(`/api/promotions/campaigns/${createdCampaignId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ idempotencyKey: `idemp_sub_${runId}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.campaign.status, 'SUBMITTED');
    assert.ok(res.body.campaign.reservationTransactionId);
    assert.strictEqual(res.body.reservation.amount, 1000);
    assert.strictEqual(res.body.reservation.type, 'RESERVED');

    // Verify wallet reservation
    const walletRes = await request(app)
      .get('/api/points/wallet')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.strictEqual(walletRes.body.wallet.reservedPurchasedBalance, 1000);
    assert.strictEqual(walletRes.body.wallet.availablePurchased, 0);
  });

  await t.test('GET /api/promotions/admin/moderation-queue lists submitted campaign', async () => {
    const res = await request(app)
      .get('/api/promotions/admin/moderation-queue')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const item = res.body.find((c: any) => c.id === createdCampaignId);
    assert.ok(item, 'Campaign must appear in admin moderation queue');
    assert.strictEqual(item.status, 'SUBMITTED');
  });

  await t.test('POST /api/promotions/admin/campaigns/:id/approve approves campaign', async () => {
    const res = await request(app)
      .post(`/api/promotions/admin/campaigns/${createdCampaignId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Verified compliance with HomeHub advertising policy' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.campaign.status, 'APPROVED');
    assert.strictEqual(res.body.campaign.moderationDecision, 'APPROVED');
  });

  await t.test('POST /api/promotions/campaigns/:id/activate activates campaign & spends points', async () => {
    const now = new Date();
    const res = await request(app)
      .post(`/api/promotions/campaigns/${createdCampaignId}/activate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ startTime: now.toISOString(), idempotencyKey: `idemp_act_${runId}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.campaign.status, 'ACTIVE');
    assert.ok(res.body.campaign.spendTransactionId);
    assert.ok(res.body.campaign.startTime);
    assert.ok(res.body.campaign.endTime);

    // Verify wallet: reserved points are spent
    const walletRes = await request(app)
      .get('/api/points/wallet')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.strictEqual(walletRes.body.wallet.reservedPurchasedBalance, 0);
    assert.strictEqual(walletRes.body.wallet.purchasedBalance, 0);
    assert.strictEqual(walletRes.body.wallet.availablePurchased, 0);
  });

  await t.test('Dedicated Advertising Placements return activated MULTI_PAGE campaign', async () => {
    // 1. Home Featured dedicated placement
    const homePlacementRes = await request(app).get('/api/promotions/placements/HOMEPAGE');
    assert.strictEqual(homePlacementRes.status, 200);
    assert.ok(homePlacementRes.body.count >= 1);
    const homeItem = homePlacementRes.body.items.find((i: any) => i.campaignId === createdCampaignId);
    assert.ok(homeItem, 'MULTI_PAGE campaign must appear in dedicated HOMEPAGE placement');
    assert.strictEqual(homeItem.listing.id, listingId);
    assert.strictEqual(homeItem.isPromoted, true);
    assert.strictEqual(homeItem.campaignType, 'MULTI_PAGE');

    // 2. Sponsored Search dedicated placement
    const searchPlacementRes = await request(app).get('/api/promotions/placements/SEARCH');
    assert.strictEqual(searchPlacementRes.status, 200);
    assert.ok(searchPlacementRes.body.count >= 1);
    const searchItem = searchPlacementRes.body.items.find((i: any) => i.campaignId === createdCampaignId);
    assert.ok(searchItem, 'MULTI_PAGE campaign must appear in dedicated SEARCH placement');
    assert.strictEqual(searchItem.listing.id, listingId);
    assert.strictEqual(searchItem.isPromoted, true);

    // 3. Marketplace search ranking integration
    const mktSearchRes = await request(app).get('/api/marketplace/listings/search?type=RENT&placement=HOMEPAGE');
    assert.strictEqual(mktSearchRes.status, 200);
    const mktItem = mktSearchRes.body.items.find((i: any) => i.id === listingId);
    assert.ok(mktItem, 'Promoted listing must be in marketplace search results');
    assert.strictEqual(mktItem.isPromoted, true);
  });
});
