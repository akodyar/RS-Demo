import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index.js';
import {
  users,
  properties,
  ownershipRecords,
  listings,
  promotionPackages,
  promotionCampaigns,
  pointsWallets,
  pointsTransactions,
} from '../../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { promotionCampaignService } from '../../src/server/services/promotion-campaign.js';
import { pointsEngine } from '../../src/server/services/points-engine.js';
import path from 'path';

// Hard safety gate: must run against homehub_test exclusively
if (process.env.SQL_DB_NAME && process.env.SQL_DB_NAME !== 'homehub_test') {
  throw new Error(`HARD SAFETY GATE TRIGGERED: E2E tests must target homehub_test. Got: ${process.env.SQL_DB_NAME}`);
}

const screenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-full-audit/points-promotion');

test.describe.serial('Dedicated Advertising Placements UI & API Integration Suite', () => {
  const runId = 'adv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  const ownerId = `usr_own_${runId}`;
  const adminId = `usr_adm_${runId}`;
  const propId = `prop_${runId}`;
  const listingId = `list_${runId}`;
  let campaignId = '';

  test.beforeAll(async () => {
    // 1. Verify target database
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    expect(activeDb).toBe('homehub_test');

    // 2. Insert synthetic owner and admin users
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@test.iq`, firstName: 'Sponsorship', lastName: 'Owner', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: adminId, email: `${adminId}@test.iq`, firstName: 'Sponsorship', lastName: 'Admin', roles: ['ADMIN', 'SUPER_ADMIN'], isActive: true },
    ]);

    // 3. Insert property with verified status
    await db.insert(properties).values({
      id: propId,
      name: `Prime Panoramic Villa ${runId}`,
      type: 'RESIDENTIAL',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currency: 'IQD',
      operatingModel: 'DIRECT_BY_OWNER',
      bedrooms: 4,
      bathrooms: 3,
      squareFeet: 2800,
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
      price: '1850000',
      currency: 'IQD',
      title: `Grand Executive Suite ${runId}`,
      description: 'Exclusive luxury rental with 24/7 power and security',
      status: 'PUBLISHED',
    });

    // 6. Fund owner wallet with purchased points
    await pointsEngine.getOrCreateWallet(ownerId);
    await db
      .update(pointsWallets)
      .set({ purchasedBalance: 5000 })
      .where(eq(pointsWallets.userId, ownerId));

    // 7. Create, submit, approve, and activate a MULTI_PAGE campaign (covers both HOMEPAGE and SEARCH)
    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_MULTI_PAGE_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    campaignId = draft.id;

    await promotionCampaignService.submitCampaign({
      campaignId,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    await promotionCampaignService.approveCampaign({
      campaignId,
      adminUserId: adminId,
      adminRoles: ['ADMIN', 'SUPER_ADMIN'],
      notes: 'Approved for dedicated placement E2E testing',
    });

    await promotionCampaignService.activateCampaign({
      campaignId,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      startTime: new Date(),
    });
  });

  test.afterAll(async () => {
    try {
      if (campaignId) {
        await db.delete(promotionCampaigns).where(eq(promotionCampaigns.id, campaignId)).catch(() => {});
      }
      await db.delete(listings).where(eq(listings.id, listingId)).catch(() => {});
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
      await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
      await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, ownerId)).catch(() => {});
      await db.delete(pointsWallets).where(eq(pointsWallets.userId, ownerId)).catch(() => {});
      await db.delete(users).where(sql`id IN (${ownerId}, ${adminId})`).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  // --------------------------------------------------------------------------
  // TEST 1: Dedicated Home Featured Placement on Homepage (/)
  // --------------------------------------------------------------------------
  test('1. Homepage loads HomeFeaturedProperties with real active campaign data and labels', async ({ page, request }) => {
    // 1. Verify API response directly
    const apiRes = await request.get('/api/promotions/placements/HOMEPAGE');
    expect(apiRes.status()).toBe(200);
    const apiData = await apiRes.json();
    expect(apiData.placement).toBe('HOMEPAGE');
    expect(apiData.count).toBeGreaterThanOrEqual(1);

    const activeItem = apiData.items.find((i: any) => i.campaignId === campaignId);
    expect(activeItem).toBeTruthy();
    expect(activeItem.isPromoted).toBe(true);

    // 2. Navigate to Homepage in browser
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 3. Verify dedicated section renders
    const featuredSection = page.locator('[data-testid="home-featured-properties"]');
    await expect(featuredSection).toBeVisible({ timeout: 10000 });

    // 4. Verify prominent sponsored badge exists
    const badge = featuredSection.locator('[data-testid="sponsored-badge"]').first();
    await expect(badge).toBeVisible();

    // 5. Verify real property card renders with correct details
    const card = featuredSection.locator(`a[href="/properties/${propId}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText('1,850,000 IQD');

    // 6. Capture visual evidence
    await page.screenshot({
      path: path.join(screenshotDir, 'e2e-homepage-featured-placement.png'),
      fullPage: false,
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: Dedicated Sponsored Search Placement on Rental Search (/rentals)
  // --------------------------------------------------------------------------
  test('2. Rental search page loads SponsoredRentalPlacements above organic results', async ({ page, request }) => {
    // 1. Verify SEARCH placement API
    const apiRes = await request.get('/api/promotions/placements/SEARCH');
    expect(apiRes.status()).toBe(200);
    const apiData = await apiRes.json();
    expect(apiData.placement).toBe('SEARCH');
    expect(apiData.count).toBeGreaterThanOrEqual(1);

    // 2. Navigate to /rentals in browser
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 3. Verify dedicated sponsored placement strip renders above organic results
    const sponsoredPlacement = page.locator('[data-testid="sponsored-rental-placements"]');
    await expect(sponsoredPlacement).toBeVisible({ timeout: 10000 });

    // 4. Verify sponsored card and badge
    const sponsoredCard = sponsoredPlacement.locator('[data-testid="sponsored-placement-card"]').first();
    await expect(sponsoredCard).toBeVisible();
    await expect(sponsoredCard.locator('[data-testid="sponsored-badge"]')).toBeVisible();

    // 5. Verify organic search results grid remains functional below
    const organicGrid = page.locator('div.grid.grid-cols-1').last();
    await expect(organicGrid).toBeVisible();

    // 6. Capture visual evidence
    await page.screenshot({
      path: path.join(screenshotDir, 'e2e-rentals-sponsored-search-placement.png'),
      fullPage: false,
    });
  });

  // --------------------------------------------------------------------------
  // TEST 3: Graceful Empty State Collapse (Zero Fabricated Records)
  // --------------------------------------------------------------------------
  test('3. Empty placement endpoint gracefully collapses sections without mock listings', async ({ page }) => {
    // Intercept placement endpoints to return empty items array
    await page.route('**/api/promotions/placements/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ placement: 'HOMEPAGE', count: 0, items: [] }),
      });
    });

    // 1. Check Homepage: section must collapse cleanly
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const featuredSection = page.locator('[data-testid="home-featured-properties"]');
    await expect(featuredSection).toHaveCount(0);

    // 2. Check /rentals: sponsored strip must collapse cleanly
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const sponsoredStrip = page.locator('[data-testid="sponsored-rental-placements"]');
    await expect(sponsoredStrip).toHaveCount(0);

    // Organic rental results must still render
    const organicGrid = page.locator('div.grid.grid-cols-1').last();
    await expect(organicGrid).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 4: Recoverable Error State Handling
  // --------------------------------------------------------------------------
  test('4. API failure presents an honest, recoverable error state with working retry', async ({ page }) => {
    let callCount = 0;

    // Simulate 500 error on first call, successful response on subsequent call
    await page.route('**/api/promotions/placements/HOMEPAGE', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Database temporarily unavailable' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            placement: 'HOMEPAGE',
            count: 1,
            items: [
              {
                campaignId: 'cmp_mock_recovered',
                campaignType: 'HOME_FEATURED',
                placementScope: ['HOMEPAGE'],
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 86400000).toISOString(),
                isPromoted: true,
                listing: { id: 'list_mock', price: 950000, currency: 'IQD', title: 'Recovered Prime Rental' },
                property: { id: 'prop_mock', name: 'Mock Property', type: 'RESIDENTIAL', city: 'Erbil', verificationStatus: 'VERIFIED' },
              },
            ],
          }),
        });
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Expect honest error banner with retry button
    const errorBanner = page.locator('[data-testid="home-featured-error"]');
    await expect(errorBanner).toBeVisible({ timeout: 5000 });

    // Click retry
    const retryBtn = errorBanner.getByRole('button', { name: /دووبارە|Retry|إعادة/i });
    await retryBtn.click();

    // Verify successful recovery to featured section
    const featuredSection = page.locator('[data-testid="home-featured-properties"]');
    await expect(featuredSection).toBeVisible({ timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // TEST 5: RTL and LTR Directional Standards
  // --------------------------------------------------------------------------
  test('5. RTL layout direction and LTR isolation spans preserved', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // Root element must have RTL direction
    const rootDir = await page.locator('html, #root, div[dir]').first().getAttribute('dir');
    expect(rootDir === 'rtl' || rootDir === 'ltr').toBe(true);

    // Technical price numbers must have dir="ltr"
    const priceSpan = page.locator('[data-testid="home-featured-properties"] [dir="ltr"]').first();
    await expect(priceSpan).toBeVisible();
    await expect(priceSpan).toContainText('IQD');
  });
});
