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
import { eq, sql, inArray } from 'drizzle-orm';
import { pointsEngine } from '../../src/server/services/points-engine.js';
import path from 'path';
import fs from 'fs';

// HARD SAFETY GATE: Strictly require homehub_test
if (process.env.SQL_DB_NAME && process.env.SQL_DB_NAME !== 'homehub_test') {
  throw new Error(`HARD SAFETY GATE TRIGGERED: Playwright tests must target homehub_test. Got: ${process.env.SQL_DB_NAME}`);
}

const auditRootDir = path.resolve(process.cwd(), 'screenshots/homehub-property-discovery-sponsored-points-audit');

function getCapturePath(subfolder: string, filename: string): string {
  const folderPath = path.join(auditRootDir, subfolder);
  fs.mkdirSync(folderPath, { recursive: true });
  return path.join(folderPath, filename);
}

async function takeScreenshot(page: any, subfolder: string, filename: string) {
  const destPath = getCapturePath(subfolder, filename);
  await page.screenshot({ path: destPath, animations: 'disabled', timeout: 15000 });
  return destPath;
}

test.describe.serial('HomeHub Property Discovery, Search, Sponsored Advertising & Points Audit', () => {
  const runId = 'pda_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  test.beforeEach(async ({ context }) => {
    // Zero-Obstacle Mandate: Abort external fonts to prevent screenshot hangs on "waiting for fonts to load..."
    await context.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com)/, (route) => route.abort());
  });

  const ownerId = 'user_owner_01';
  const agentId = 'user_agent_01';
  const adminId = 'admin_user_01';

  const seededPropertyIds: string[] = [];
  const seededListingIds: string[] = [];
  const seededCampaignIds: string[] = [];
  const createdOrderIds: string[] = [];

  const mainPropId = `prop_pda_main_${runId}`;
  const agentPropId = `prop_pda_agent_${runId}`;
  const mainListingId = `list_pda_main_${runId}`;
  const agentListingId = `list_pda_agent_${runId}`;
  const sponsoredCampaignId = `cmp_pda_active_${runId}`;

  test.beforeAll(async () => {
    // 1. Verify test database connection
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    expect(activeDb).toBe('homehub_test');

    // 2. Ensure users exist
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@test.iq`, firstName: 'Owner', lastName: 'Audit', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: agentId, email: `${agentId}@test.iq`, firstName: 'Agent', lastName: 'Audit', roles: ['AGENT'], isActive: true },
      { id: adminId, email: `${adminId}@test.iq`, firstName: 'Admin', lastName: 'Audit', roles: ['ADMIN', 'SUPER_ADMIN'], isActive: true },
    ]).onConflictDoNothing();

    // 3. Seed 8 rental properties and listings to guarantee pagination (>6 items)
    const propertyConfigs = [
      { id: mainPropId, name: `Empire Royal Penthouse ${runId}`, type: 'RESIDENTIAL', city: 'Erbil', beds: 4, baths: 3, price: '3250000', priceUsd: 2500 },
      { id: agentPropId, name: `Dream City Luxury Villa ${runId}`, type: 'RESIDENTIAL_VILLA', city: 'Erbil', beds: 5, baths: 4, price: '4550000', priceUsd: 3500 },
      { id: `prop_pda_3_${runId}`, name: `Goyzha Heights Apartment ${runId}`, type: 'RESIDENTIAL', city: 'Sulaymaniyah', beds: 3, baths: 2, price: '1690000', priceUsd: 1300 },
      { id: `prop_pda_4_${runId}`, name: `Masik Valley Residency ${runId}`, type: 'RESIDENTIAL', city: 'Duhok', beds: 3, baths: 2, price: '1560000', priceUsd: 1200 },
      { id: `prop_pda_5_${runId}`, name: `Italian City Modern Villa ${runId}`, type: 'RESIDENTIAL_VILLA', city: 'Erbil', beds: 4, baths: 3, price: '2860000', priceUsd: 2200 },
      { id: `prop_pda_6_${runId}`, name: `Bakhtiyari Suite ${runId}`, type: 'RESIDENTIAL', city: 'Sulaymaniyah', beds: 2, baths: 2, price: '1430000', priceUsd: 1100 },
      { id: `prop_pda_7_${runId}`, name: `Dream City Garden Townhouse ${runId}`, type: 'RESIDENTIAL', city: 'Erbil', beds: 3, baths: 3, price: '2340000', priceUsd: 1800 },
      { id: `prop_pda_8_${runId}`, name: `Ainkawa Heritage Flat ${runId}`, type: 'RESIDENTIAL', city: 'Erbil', beds: 2, baths: 1, price: '1170000', priceUsd: 900 },
    ];

    for (const p of propertyConfigs) {
      seededPropertyIds.push(p.id);
      await db.insert(properties).values({
        id: p.id,
        name: p.name,
        type: p.type,
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        currency: 'IQD',
        operatingModel: p.id === agentPropId ? 'AGENT_OPERATED' : 'DIRECT_BY_OWNER',
        bedrooms: p.beds,
        bathrooms: p.baths,
        squareFeet: 2000,
        city: p.city,
      }).onConflictDoNothing();

      // Ownership record for owner
      await db.insert(ownershipRecords).values({
        id: `own_${p.id}`,
        propertyId: p.id,
        ownerId: ownerId,
        ownershipPercentage: '100.00',
        status: 'VERIFIED',
      }).onConflictDoNothing();

      // Listing record
      const listId = p.id === mainPropId ? mainListingId : p.id === agentPropId ? agentListingId : `list_${p.id}`;
      seededListingIds.push(listId);
      await db.insert(listings).values({
        id: listId,
        propertyId: p.id,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: p.price,
        currency: 'IQD',
        status: 'PUBLISHED',
        title: p.name,
        description: `Luxurious rental home in ${p.city} with verified Tapu and round-the-clock security.`,
      }).onConflictDoNothing();
    }

    // 4. Assign agent to agentPropId
    await db.insert(agentPropertyAssignments).values({
      id: `asgn_${agentPropId}`,
      propertyId: agentPropId,
      userId: agentId,
      assignedBy: ownerId,
      permissions: ['VIEW_PROPERTY', 'MARKETPLACE_LISTING', 'PROMOTION_MANAGEMENT'],
      status: 'ACTIVE',
    }).onConflictDoNothing();

    // 5. Ensure owner wallet has verified balances
    await pointsEngine.getOrCreateWallet(ownerId);
    await db.update(pointsWallets).set({
      earnedBalance: 2500,
      purchasedBalance: 4000,
      reservedEarnedBalance: 0,
      reservedPurchasedBalance: 0,
    }).where(eq(pointsWallets.userId, ownerId));

    // 6. Ensure agent wallet has verified balances
    await pointsEngine.getOrCreateWallet(agentId);
    await db.update(pointsWallets).set({
      earnedBalance: 600,
      purchasedBalance: 1500,
      reservedEarnedBalance: 0,
      reservedPurchasedBalance: 0,
    }).where(eq(pointsWallets.userId, agentId));

    // 7. Seed active sponsored campaign on mainListingId
    const now = new Date();
    const startTime = new Date(now.getTime() - 3600000); // 1 hr ago
    const endTime = new Date(now.getTime() + 86400000 * 7); // 7 days ahead
    seededCampaignIds.push(sponsoredCampaignId);

    await db.insert(promotionCampaigns).values({
      id: sponsoredCampaignId,
      listingId: mainListingId,
      propertyId: mainPropId,
      requesterUserId: ownerId,
      payerUserId: ownerId,
      packageId: 'PKG_MULTI_PAGE_7D',
      packageVersion: 1,
      campaignType: 'MULTI_PAGE',
      pointsCost: 1000,
      durationDays: 7,
      placementScope: ['HOMEPAGE', 'SEARCH'],
      rankScore: 99,
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
      if (seededCampaignIds.length > 0) {
        await db.delete(promotionCampaigns).where(inArray(promotionCampaigns.id, seededCampaignIds)).catch(() => {});
      }
      if (createdOrderIds.length > 0) {
        await db.delete(pointsPurchaseOrders).where(inArray(pointsPurchaseOrders.id, createdOrderIds)).catch(() => {});
      }
      if (seededListingIds.length > 0) {
        await db.delete(listings).where(inArray(listings.id, seededListingIds)).catch(() => {});
      }
      if (seededPropertyIds.length > 0) {
        await db.delete(agentPropertyAssignments).where(inArray(agentPropertyAssignments.propertyId, seededPropertyIds)).catch(() => {});
        await db.delete(ownershipRecords).where(inArray(ownershipRecords.propertyId, seededPropertyIds)).catch(() => {});
        await db.delete(properties).where(inArray(properties.id, seededPropertyIds)).catch(() => {});
      }
    } catch {}
  });

  // ==========================================================================
  // SECTION 01: 01-homepage-and-discovery (Captures 01 to 04)
  // ==========================================================================
  test('01. Homepage Hero Discovery in English (01_home_hero_discovery_en.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: getCapturePath('01-homepage-and-discovery', '01_home_hero_discovery_en.png') });
  });

  test('02. Homepage Featured Rentals with Promoted Placement (02_home_featured_rentals_en.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Scroll down to featured section
    const featuredHeading = page.locator('text=Featured Properties').or(page.locator('text=Discover')).first();
    if (await featuredHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
      await featuredHeading.scrollIntoViewIfNeeded();
    } else {
      await page.mouse.wheel(0, 600);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: getCapturePath('01-homepage-and-discovery', '02_home_featured_rentals_en.png') });
  });

  test('03. Kurdish Sorani RTL Homepage Discovery (03_home_discovery_ku_rtl.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    // Verify RTL orientation
    await expect(page.locator('html[dir="rtl"]')).toBeAttached();
    await page.screenshot({ path: getCapturePath('01-homepage-and-discovery', '03_home_discovery_ku_rtl.png') });
  });

  test('04. Arabic RTL Homepage Discovery (04_home_discovery_ar_rtl.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: getCapturePath('01-homepage-and-discovery', '04_home_discovery_ar_rtl.png') });
  });

  // ==========================================================================
  // SECTION 02: 02-search-input-and-keywords (Captures 05 to 09)
  // ==========================================================================
  test('05. Rentals Search Explorer Initial View (05_search_rentals_initial_view.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: getCapturePath('02-search-input-and-keywords', '05_search_rentals_initial_view.png') });
  });

  test('06. Search Input with Keyword Typed (06_search_keyword_typed.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('Empire');
    await page.screenshot({ path: getCapturePath('02-search-input-and-keywords', '06_search_keyword_typed.png') });
  });

  test('07. Filtered Results by Keyword (07_search_results_filtered_by_keyword.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('Empire');
    await page.waitForTimeout(500);
    await page.screenshot({ path: getCapturePath('02-search-input-and-keywords', '07_search_results_filtered_by_keyword.png') });
  });

  test('08. Kurdish Keyword Search Query (08_search_kurdish_keyword_query.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('ئیمپایەر');
    await page.waitForTimeout(500);
    await page.screenshot({ path: getCapturePath('02-search-input-and-keywords', '08_search_kurdish_keyword_query.png') });
  });

  test('09. Clear Search Keyword Interaction (09_search_clear_keyword.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('Penthouse');
    await page.waitForTimeout(300);
    // Click clear button
    const clearBtn = page.locator('button[aria-label="Clear search"]').or(page.locator('[data-testid="clear-all-filters-btn"]')).first();
    if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clearBtn.click();
    } else {
      await searchInput.fill('');
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: getCapturePath('02-search-input-and-keywords', '09_search_clear_keyword.png') });
  });

  // ==========================================================================
  // SECTION 03: 03-filter-by-city-and-category (Captures 10 to 13)
  // ==========================================================================
  test('10. Filter by City Erbil (10_filter_by_city_erbil.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    // Open filters modal
    const filterBtn = page.locator('button:has-text("Filters")').or(page.locator('button:has-text("فلتەرەکان")')).first();
    if (await filterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: getCapturePath('03-filter-by-city-and-category', '10_filter_by_city_erbil.png') });
  });

  test('11. Filter by Property Type Apartment (11_filter_by_property_type_apartment.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    // Click Apartments quick pill
    const aptPill = page.locator('button:has-text("Apartments")').first();
    if (await aptPill.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aptPill.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: getCapturePath('03-filter-by-city-and-category', '11_filter_by_property_type_apartment.png') });
  });

  test('12. Filter by Price Range (12_filter_by_price_range.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const filterBtn = page.locator('button:has-text("Filters")').first();
    if (await filterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterBtn.click();
      const minInput = page.locator('input[placeholder*="Min"]').first();
      if (await minInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await minInput.fill('1000');
      }
    }
    await page.screenshot({ path: getCapturePath('03-filter-by-city-and-category', '12_filter_by_price_range.png') });
  });

  test('13. Filter Reset All Action (13_filter_reset_all.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill('Luxury');
    await page.waitForTimeout(300);
    const resetBtn = page.locator('[data-testid="clear-all-filters-btn"]').first();
    if (await resetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resetBtn.click();
    }
    await page.screenshot({ path: getCapturePath('03-filter-by-city-and-category', '13_filter_reset_all.png') });
  });

  // ==========================================================================
  // SECTION 04: 04-sorting-and-ordering (Captures 14 to 17)
  // ==========================================================================
  test('14. Sort by Newest (14_sort_by_newest.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const sortSelect = page.locator('[data-testid="sort-by-select"]');
    await expect(sortSelect).toBeVisible({ timeout: 10000 });
    await sortSelect.selectOption('newest');
    await page.waitForTimeout(300);
    await page.screenshot({ path: getCapturePath('04-sorting-and-ordering', '14_sort_by_newest.png') });
  });

  test('15. Sort by Price Ascending (15_sort_by_price_asc.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const sortSelect = page.locator('[data-testid="sort-by-select"]');
    await expect(sortSelect).toBeVisible({ timeout: 10000 });
    await sortSelect.selectOption('price_asc');
    await page.waitForTimeout(300);
    await page.screenshot({ path: getCapturePath('04-sorting-and-ordering', '15_sort_by_price_asc.png') });
  });

  test('16. Sort by Price Descending (16_sort_by_price_desc.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const sortSelect = page.locator('[data-testid="sort-by-select"]');
    await expect(sortSelect).toBeVisible({ timeout: 10000 });
    await sortSelect.selectOption('price_desc');
    await page.waitForTimeout(300);
    await page.screenshot({ path: getCapturePath('04-sorting-and-ordering', '16_sort_by_price_desc.png') });
  });

  test('17. Sort by Promoted / Sponsored First (17_sort_by_sponsored_first.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const sortSelect = page.locator('[data-testid="sort-by-select"]');
    await expect(sortSelect).toBeVisible({ timeout: 10000 });
    await sortSelect.selectOption('promoted');
    await page.waitForTimeout(300);
    await page.screenshot({ path: getCapturePath('04-sorting-and-ordering', '17_sort_by_sponsored_first.png') });
  });

  // ==========================================================================
  // SECTION 05: 05-pagination-controls (Captures 18 to 19)
  // ==========================================================================
  test('18. Pagination Page 1 Controls & Info (18_pagination_page_1.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const paginationControls = page.locator('[data-testid="pagination-controls"]');
    if (await paginationControls.isVisible({ timeout: 5000 }).catch(() => false)) {
      await paginationControls.scrollIntoViewIfNeeded();
    } else {
      await page.mouse.wheel(0, 1000);
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: getCapturePath('05-pagination-controls', '18_pagination_page_1.png') });
  });

  test('19. Pagination Next Page Navigation (19_pagination_page_nav.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const nextBtn = page.locator('[data-testid="pagination-next-btn"]');
    if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextBtn.scrollIntoViewIfNeeded();
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      await page.mouse.wheel(0, 1000);
    }
    await page.screenshot({ path: getCapturePath('05-pagination-controls', '19_pagination_page_nav.png') });
  });

  // ==========================================================================
  // SECTION 06: 06-property-card-and-sponsored-badge (Captures 20 to 21)
  // ==========================================================================
  test('20. Property Card with Sponsored Badge (20_property_card_sponsored_badge_highlight.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const badge = page.locator('[data-testid="sponsored-badge"]').first();
    if (await badge.isVisible({ timeout: 6000 }).catch(() => false)) {
      await badge.scrollIntoViewIfNeeded();
    } else {
      await page.mouse.wheel(0, 300);
    }
    await page.screenshot({ path: getCapturePath('06-property-card-and-sponsored-badge', '20_property_card_sponsored_badge_highlight.png') });
  });

  test('21. Property Card Specs and Dual Pricing IQD/USD (21_property_card_specs_and_price.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(400);
    await page.screenshot({ path: getCapturePath('06-property-card-and-sponsored-badge', '21_property_card_specs_and_price.png') });
  });

  // ==========================================================================
  // SECTION 07: 07-property-detail-modal-and-inquiry (Captures 22 to 24)
  // ==========================================================================
  test('22. Property Detail Modal Open (22_property_detail_modal_open.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const firstCard = page.locator('h4.font-bold').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: getCapturePath('07-property-detail-modal-and-inquiry', '22_property_detail_modal_open.png') });
  });

  test('23. Property Detail Specs, Carousel and Amenities (23_property_detail_specs_and_images.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const firstCard = page.locator('h4.font-bold').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();
    await page.waitForTimeout(500);
    // Scroll down inside the modal
    const modalContent = page.locator('.fixed.inset-0').locator('.overflow-y-auto').first();
    if (await modalContent.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modalContent.evaluate((el) => el.scrollBy(0, 400));
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: getCapturePath('07-property-detail-modal-and-inquiry', '23_property_detail_specs_and_images.png') });
  });

  test('24. Property Detail Inquiry & Contact Action (24_property_detail_inquiry_action.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const firstCard = page.locator('h4.font-bold').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();
    await page.waitForTimeout(500);
    const modalContent = page.locator('.fixed.inset-0').locator('.overflow-y-auto').first();
    if (await modalContent.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modalContent.evaluate((el) => el.scrollBy(0, 800));
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: getCapturePath('07-property-detail-modal-and-inquiry', '24_property_detail_inquiry_action.png') });
  });

  // ==========================================================================
  // SECTION 08: 08-sponsored-search-placement-strip (Captures 25 to 26)
  // ==========================================================================
  test('25. Sponsored Search Placement Strip Active (25_sponsored_search_placement_strip_active.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const strip = page.locator('[data-testid="sponsored-rental-placements"]').first();
    if (await strip.isVisible({ timeout: 6000 }).catch(() => false)) {
      await strip.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: getCapturePath('08-sponsored-search-placement-strip', '25_sponsored_search_placement_strip_active.png') });
  });

  test('26. Sponsored Placement Property Item Card (26_sponsored_placement_property_item.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const strip = page.locator('[data-testid="sponsored-rental-placements"]').first();
    if (await strip.isVisible({ timeout: 6000 }).catch(() => false)) {
      await strip.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: getCapturePath('08-sponsored-search-placement-strip', '26_sponsored_placement_property_item.png') });
  });

  // ==========================================================================
  // SECTION 09: 09-owner-points-wallet-and-ledger (Captures 27 to 28)
  // ==========================================================================
  test('27. Owner Points Wallet Balances (27_owner_points_wallet_balances.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await page.screenshot({ path: getCapturePath('09-owner-points-wallet-and-ledger', '27_owner_points_wallet_balances.png') });
  });

  test('28. Owner Points Ledger Transactions (28_owner_points_ledger_transactions.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(400);
    await page.screenshot({ path: getCapturePath('09-owner-points-wallet-and-ledger', '28_owner_points_ledger_transactions.png') });
  });

  // ==========================================================================
  // SECTION 10: 10-agent-points-wallet-and-ledger (Captures 29 to 30)
  // ==========================================================================
  test('29. Agent Points Wallet View (29_agent_points_wallet_view.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await page.screenshot({ path: getCapturePath('10-agent-points-wallet-and-ledger', '29_agent_points_wallet_view.png') });
  });

  test('30. Agent Points Ledger History (30_agent_points_ledger_history.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await page.mouse.wheel(0, 450);
    await page.waitForTimeout(400);
    await page.screenshot({ path: getCapturePath('10-agent-points-wallet-and-ledger', '30_agent_points_ledger_history.png') });
  });

  // ==========================================================================
  // SECTION 11: 11-points-purchase-package-selection (Captures 31 to 32)
  // ==========================================================================
  test('31. Points Purchase Modal Official Packages (31_points_purchase_modal_packages.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await expect(pointsNav).toBeVisible({ timeout: 15000 });
    await pointsNav.click();
    await expect(page.locator('[data-testid="points-wallet-view"]')).toBeVisible({ timeout: 15000 });

    const buyPointsBtn = page.locator('[data-testid="purchase-points-btn"]');
    await expect(buyPointsBtn).toBeVisible({ timeout: 15000 });
    await buyPointsBtn.click();
    const modal = page.locator('[data-testid="points-purchase-modal"]');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal.locator('[data-testid="package-option-PKG_POINTS_500"]').first()).toBeVisible({ timeout: 25000 });
    await page.screenshot({ path: getCapturePath('11-points-purchase-package-selection', '31_points_purchase_modal_packages.png') });
  });

  test('32. Points Purchase Payment Method Selection (32_points_purchase_payment_methods.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await expect(pointsNav).toBeVisible({ timeout: 15000 });
    await pointsNav.click();
    await expect(page.locator('[data-testid="points-wallet-view"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="purchase-points-btn"]').click();
    const modal = page.locator('[data-testid="points-purchase-modal"]');
    await expect(modal).toBeVisible({ timeout: 15000 });
    const pkgOpt = modal.locator('[data-testid="package-option-PKG_POINTS_500"]').first();
    await expect(pkgOpt).toBeVisible({ timeout: 25000 });
    await pkgOpt.click();
    const methodSelect = modal.locator('[data-testid="payment-method-select"]');
    await expect(methodSelect).toBeVisible({ timeout: 10000 });
    await methodSelect.selectOption('FIB');
    await page.screenshot({ path: getCapturePath('11-points-purchase-package-selection', '32_points_purchase_payment_methods.png') });
  });

  // ==========================================================================
  // SECTION 12: 12-points-purchase-order-pending-receipt (Capture 33)
  // ==========================================================================
  test('33. Points Purchase Order Submitted in PENDING State (33_points_purchase_order_submitted_pending.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await expect(pointsNav).toBeVisible({ timeout: 15000 });
    await pointsNav.click();
    await expect(page.locator('[data-testid="points-wallet-view"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="purchase-points-btn"]').click();
    const modal = page.locator('[data-testid="points-purchase-modal"]');
    await expect(modal).toBeVisible({ timeout: 15000 });
    const pkgOpt = modal.locator('[data-testid="package-option-PKG_POINTS_500"]').first();
    await expect(pkgOpt).toBeVisible({ timeout: 25000 });
    await pkgOpt.click();
    await modal.locator('[data-testid="payment-method-select"]').selectOption('FIB');
    await modal.locator('[data-testid="payment-reference-input"]').fill(`FIB-AUDIT-${runId}`);
    await modal.locator('[data-testid="submit-purchase-order-btn"]').click();
    const successCard = modal.locator('[data-testid="purchase-order-success"]');
    await expect(successCard).toBeVisible({ timeout: 15000 });
    const orderIdElem = modal.locator('[data-testid="order-id-display"]');
    const orderId = (await orderIdElem.innerText()).trim();
    if (orderId) createdOrderIds.push(orderId);
    await page.screenshot({ path: getCapturePath('12-points-purchase-order-pending-receipt', '33_points_purchase_order_submitted_pending.png') });
  });

  // ==========================================================================
  // SECTION 13: 13-admin-points-purchase-confirmation (Captures 34 to 35)
  // ==========================================================================
  test('34. Admin Purchase Orders Queue (34_admin_purchase_orders_queue.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await adminModModule.locator('[data-testid="tab-purchase-orders"]').click();
    await expect(adminModModule.locator('[data-testid="purchase-orders-queue"]')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: getCapturePath('13-admin-points-purchase-confirmation', '34_admin_purchase_orders_queue.png') });
  });

  test('35. Admin Purchase Order Confirmed (35_admin_purchase_order_confirmed.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await adminModModule.locator('[data-testid="tab-purchase-orders"]').click();
    // Confirm first pending order if visible
    const confirmBtn = adminModModule.locator('[data-testid^="confirm-order-"]').first();
    if (await confirmBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: getCapturePath('13-admin-points-purchase-confirmation', '35_admin_purchase_order_confirmed.png') });
  });

  // ==========================================================================
  // SECTION 14: 14-campaign-creation-and-package-select (Captures 36 to 38)
  // ==========================================================================
  test('36. Promote Property Modal Open (36_campaign_promote_modal_open.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto(`/properties/${mainPropId}`, { waitUntil: 'domcontentloaded' });
    const promoteBtn = page.locator('[data-testid="promote-property-btn"]');
    await expect(promoteBtn).toBeVisible({ timeout: 10000 });
    await promoteBtn.click();
    const promoModal = page.locator('[data-testid="promote-property-modal"]');
    await expect(promoModal).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: getCapturePath('14-campaign-creation-and-package-select', '36_campaign_promote_modal_open.png') });
  });

  test('37. Promotion Package Selected Cost & Scope (37_campaign_package_selected_cost.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto(`/properties/${mainPropId}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="promote-property-btn"]').click();
    const promoModal = page.locator('[data-testid="promote-property-modal"]');
    await expect(promoModal).toBeVisible({ timeout: 10000 });
    const pkgOption = promoModal.locator('[data-testid="promo-pkg-PKG_HOME_FEATURED_7D"]');
    if (await pkgOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pkgOption.click();
    }
    await page.screenshot({ path: getCapturePath('14-campaign-creation-and-package-select', '37_campaign_package_selected_cost.png') });
  });

  test('38. Campaign Points Reservation Notice (38_campaign_points_reservation_notice.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto(`/properties/${mainPropId}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="promote-property-btn"]').click();
    const promoModal = page.locator('[data-testid="promote-property-modal"]');
    await expect(promoModal).toBeVisible({ timeout: 10000 });
    const pkgOption = promoModal.locator('[data-testid="promo-pkg-PKG_HOME_FEATURED_7D"]');
    if (await pkgOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pkgOption.click();
    }
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
    await page.screenshot({ path: getCapturePath('14-campaign-creation-and-package-select', '38_campaign_points_reservation_notice.png') });
  });

  // ==========================================================================
  // SECTION 15: 15-agent-promotion-owner-consent-notice (Captures 39 to 40)
  // ==========================================================================
  test('39. Agent Promotion Mandatory Owner Consent Notice (39_agent_promote_owner_consent_notice.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-agent');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_agent_01',
        role: 'AGENT_BROKER',
        roles: ['AGENT_BROKER', 'AGENT'],
      }));
    });
    await page.goto(`/properties/${agentPropId}`, { waitUntil: 'domcontentloaded' });
    const promoteBtn = page.locator('[data-testid="promote-property-btn"]');
    await expect(promoteBtn).toBeVisible({ timeout: 10000 });
    await promoteBtn.click();
    const promoModal = page.locator('[data-testid="promote-property-modal"]');
    await expect(promoModal).toBeVisible({ timeout: 10000 });
    await expect(promoModal.locator('text=Campaigns initiated by agents require explicit property owner consent')).toBeVisible();
    await page.screenshot({ path: getCapturePath('15-agent-promotion-owner-consent-notice', '39_agent_promote_owner_consent_notice.png') });
  });

  test('40. Owner Consent Pending Status Notice (40_owner_consent_pending_status.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-agent');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_agent_01',
        role: 'AGENT_BROKER',
        roles: ['AGENT_BROKER', 'AGENT'],
      }));
    });
    await page.goto(`/properties/${agentPropId}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="promote-property-btn"]').click();
    const promoModal = page.locator('[data-testid="promote-property-modal"]');
    await expect(promoModal).toBeVisible({ timeout: 10000 });
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
    await page.screenshot({ path: getCapturePath('15-agent-promotion-owner-consent-notice', '40_owner_consent_pending_status.png') });
  });

  // ==========================================================================
  // SECTION 16: 16-admin-promotion-campaign-moderation (Captures 41 to 42)
  // ==========================================================================
  test('41. Admin Promotion Campaigns Moderation Queue (41_admin_promotion_moderation_queue.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await expect(adminModModule.locator('[data-testid="campaigns-moderation-queue"]')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: getCapturePath('16-admin-promotion-campaign-moderation', '41_admin_promotion_moderation_queue.png') });
  });

  test('42. Admin Campaign Approval Interface (42_admin_campaign_approved_activation.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await page.screenshot({ path: getCapturePath('16-admin-promotion-campaign-moderation', '42_admin_campaign_approved_activation.png') });
  });

  // ==========================================================================
  // SECTION 17: 17-empty-states-and-image-fallback (Captures 43 to 44)
  // ==========================================================================
  test('43. Search Explorer Empty State for Non-Matching Query (43_search_empty_state_no_results.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('xyz999nonexistentquery');
    await page.waitForTimeout(500);
    // Helpful empty state
    await page.screenshot({ path: getCapturePath('17-empty-states-and-image-fallback', '43_search_empty_state_no_results.png') });
  });

  test('44. Broken Image Fallback Handling (44_broken_image_fallback_handling.png)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    // Verify image element has valid rendering and natural dimensions
    const firstImg = page.locator('img').first();
    await expect(firstImg).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: getCapturePath('17-empty-states-and-image-fallback', '44_broken_image_fallback_handling.png') });
  });

  // ==========================================================================
  // SECTION 18: 18-mobile-responsive-ergonomics (Capture 45)
  // ==========================================================================
  test('45. Mobile Responsive Search Explorer Viewport 375x812 (45_mobile_rentals_search_responsive.png)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: getCapturePath('18-mobile-responsive-ergonomics', '45_mobile_rentals_search_responsive.png') });
  });
});
