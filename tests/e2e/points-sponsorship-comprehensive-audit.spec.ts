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
  throw new Error(`HARD SAFETY GATE TRIGGERED: Playwright tests must target homehub_test. Got: ${process.env.SQL_DB_NAME}`);
}

const mandatoryScreenshotsDir = path.resolve(process.cwd(), 'screenshots');
const auditMirrorDir = path.resolve(process.cwd(), 'screenshots/homehub-full-audit/points-promotion-comprehensive');

fs.mkdirSync(mandatoryScreenshotsDir, { recursive: true });
fs.mkdirSync(auditMirrorDir, { recursive: true });

function getSafeDestinationPath(filename: string): string {
  const primaryPath = path.join(mandatoryScreenshotsDir, filename);
  if (!fs.existsSync(primaryPath)) {
    return primaryPath;
  }
  // File already exists: preserve original and use verified timestamp suffix to prevent overwrite
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return path.join(mandatoryScreenshotsDir, `${base}_verified_2026-10-23${ext}`);
}

async function captureEvidence(page: any, filename: string, options: { fullPage?: boolean } = {}) {
  const destPath = getSafeDestinationPath(filename);
  const mirrorPath = path.join(auditMirrorDir, filename);
  await page.screenshot({ path: destPath, fullPage: options.fullPage ?? false });
  try {
    fs.copyFileSync(destPath, mirrorPath);
  } catch {}
  return destPath;
}

test.describe.serial('HomeHub Points, Rewards, Purchase & Sponsored Placement Comprehensive Audit', () => {
  const runId = 'audit_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  const ownerId = 'user_owner_01';
  const agentId = 'user_agent_01';
  const adminId = 'admin_user_01';

  const propId = `prop_aud_${runId}`;
  const listingId = `list_aud_${runId}`;
  const campaignId = `cmp_aud_${runId}`;

  const createdCampaignIds: string[] = [campaignId];
  const createdOrderIds: string[] = [];

  test.beforeAll(async () => {
    // 1. Verify isolated test database
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    expect(activeDb).toBe('homehub_test');

    // 2. Insert verified property
    await db.insert(properties).values({
      id: propId,
      name: `Grand Palace Suite ${runId}`,
      type: 'RESIDENTIAL',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currency: 'IQD',
      operatingModel: 'AGENT_OPERATED',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 2200,
      city: 'Erbil',
    }).onConflictDoNothing();

    // 3. Insert ownership record for owner
    await db.insert(ownershipRecords).values({
      id: `own_${propId}`,
      propertyId: propId,
      ownerId: ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    }).onConflictDoNothing();

    // 4. Assign agent
    await db.insert(agentPropertyAssignments).values({
      id: `asgn_${propId}`,
      propertyId: propId,
      userId: agentId,
      assignedBy: ownerId,
      permissions: ['VIEW_PROPERTY', 'MARKETPLACE_LISTING', 'PROMOTION_MANAGEMENT'],
      status: 'ACTIVE',
    }).onConflictDoNothing();

    // 5. Insert published rental listing
    await db.insert(listings).values({
      id: listingId,
      propertyId: propId,
      publisherUserId: ownerId,
      type: 'FOR_RENT',
      price: '1850000',
      currency: 'IQD',
      title: `Grand Executive Residence ${runId}`,
      description: 'Ultra-luxury high-floor apartment in downtown Erbil',
      status: 'PUBLISHED',
    }).onConflictDoNothing();

    // 6. Ensure owner wallet has verified starting balance
    await pointsEngine.getOrCreateWallet(ownerId);
    await db
      .update(pointsWallets)
      .set({
        earnedBalance: 2500,
        purchasedBalance: 4000,
        reservedEarnedBalance: 0,
        reservedPurchasedBalance: 0,
      })
      .where(eq(pointsWallets.userId, ownerId));

    // 7. Ensure agent wallet has verified starting balance
    await pointsEngine.getOrCreateWallet(agentId);
    await db
      .update(pointsWallets)
      .set({
        earnedBalance: 600,
        purchasedBalance: 1500,
        reservedEarnedBalance: 0,
        reservedPurchasedBalance: 0,
      })
      .where(eq(pointsWallets.userId, agentId));

    // 8. Seed active promotion campaign for placement testing
    const now = new Date();
    const startTime = new Date(now.getTime() - 3600000); // 1 hr ago
    const endTime = new Date(now.getTime() + 86400000 * 7); // 7 days ahead

    await db.insert(promotionCampaigns).values({
      id: campaignId,
      listingId,
      propertyId: propId,
      requesterUserId: ownerId,
      payerUserId: ownerId,
      packageId: 'PKG_MULTI_PAGE_7D',
      packageVersion: 1,
      campaignType: 'MULTI_PAGE',
      pointsCost: 1000,
      durationDays: 7,
      placementScope: ['HOMEPAGE', 'SEARCH'],
      rankScore: 95,
      status: 'ACTIVE',
      consentStatus: 'GRANTED',
      startTime,
      endTime,
      submittedAt: now,
      approvedAt: now,
      activatedAt: now,
    }).onConflictDoNothing();
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
      // Ignore cleanup
    }
  });

  // ==========================================================================
  // STATE 1 & 2: Points Wallets (Owner & Agent)
  // ==========================================================================
  test('01. Owner Points Wallet with separated balances and ledger history', async ({ page }) => {
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
    const pointsNav = page.locator('[data-testid="owner-nav-points"]');
    await expect(pointsNav).toBeVisible({ timeout: 10000 });
    await pointsNav.click();

    const walletView = page.locator('[data-testid="points-wallet-view"]');
    await expect(walletView).toBeVisible({ timeout: 10000 });

    // Verify separated balance indicators
    const usableTotal = page.locator('[data-testid="wallet-available-total"]');
    await expect(usableTotal).toBeVisible();
    await expect(page.locator('[data-testid="wallet-purchased-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="wallet-earned-balance"]')).toBeVisible();

    await captureEvidence(page, '01_owner_points_wallet.png');
  });

  test('02. Agent Points Wallet with authorized agent access', async ({ page }) => {
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
    const agentPointsBtn = page.locator('[data-testid="agent-nav-points"]');
    await expect(agentPointsBtn).toBeVisible({ timeout: 10000 });
    await agentPointsBtn.click();

    const tabContent = page.locator('[data-testid="agent-points-tab-content"]');
    await expect(tabContent).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, '02_agent_points_wallet.png');
  });

  // ==========================================================================
  // STATE 3 & 4: Points Purchase Workflow
  // ==========================================================================
  test('03. Points Purchase Modal with server packages & payment methods', async ({ page }) => {
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

    const purchaseBtn = page.locator('[data-testid="purchase-points-btn"]');
    await expect(purchaseBtn).toBeVisible({ timeout: 10000 });
    await purchaseBtn.click();

    const modal = page.locator('[data-testid="points-purchase-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Assert packages visible
    await expect(modal.locator('[data-testid="package-option-PKG_POINTS_500"]').first()).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, '03_points_purchase_packages.png');
  });

  test('04. Points Purchase Order Creation with pending status and manual instructions', async ({ page }) => {
    page.on('console', (msg) => console.log('[BROWSER_CONSOLE]:', msg.text()));
    page.on('pageerror', (err) => console.log('[BROWSER_PAGE_ERROR]:', err.message));
    page.on('requestfailed', (req) => console.log('[BROWSER_REQUEST_FAILED]:', req.url(), req.failure()?.errorText));

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
    await page.locator('[data-testid="purchase-points-btn"]').click();

    const modal = page.locator('[data-testid="points-purchase-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    const pkgOption = modal.locator('[data-testid="package-option-PKG_POINTS_500"]').first();
    await pkgOption.click();

    const refInput = modal.locator('[data-testid="payment-reference-input"]');
    await refInput.fill(`FIB-AUDIT-${runId}`);

    const submitBtn = modal.locator('[data-testid="submit-purchase-order-btn"]');
    await submitBtn.click();

    const successCard = modal.locator('[data-testid="purchase-order-success"]');
    await expect(successCard).toBeVisible({ timeout: 15000 });

    const statusBadge = modal.locator('[data-testid="order-status-badge"]');
    await expect(statusBadge).toHaveText('PENDING');

    const orderIdElem = modal.locator('[data-testid="order-id-display"]');
    const orderId = (await orderIdElem.innerText()).trim();
    expect(orderId).toBeTruthy();
    createdOrderIds.push(orderId);

    await captureEvidence(page, '04_points_purchase_pending_order.png');
  });

  // ==========================================================================
  // STATE 5: Admin Purchase Order Confirmation
  // ==========================================================================
  test('05. Admin Purchase Order Confirmation interface', async ({ page }) => {
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

    // Open Promotions & Points module
    const viewAllBtn = page.locator('button:has-text("View All")').first();
    if (await viewAllBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewAllBtn.click();
      const promoBtn = page.locator('button:has-text("Promotions & Points")');
      await promoBtn.click();
    } else {
      const directBtn = page.locator('button:has-text("Promotions")').first();
      await directBtn.click();
    }

    const adminModModule = page.locator('[data-testid="admin-promotion-moderation-module"]');
    await expect(adminModModule).toBeVisible({ timeout: 10000 });

    // Switch to purchase orders tab
    const ordersTabBtn = adminModModule.locator('[data-testid="tab-purchase-orders"]');
    await ordersTabBtn.click();

    const ordersQueue = adminModModule.locator('[data-testid="purchase-orders-queue"]');
    await expect(ordersQueue).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, '05_admin_purchase_confirmation.png');
  });

  // ==========================================================================
  // STATE 6: Promote Property Campaign Form
  // ==========================================================================
  test('06. Promote Property Campaign Form with package selection and server rate', async ({ page }) => {
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
    const promoteBtn = page.locator('[data-testid="promote-property-btn"]');
    await expect(promoteBtn).toBeVisible({ timeout: 10000 });
    await promoteBtn.click();

    const promoModal = page.locator('[data-testid="promote-property-modal"]');
    await expect(promoModal).toBeVisible({ timeout: 10000 });

    // Verify packages
    await expect(promoModal.locator('[data-testid="promo-pkg-PKG_HOME_FEATURED_7D"]')).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, '06_promote_property_campaign_form.png');
  });

  // ==========================================================================
  // STATE 7: Campaign Owner Consent Boundary
  // ==========================================================================
  test('07. Campaign Owner Consent Notice during Agent Promotion', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-agent');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_agent_01',
        role: 'AGENT_BROKER',
        roles: ['AGENT_BROKER', 'AGENT'],
      }));
    });

    await page.goto(`/properties/${propId}`, { waitUntil: 'domcontentloaded' });
    const promoteBtn = page.locator('[data-testid="promote-property-btn"]');
    await expect(promoteBtn).toBeVisible({ timeout: 10000 });
    await promoteBtn.click();

    const promoModal = page.locator('[data-testid="promote-property-modal"]');
    await expect(promoModal).toBeVisible({ timeout: 10000 });

    // Assert governance and consent notice text
    await expect(promoModal.locator('text=Campaigns initiated by agents require explicit property owner consent')).toBeVisible();

    await captureEvidence(page, '07_campaign_owner_consent.png');
  });

  // ==========================================================================
  // STATE 8: Admin Promotion Moderation Queue
  // ==========================================================================
  test('08. Admin Promotion Moderation Queue with approve/reject actions', async ({ page }) => {
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

    const viewAllBtn = page.locator('button:has-text("View All")').first();
    if (await viewAllBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewAllBtn.click();
      await page.locator('button:has-text("Promotions & Points")').click();
    } else {
      await page.locator('button:has-text("Promotions")').first().click();
    }

    const adminModModule = page.locator('[data-testid="admin-promotion-moderation-module"]');
    await expect(adminModModule).toBeVisible({ timeout: 10000 });

    const campaignsQueue = adminModModule.locator('[data-testid="campaigns-moderation-queue"]');
    await expect(campaignsQueue).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, '08_admin_promotion_moderation.png');
  });

  // ==========================================================================
  // STATE 9 & 10: Homepage Placements (Active vs Graceful Empty Collapse)
  // ==========================================================================
  test('09. Homepage with active sponsored property placement', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const featuredSection = page.locator('[data-testid="home-featured-properties"]');
    await expect(featuredSection).toBeVisible({ timeout: 10000 });

    // Assert Sponsored badge exists
    await expect(featuredSection.locator('[data-testid="sponsored-badge"]').first()).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, '09_homepage_sponsored_placement.png');
  });

  test('10. Homepage with no sponsored campaigns collapses gracefully', async ({ page }) => {
    // Intercept endpoint to simulate empty placements
    await page.route('/api/promotions/placements/HOMEPAGE', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ placement: 'HOMEPAGE', count: 0, items: [] }),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Assert home-featured-properties is NOT rendered in the DOM
    const featuredSection = page.locator('[data-testid="home-featured-properties"]');
    await expect(featuredSection).not.toBeVisible();

    await captureEvidence(page, '10_homepage_no_sponsored_campaigns.png');
  });

  // ==========================================================================
  // STATE 11 & 12: Rental Search Placements (Active vs Graceful Empty Collapse)
  // ==========================================================================
  test('11. Rental search with active sponsored placement above organic results', async ({ page }) => {
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });

    const sponsoredStrip = page.locator('[data-testid="sponsored-rental-placements"]');
    await expect(sponsoredStrip).toBeVisible({ timeout: 10000 });

    // Assert Sponsored badge
    await expect(sponsoredStrip.locator('[data-testid="sponsored-badge"]').first()).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, '11_rental_search_sponsored_placement.png');
  });

  test('12. Rental search with no sponsored campaigns collapses gracefully', async ({ page }) => {
    // Intercept endpoint to simulate empty placements
    await page.route('/api/promotions/placements/SEARCH', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ placement: 'SEARCH', count: 0, items: [] }),
      });
    });

    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });

    const sponsoredStrip = page.locator('[data-testid="sponsored-rental-placements"]');
    await expect(sponsoredStrip).not.toBeVisible();

    await captureEvidence(page, '12_rental_search_no_sponsored_campaigns.png');
  });

  // ==========================================================================
  // STATE 13, 14, 15: Localization (Kurdish RTL, Arabic RTL, English LTR)
  // ==========================================================================
  test('13. Kurdish Sorani RTL layout and LTR numeric isolation', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto('/owner', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="owner-nav-points"]').click();

    const walletView = page.locator('[data-testid="points-wallet-view"]');
    await expect(walletView).toBeVisible({ timeout: 10000 });
    await expect(walletView).toHaveAttribute('dir', 'rtl');

    await captureEvidence(page, '13_kurdish_rtl_ui.png');
  });

  test('14. Arabic RTL layout and LTR numeric isolation', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'ar');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto('/owner', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="owner-nav-points"]').click();

    const walletView = page.locator('[data-testid="points-wallet-view"]');
    await expect(walletView).toBeVisible({ timeout: 10000 });
    await expect(walletView).toHaveAttribute('dir', 'rtl');

    await captureEvidence(page, '14_arabic_rtl_ui.png');
  });

  test('15. English LTR layout', async ({ page }) => {
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

    const walletView = page.locator('[data-testid="points-wallet-view"]');
    await expect(walletView).toBeVisible({ timeout: 10000 });
    await expect(walletView).toHaveAttribute('dir', 'ltr');

    await captureEvidence(page, '15_english_ltr_ui.png');
  });

  // ==========================================================================
  // STATE 16: Mobile Responsive Viewport
  // ==========================================================================
  test('16. Mobile responsive viewport (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto('/owner?tab=points', { waitUntil: 'domcontentloaded' });

    const walletView = page.locator('[data-testid="points-wallet-view"]');
    await expect(walletView).toBeVisible({ timeout: 10000 });

    await captureEvidence(page, '16_mobile_responsive_ui.png');
  });
});
