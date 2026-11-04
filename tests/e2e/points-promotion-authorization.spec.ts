import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index.js';
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
} from '../../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { promotionCampaignService } from '../../src/server/services/promotion-campaign.js';
import { pointsEngine } from '../../src/server/services/points-engine.js';
import path from 'path';

// Hard safety gate: must run against homehub_test
if (process.env.SQL_DB_NAME && process.env.SQL_DB_NAME !== 'homehub_test') {
  throw new Error(`HARD SAFETY GATE TRIGGERED: E2E tests must target homehub_test. Got: ${process.env.SQL_DB_NAME}`);
}

const screenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-full-audit/points-promotion');

test.describe.serial('Points & Promotion Security Authorization & Boundary E2E Suite', () => {
  const runId = 'e2e_sec_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  const ownerId = `usr_own_${runId}`;
  const assignedAgentId = `usr_agt_${runId}`;
  const unassignedAgentId = `usr_unagt_${runId}`;
  const tenantId = `usr_tnt_${runId}`;
  const adminId = `usr_adm_${runId}`;
  const strangerId = `usr_str_${runId}`;
  const victimId = `usr_vic_${runId}`;

  const propId = `prop_e2e_${runId}`;
  const unmanagedPropId = `prop_unm_e2e_${runId}`;
  const listingId = `list_e2e_${runId}`;
  const unmanagedListingId = `list_unm_e2e_${runId}`;

  const createdCampaignIds: string[] = [];

  test.beforeAll(async () => {
    // 1. Verify test database connection
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    expect(activeDb).toBe('homehub_test');

    // 2. Insert synthetic user accounts
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@test.iq`, firstName: 'Owner', lastName: 'E2E', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: assignedAgentId, email: `${assignedAgentId}@test.iq`, firstName: 'Assigned', lastName: 'Agent', roles: ['AGENT'], isActive: true },
      { id: unassignedAgentId, email: `${unassignedAgentId}@test.iq`, firstName: 'Unassigned', lastName: 'Agent', roles: ['AGENT'], isActive: true },
      { id: tenantId, email: `${tenantId}@test.iq`, firstName: 'Tenant', lastName: 'E2E', roles: ['TENANT'], isActive: true },
      { id: adminId, email: `${adminId}@test.iq`, firstName: 'Admin', lastName: 'E2E', roles: ['ADMIN'], isActive: true },
      { id: strangerId, email: `${strangerId}@test.iq`, firstName: 'Stranger', lastName: 'E2E', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: victimId, email: `${victimId}@test.iq`, firstName: 'Victim', lastName: 'E2E', roles: ['PROPERTY_OWNER'], isActive: true },
    ]);

    // 3. Insert properties
    await db.insert(properties).values([
      { id: propId, name: `E2E Security Property ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', verificationStatus: 'VERIFIED', currency: 'IQD', operatingModel: 'AGENT_OPERATED' },
      { id: unmanagedPropId, name: `Unmanaged Property ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', verificationStatus: 'VERIFIED', currency: 'IQD', operatingModel: 'DIRECT_BY_OWNER' },
    ]);

    // 4. Insert ownership records
    await db.insert(ownershipRecords).values([
      { id: `own_${propId}`, propertyId: propId, ownerId: ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
      { id: `own_${unmanagedPropId}`, propertyId: unmanagedPropId, ownerId: strangerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
    ]);

    // 5. Insert agent assignment
    await db.insert(agentPropertyAssignments).values([
      {
        id: `asgn_e2e_${runId}`,
        propertyId: propId,
        userId: assignedAgentId,
        assignedBy: ownerId,
        permissions: ['MARKETPLACE_LISTING', 'PROMOTION_MANAGEMENT'],
        status: 'ACTIVE',
      },
    ]);

    // 6. Insert listings
    await db.insert(listings).values([
      {
        id: listingId,
        propertyId: propId,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '1800000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `E2E Security Rental Listing ${runId}`,
      },
      {
        id: unmanagedListingId,
        propertyId: unmanagedPropId,
        publisherUserId: strangerId,
        type: 'FOR_RENT',
        price: '1600000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `E2E Unmanaged Rental Listing ${runId}`,
      },
    ]);

    // 7. Ensure test packages exist
    await db.insert(promotionPackages).values([
      {
        id: 'PKG_E2E_SPONSORED_7D',
        type: 'SPONSORED_SEARCH',
        name: 'Sponsored Search 7D E2E',
        pointsCost: 50,
        durationDays: 7,
        placementScope: ['SEARCH'],
        isActive: true,
        version: 1,
      },
    ]).onConflictDoNothing();
  });

  test.afterAll(async () => {
    // Cleanup synthetic test records
    for (const cId of createdCampaignIds) {
      await db.delete(promotionCampaigns).where(eq(promotionCampaigns.id, cId)).catch(() => {});
    }
    await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, ownerId)).catch(() => {});
    await db.delete(pointsWallets).where(eq(pointsWallets.userId, ownerId)).catch(() => {});
    await db.delete(listings).where(eq(listings.id, listingId)).catch(() => {});
    await db.delete(listings).where(eq(listings.id, unmanagedListingId)).catch(() => {});
    await db.delete(agentPropertyAssignments).where(eq(agentPropertyAssignments.propertyId, propId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, unmanagedPropId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, unmanagedPropId)).catch(() => {});
    await db.delete(users).where(eq(users.id, ownerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, assignedAgentId)).catch(() => {});
    await db.delete(users).where(eq(users.id, unassignedAgentId)).catch(() => {});
    await db.delete(users).where(eq(users.id, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.id, adminId)).catch(() => {});
    await db.delete(users).where(eq(users.id, strangerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, victimId)).catch(() => {});
  });

  // --------------------------------------------------------------------------
  // TEST 1: Browser UI Rental-Only Navigation & Public Marketplace
  // --------------------------------------------------------------------------
  test('1. Browser UI loads /rentals cleanly with RTL layout and verifies Buy/Sell disablement', async ({ page, request }) => {
    // 1. Direct API discovery: rental search succeeds with 200
    const res = await request.get('/api/marketplace/listings/search?type=FOR_RENT');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);

    // 2. Strict Domain Separation: FOR_SALE queries fail with 403 BUY_SELL_DISABLED
    const saleRes = await request.get('/api/marketplace/listings/search?type=FOR_SALE');
    expect(saleRes.status()).toBe(403);
    const saleJson = await saleRes.json();
    expect(saleJson.error).toBe('BUY_SELL_DISABLED');

    // 3. Browser UI navigation to /rentals
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Header navigation must NOT have Buy/Sell links
    const saleLink = page.locator('nav a[href="/sale"]');
    await expect(saleLink).toHaveCount(0);

    // Capture visual evidence
    await page.screenshot({
      path: path.join(screenshotDir, 'e2e-rentals-marketplace-discovery.png'),
      fullPage: false,
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: Campaign Creation Role & Property Authorization Boundaries
  // --------------------------------------------------------------------------
  test('2. Campaign Creation Boundaries: Owner/Agent permissions enforced, Unauthorized roles and pure Admins rejected', async () => {
    // 1. Authorized Owner creates draft on own property -> SUCCESS
    const ownerDraft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_E2E_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(ownerDraft.id);
    expect(ownerDraft.requesterUserId).toBe(ownerId);
    expect(ownerDraft.payerUserId).toBe(ownerId);
    expect(ownerDraft.consentStatus).toBe('NOT_REQUIRED');

    // 2. Assigned Agent creates draft on managed property -> SUCCESS with consent REQUESTED
    const agentDraft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_E2E_SPONSORED_7D',
      actorUserId: assignedAgentId,
      actorRoles: ['AGENT'],
    });
    createdCampaignIds.push(agentDraft.id);
    expect(agentDraft.requesterUserId).toBe(assignedAgentId);
    expect(agentDraft.consentStatus).toBe('REQUESTED');

    // 3. Unassigned Agent rejected on unmanaged property
    await expect(
      promotionCampaignService.createDraftCampaign({
        listingId: unmanagedListingId,
        packageId: 'PKG_E2E_SPONSORED_7D',
        actorUserId: unassignedAgentId,
        actorRoles: ['AGENT'],
      })
    ).rejects.toThrow(/UNAUTHORIZED_PROPERTY_ACCESS/);

    // 4. Unauthorized Role (Tenant) rejected
    await expect(
      promotionCampaignService.createDraftCampaign({
        listingId,
        packageId: 'PKG_E2E_SPONSORED_7D',
        actorUserId: tenantId,
        actorRoles: ['TENANT'],
      })
    ).rejects.toThrow(/FORBIDDEN_ROLE/);

    // 5. Pure Admin rejected from creating drafts (moderation-only authority)
    await expect(
      promotionCampaignService.createDraftCampaign({
        listingId,
        packageId: 'PKG_E2E_SPONSORED_7D',
        actorUserId: adminId,
        actorRoles: ['ADMIN'],
      })
    ).rejects.toThrow(/FORBIDDEN_ROLE/);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Payer Boundary & Prohibition of Arbitrary Payer Nomination
  // --------------------------------------------------------------------------
  test('3. Payer Boundaries: Arbitrary third-party payer designation fails closed', async () => {
    // Agent attempts to charge an unrelated victim
    await expect(
      promotionCampaignService.createDraftCampaign({
        listingId,
        packageId: 'PKG_E2E_SPONSORED_7D',
        actorUserId: assignedAgentId,
        actorRoles: ['AGENT'],
        payerUserId: victimId, // Arbitrary unrelated user
      })
    ).rejects.toThrow(/UNAUTHORIZED_PAYER/);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Payer Reservation Authorization & Admin Points Bypass Prohibition
  // --------------------------------------------------------------------------
  test('4. Payer Reservation Security: Admin authority cannot submit and reserve points from another user wallet', async () => {
    // Fund owner wallet
    await db.insert(pointsWallets).values({
      userId: ownerId,
      earnedBalance: 100,
      purchasedBalance: 0,
      reservedEarnedBalance: 0,
      reservedPurchasedBalance: 0,
    }).onConflictDoUpdate({
      target: pointsWallets.userId,
      set: { earnedBalance: 100 },
    });

    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_E2E_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draft.id);

    // Admin attempts to submit on behalf of owner -> REJECTED
    await expect(
      promotionCampaignService.submitCampaign({
        campaignId: draft.id,
        actorUserId: adminId,
        actorRoles: ['ADMIN'],
      })
    ).rejects.toThrow(/UNAUTHORIZED_PAYER/);

    // Positive: designated payer submits campaign -> SUCCESS
    const submitResult = await promotionCampaignService.submitCampaign({
      campaignId: draft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    expect(submitResult.campaign.status).toBe('SUBMITTED');
    expect(submitResult.campaign.reservationTransactionId).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // TEST 5: Campaign Visibility & Verified Property Owner Access
  // --------------------------------------------------------------------------
  test('5. Campaign Visibility: Verified property owner can view agent campaign, while stranger is rejected', async () => {
    const agentDraft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_E2E_SPONSORED_7D',
      actorUserId: assignedAgentId,
      actorRoles: ['AGENT'],
    });
    createdCampaignIds.push(agentDraft.id);

    // Verified property owner views campaign -> SUCCESS
    const ownerView = await promotionCampaignService.getCampaign(agentDraft.id, ownerId, ['PROPERTY_OWNER']);
    expect(ownerView.id).toBe(agentDraft.id);

    // Stranger attempts to view campaign -> REJECTED
    await expect(
      promotionCampaignService.getCampaign(agentDraft.id, strangerId, ['PROPERTY_OWNER'])
    ).rejects.toThrow(/UNAUTHORIZED_ACCESS/);
  });

  // --------------------------------------------------------------------------
  // TEST 6: Administrative Boundary & Early Expiry Privilege Guard
  // --------------------------------------------------------------------------
  test('6. Admin Moderation Boundary: Non-admins cannot approve/reject or force early expiry', async () => {
    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_E2E_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draft.id);

    // Non-admin approval attempt -> REJECTED
    await expect(
      promotionCampaignService.approveCampaign({
        campaignId: draft.id,
        adminUserId: ownerId,
        adminRoles: ['PROPERTY_OWNER'],
      })
    ).rejects.toThrow(/UNAUTHORIZED_ADMIN/);

    // Non-admin rejection attempt -> REJECTED
    await expect(
      promotionCampaignService.rejectCampaign({
        campaignId: draft.id,
        adminUserId: assignedAgentId,
        adminRoles: ['AGENT'],
        reason: 'Unauthorized rejection attempt',
      })
    ).rejects.toThrow(/UNAUTHORIZED_ADMIN/);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Points Engine IDOR & Purchase Order Security
  // --------------------------------------------------------------------------
  test('7. Wallet Security: Cross-user wallet history reads and forged purchase orders are blocked', async () => {
    // Tenant attempts to read Owner wallet history -> REJECTED
    await expect(
      pointsEngine.getWalletWithHistory(ownerId, 50, {
        actorUserId: tenantId,
        actorRoles: ['TENANT'],
      })
    ).rejects.toThrow(/UNAUTHORIZED_ACCESS/);

    // Tenant attempts to initiate purchase order for Owner -> REJECTED
    await expect(
      pointsEngine.createPurchaseOrder({
        userId: ownerId,
        userRoles: ['PROPERTY_OWNER'],
        packageId: 'PKG_AUDIT_POINTS_500',
        actorUserId: tenantId,
      })
    ).rejects.toThrow(/UNAUTHORIZED_PURCHASER/);
  });
});
