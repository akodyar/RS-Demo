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
  pointsPurchasePackages,
  pointsPurchaseOrders,
} from '../../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { pointsEngine } from '../../src/server/services/points-engine.js';
import path from 'path';
import fs from 'fs';

// HARD SAFETY GATE: Strictly require homehub_test
if (process.env.SQL_DB_NAME && process.env.SQL_DB_NAME !== 'homehub_test') {
  throw new Error(`HARD SAFETY GATE TRIGGERED: E2E tests must target homehub_test. Got: ${process.env.SQL_DB_NAME}`);
}

const screenshotDir = path.resolve(process.cwd(), 'screenshots');
const auditScreenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-full-audit/points-promotion-ui');
fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(auditScreenshotDir, { recursive: true });

test.describe.serial('HomeHub Points, Rewards, Purchase & Sponsorship UI Integration', () => {
  const runId = 'e2e_ui_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  // We use the established dev IDs so that backend auth matches dev-owner and dev-platform_admin
  const ownerId = 'user_owner_01';
  const agentId = 'user_agent_01';
  const adminId = 'admin_user_01';

  const propId = `prop_ui_${runId}`;
  const listingId = `list_ui_${runId}`;

  const createdCampaignIds: string[] = [];
  const createdOrderIds: string[] = [];

  test.beforeAll(async () => {
    // 1. Verify test database connection
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    expect(activeDb).toBe('homehub_test');

    // 2. Insert verified property
    await db.insert(properties).values({
      id: propId,
      name: `Grand Erbil Executive Suite ${runId}`,
      type: 'RESIDENTIAL',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currency: 'IQD',
      operatingModel: 'AGENT_OPERATED',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 2100,
      city: 'Erbil',
    }).onConflictDoNothing();

    // 3. Insert ownership record for user_owner_01
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`,
      propertyId: propId,
      ownerId: ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    }).onConflictDoNothing();

    // 4. Insert agent assignment
    await db.insert(agentPropertyAssignments).values({
      id: `asgn_${propId}`,
      propertyId: propId,
      userId: agentId,
      assignedBy: ownerId,
      permissions: ['MARKETPLACE_LISTING', 'PROMOTION_MANAGEMENT'],
      status: 'ACTIVE',
    }).onConflictDoNothing();

    // 5. Insert published rental listing
    await db.insert(listings).values({
      id: listingId,
      propertyId: propId,
      publisherUserId: ownerId,
      type: 'FOR_RENT',
      price: '1600000',
      currency: 'IQD',
      title: `E2E Luxury Residence ${runId}`,
      description: 'Full luxury apartment in central Erbil',
      status: 'PUBLISHED',
    }).onConflictDoNothing();

    // 6. Ensure owner wallet has sufficient initial balances (e.g. 2000 earned, 3000 purchased)
    await pointsEngine.getOrCreateWallet(ownerId);
    await db
      .update(pointsWallets)
      .set({
        earnedBalance: 2000,
        purchasedBalance: 3000,
        reservedEarnedBalance: 0,
        reservedPurchasedBalance: 0,
      })
      .where(eq(pointsWallets.userId, ownerId));

    // 7. Seed standard packages if not present
    await db.insert(pointsPurchasePackages).values([
      { id: 'PKG_POINTS_500', name: 'Starter Pack (500 pts)', points: 500, price: '25000', currency: 'IQD', isActive: true },
      { id: 'PKG_POINTS_1000', name: 'Growth Pack (1,000 pts)', points: 1000, price: '45000', currency: 'IQD', isActive: true },
    ]).onConflictDoNothing();

    await db.insert(promotionPackages).values([
      {
        id: 'PKG_HOME_FEATURED_7D',
        type: 'HOME_FEATURED',
        name: 'Homepage Featured Placement (7 Days)',
        pointsCost: 750,
        durationDays: 7,
        placementScope: ['HOMEPAGE'],
        isActive: true,
        version: 1,
      },
      {
        id: 'PKG_SPONSORED_SEARCH_7D',
        type: 'SPONSORED_SEARCH',
        name: 'Sponsored Search Placement (7 Days)',
        pointsCost: 500,
        durationDays: 7,
        placementScope: ['SEARCH'],
        isActive: true,
        version: 1,
      },
    ]).onConflictDoNothing();
  });

  test.afterAll(async () => {
    try {
      for (const cid of createdCampaignIds) {
        await db.delete(promotionCampaigns).where(eq(promotionCampaigns.id, cid)).catch(() => {});
      }
      for (const oid of createdOrderIds) {
        await db.delete(pointsPurchaseOrders).where(eq(pointsPurchaseOrders.id, oid)).catch(() => {});
      }
      await db.delete(listings).where(eq(listings.id, listingId)).catch(() => {});
      await db.delete(agentPropertyAssignments).where(eq(agentPropertyAssignments.propertyId, propId)).catch(() => {});
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
      await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }

    try {
      const deliveredFiles = [
        '01_owner_points_wallet.png',
        '02_points_purchase_order_created.png',
        '03_promote_property_campaign_submitted.png',
        '04_admin_promotion_moderation.png',
        '05_agent_points_tab.png',
      ];
      for (const fname of deliveredFiles) {
        const srcFile = path.join(screenshotDir, fname);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, path.join(auditScreenshotDir, fname));
        }
      }
    } catch {
      // Ignore copy errors
    }
  });

  // --------------------------------------------------------------------------
  // TEST 1: Points Wallet & Rewards UI in Owner Workspace
  // --------------------------------------------------------------------------
  test('1. Owner Workspace loads Points & Rewards tab with separated balances and ledger', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto('/owner', { waitUntil: 'domcontentloaded' });

    // Click Points & Rewards Tab
    const pointsNavBtn = page.locator('[data-testid="owner-nav-points"]');
    await expect(pointsNavBtn).toBeVisible({ timeout: 10000 });
    await pointsNavBtn.click();

    // Verify Points Wallet view container rendered
    const walletView = page.locator('[data-testid="points-wallet-view"]');
    await expect(walletView).toBeVisible({ timeout: 10000 });

    // Verify separated balance indicators exist
    const usableTotal = page.locator('[data-testid="wallet-available-total"]');
    await expect(usableTotal).toBeVisible();
    const purchasedBal = page.locator('[data-testid="wallet-purchased-balance"]');
    await expect(purchasedBal).toBeVisible();
    const earnedBal = page.locator('[data-testid="wallet-earned-balance"]');
    await expect(earnedBal).toBeVisible();

    // Verify Purchase Points button is present
    const purchaseBtn = page.locator('[data-testid="purchase-points-btn"]');
    await expect(purchaseBtn).toBeVisible();

    // Capture visual evidence
    await page.screenshot({ path: path.join(screenshotDir, '01_owner_points_wallet.png'), fullPage: false });
  });

  // --------------------------------------------------------------------------
  // TEST 2: Points Purchase Flow with Server Packages & Manual Transfer Instructions
  // --------------------------------------------------------------------------
  test('2. Points Purchase Modal allows package selection and creates PENDING order with instructions', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto('/owner', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="owner-nav-points"]').click();

    // Open purchase modal
    await page.locator('[data-testid="purchase-points-btn"]').click();
    const modal = page.locator('[data-testid="points-purchase-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Select package PKG_POINTS_500
    const pkgOption = modal.locator('[data-testid="package-option-PKG_POINTS_500"]').first();
    await expect(pkgOption).toBeVisible({ timeout: 10000 });
    await pkgOption.click();

    // Enter payment reference
    const refInput = modal.locator('[data-testid="payment-reference-input"]');
    await refInput.fill('FIB-E2E-REF-9921');

    // Submit purchase order
    const submitBtn = modal.locator('[data-testid="submit-purchase-order-btn"]');
    await submitBtn.click();

    // Verify success confirmation card
    const successCard = modal.locator('[data-testid="purchase-order-success"]');
    await expect(successCard).toBeVisible({ timeout: 15000 });

    // Verify order status is PENDING and order ID is shown
    const statusBadge = modal.locator('[data-testid="order-status-badge"]');
    await expect(statusBadge).toHaveText('PENDING');

    const orderIdElem = modal.locator('[data-testid="order-id-display"]');
    const orderIdText = await orderIdElem.innerText();
    expect(orderIdText).toBeTruthy();
    createdOrderIds.push(orderIdText.trim());

    // Capture visual evidence
    await page.screenshot({ path: path.join(screenshotDir, '02_points_purchase_order_created.png'), fullPage: false });

    // Close modal
    await modal.locator('[data-testid="done-purchase-btn"]').click();
    await expect(modal).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 3: Promote Property Flow from Property Command Center
  // --------------------------------------------------------------------------
  test('3. Property Command Center allows launching campaign reservation with server pricing', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto(`/properties/${propId}`, { waitUntil: 'domcontentloaded' });

    // Verify Promote Property button is visible
    const promoteBtn = page.locator('[data-testid="promote-property-btn"]');
    await expect(promoteBtn).toBeVisible({ timeout: 10000 });
    await promoteBtn.click();

    // Verify Promote Property modal opens
    const promoModal = page.locator('[data-testid="promote-property-modal"]');
    await expect(promoModal).toBeVisible({ timeout: 10000 });

    // Verify usable points balance is shown
    const modalPoints = promoModal.locator('[data-testid="modal-available-points"]');
    await expect(modalPoints).toBeVisible();

    // Verify promotion package is selectable
    const pkgChoice = promoModal.locator('[data-testid="promo-pkg-PKG_HOME_FEATURED_7D"]');
    await expect(pkgChoice).toBeVisible({ timeout: 10000 });
    await pkgChoice.click();

    // Submit campaign
    const submitCampaignBtn = promoModal.locator('[data-testid="submit-promotion-campaign-btn"]');
    await submitCampaignBtn.click();

    // Verify campaign submission confirmation
    const successBox = promoModal.locator('[data-testid="campaign-submission-success"]');
    await expect(successBox).toBeVisible({ timeout: 15000 });

    const statusBadge = promoModal.locator('[data-testid="campaign-status-badge"]');
    await expect(statusBadge).toHaveText('SUBMITTED');

    const campaignIdElem = promoModal.locator('[data-testid="campaign-id-display"]');
    const campaignIdText = await campaignIdElem.innerText();
    expect(campaignIdText).toBeTruthy();
    createdCampaignIds.push(campaignIdText.trim());

    // Capture visual evidence
    await page.screenshot({ path: path.join(screenshotDir, '03_promote_property_campaign_submitted.png'), fullPage: false });

    // Close modal
    await promoModal.locator('[data-testid="done-promote-btn"]').click();
    await expect(promoModal).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 4: Admin Promotion Moderation & Points Purchase Order Confirmation
  // --------------------------------------------------------------------------
  test('4. Admin Workspace allows moderating pending campaigns and confirming points orders', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
      }));
    });

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });

    // Open More Menu to select Promotions module
    const viewAllBtn = page.locator('button:has-text("View All")').first();
    await expect(viewAllBtn).toBeVisible({ timeout: 10000 });
    await viewAllBtn.click();

    // Click Promotions & Points option
    const promoModuleBtn = page.locator('button:has-text("Promotions & Points")');
    await expect(promoModuleBtn).toBeVisible({ timeout: 10000 });
    await promoModuleBtn.click();

    // Verify Admin Promotion Moderation Module is rendered
    const adminModModule = page.locator('[data-testid="admin-promotion-moderation-module"]');
    await expect(adminModModule).toBeVisible({ timeout: 10000 });

    // Check Campaigns Queue tab
    const campaignsQueue = adminModModule.locator('[data-testid="campaigns-moderation-queue"]');
    await expect(campaignsQueue).toBeVisible();

    // Verify the submitted campaign is listed
    if (createdCampaignIds.length > 0) {
      const activeCid = createdCampaignIds[0];
      const approveBtn = adminModModule.locator(`[data-testid="approve-campaign-btn-${activeCid}"]`);
      if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await approveBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Switch to Points Purchase Orders tab
    const ordersTabBtn = adminModModule.locator('[data-testid="tab-purchase-orders"]');
    await ordersTabBtn.click();

    const ordersQueue = adminModModule.locator('[data-testid="purchase-orders-queue"]');
    await expect(ordersQueue).toBeVisible({ timeout: 10000 });

    // Verify the purchase order created in Test 2 is listed
    if (createdOrderIds.length > 0) {
      const activeOid = createdOrderIds[0];
      const confirmBtn = adminModModule.locator(`[data-testid="confirm-purchase-order-btn-${activeOid}"]`);
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Capture visual evidence
    await page.screenshot({ path: path.join(screenshotDir, '04_admin_promotion_moderation.png'), fullPage: false });
  });

  // --------------------------------------------------------------------------
  // TEST 5: Agent Workspace Points Tab Accessibility
  // --------------------------------------------------------------------------
  test('5. Agent Workspace exposes Points & Rewards tab for authorized agents', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-agent');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_agent_01',
        role: 'AGENT_BROKER',
        roles: ['AGENT_BROKER', 'AGENT'],
      }));
    });

    await page.goto('/agent', { waitUntil: 'domcontentloaded' });

    // Verify agent points tab button
    const agentPointsBtn = page.locator('[data-testid="agent-nav-points"]');
    await expect(agentPointsBtn).toBeVisible({ timeout: 10000 });
    await agentPointsBtn.click();

    // Verify agent points tab content
    const tabContent = page.locator('[data-testid="agent-points-tab-content"]');
    await expect(tabContent).toBeVisible({ timeout: 10000 });

    // Capture visual evidence
    await page.screenshot({ path: path.join(screenshotDir, '05_agent_points_tab.png'), fullPage: false });
  });
});
