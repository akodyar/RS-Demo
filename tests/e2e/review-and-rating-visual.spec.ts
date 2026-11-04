import { test, expect } from '@playwright/test';
import { db, closePool } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const screenshotDir = path.resolve(process.cwd(), 'screenshots');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

test.describe.serial('Review & Rating Visual Verification (Option C Playwright)', () => {
  const activeTenant = { uid: 'user_tenant_01', id: 'user_tenant_01', roles: ['TENANT'], name: 'Tenant A', firstName: 'Tenant', lastName: 'Active' };
  const activeOwner = { uid: 'user_owner_01', id: 'user_owner_01', roles: ['PROPERTY_OWNER'], name: 'Owner O', firstName: 'Owner', lastName: 'Verified' };

  test.beforeAll(async () => {
    ensureDir(screenshotDir);

    // Ensure user_tenant_01 and user_owner_01 exist
    await db.insert(schema.users).values([
      { id: 'user_tenant_01', email: 'tenant@homehub.iq', firstName: 'Tenant', lastName: 'Active', roles: ['TENANT'], createdAt: new Date() },
      { id: 'user_owner_01', email: 'owner@homehub.iq', firstName: 'Owner', lastName: 'Verified', roles: ['PROPERTY_OWNER'], createdAt: new Date() },
    ]).onConflictDoNothing();

    // Ensure property e2e-tenant-prop-a exists
    await db.insert(schema.properties).values([
      { id: 'e2e-tenant-prop-a', name: 'Empire World Luxury Suite 402', type: 'APARTMENT', address: { city: 'Erbil', street: 'Gulan St' }, status: 'OCCUPIED' },
    ]).onConflictDoNothing();

    // Ensure ownership record exists for owner
    await db.insert(schema.ownershipRecords).values([
      { id: 'e2e-own-1', propertyId: 'e2e-tenant-prop-a', ownerId: 'user_owner_01', status: 'VERIFIED', ownershipPercentage: 100 },
    ]).onConflictDoNothing();

    // Ensure lease exists
    await db.insert(schema.leases).values([
      { id: 'e2e-lease-active', propertyId: 'e2e-tenant-prop-a', status: 'ACTIVE', startDate: '2025-01-01', endDate: '2026-12-31', rentAmount: 850000 },
    ]).onConflictDoNothing();

    await db.insert(schema.leaseTenants).values([
      { id: 'e2e-lt-1', leaseId: 'e2e-lease-active', tenantId: 'user_tenant_01', isPrimary: true },
    ]).onConflictDoNothing();

    // Ensure a seed property review exists for visual demonstration
    const [existing] = await db
      .select()
      .from(schema.propertyReviews)
      .where(and(
        eq(schema.propertyReviews.propertyId, 'e2e-tenant-prop-a'),
        eq(schema.propertyReviews.tenantId, 'user_tenant_01')
      ))
      .limit(1);

    if (!existing) {
      await db.insert(schema.propertyReviews).values({
        id: 'rev-e2e-tenant-visual-01',
        propertyId: 'e2e-tenant-prop-a',
        leaseId: 'e2e-lease-active',
        tenantId: 'user_tenant_01',
        rating: 5,
        cleanlinessRating: 5,
        maintenanceRating: 4,
        communicationRating: 5,
        locationRating: 5,
        title: 'Modern and peaceful apartment in Gulan St',
        comment: 'Outstanding living experience. The power and water are continuous, building elevators are fast and secure.',
        status: 'PUBLISHED',
        ownerResponse: 'Thank you for your feedback! We are delighted to have you at Empire World.',
        ownerRespondedAt: new Date(),
      });
    }
  });

  test.afterAll(async () => {
    await closePool();
  });

  async function loginAs(page: any, user: any, tokenStr: string = 'dev-tenant', lang: string = 'en') {
    await page.goto('/');
    await page.evaluate(({ u, tok, l }) => {
      localStorage.setItem('auth_token', tok);
      localStorage.setItem('homehub_auth_token', tok);
      localStorage.setItem('token', tok);
      localStorage.setItem('homehub_auth_persona', JSON.stringify(u));
      localStorage.setItem('homehub_lang', l);
    }, { u: user, tok: tokenStr, l: lang });
  }

  test('1. Verify Property Review & Rating Card on Tenant Lease View (EN)', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Authenticate as Tenant in English with valid dev-tenant token
    await loginAs(page, activeTenant, 'dev-tenant', 'en');

    // 2. Navigate to Tenant Workspace
    await page.goto('/workspace/tenant', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 3. Switch to Lease View tab
    const leaseNavBtn = page.locator('button:has-text("My Lease"), button:has-text("Lease")').first();
    await expect(leaseNavBtn).toBeVisible({ timeout: 15000 });
    await leaseNavBtn.click();

    // Bounded readiness check for Tenant Lease View
    const leaseView = page.locator('#tenant-lease-view');
    await expect(leaseView).toBeVisible({ timeout: 20000 });

    // 4. Bounded check for the Property Review Card
    const reviewCard = page.locator('#tenant-property-review-card');
    await expect(reviewCard).toBeVisible({ timeout: 15000 });

    // Capture visual screenshot of the Lease View with Review Card
    const leaseScreenshotPath = path.join(screenshotDir, 'review_and_rating_tenant_lease_view_en.png');
    await page.screenshot({ path: leaseScreenshotPath, fullPage: true });
    console.log(`[Option C] Screenshot captured: ${leaseScreenshotPath}`);

    // 5. Click "Edit Review" or "Write a Review" to open TenantPropertyReviewModal
    const reviewBtn = reviewCard.locator('button:has-text("Edit Review"), button:has-text("Write a Review")').first();
    await expect(reviewBtn).toBeVisible({ timeout: 10000 });
    await reviewBtn.click();

    // 6. Verify TenantPropertyReviewModal is open with Option 4 Dark Luxury theme
    const modalHeading = page.locator('h3:has-text("Edit Your Review"), h3:has-text("Rate & Review Property")');
    await expect(modalHeading).toBeVisible({ timeout: 10000 });

    // Verify star selector and feedback text area
    const starBtn = page.locator('button[aria-label*="stars"]').first();
    await expect(starBtn).toBeVisible({ timeout: 5000 });

    const feedbackInput = page.locator('textarea').first();
    await expect(feedbackInput).toBeVisible({ timeout: 5000 });

    // Capture visual screenshot of the Review Modal
    const modalScreenshotPath = path.join(screenshotDir, 'review_and_rating_modal_en.png');
    await page.screenshot({ path: modalScreenshotPath, fullPage: true });
    console.log(`[Option C] Screenshot captured: ${modalScreenshotPath}`);
  });

  test('2. Verify Kurdish Sorani RTL Review Card and Modal Localization (KU)', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Authenticate as Tenant in Kurdish Sorani with valid dev-tenant token
    await loginAs(page, activeTenant, 'dev-tenant', 'ku');

    // 2. Navigate to Tenant Workspace
    await page.goto('/workspace/tenant', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 3. Switch to Lease View tab (Kurdish button: گرێبەستەکەم)
    const leaseNavBtn = page.locator('button:has-text("گرێبەستەکەم"), button:has-text("My Lease")').first();
    await expect(leaseNavBtn).toBeVisible({ timeout: 15000 });
    await leaseNavBtn.click();

    const leaseView = page.locator('#tenant-lease-view');
    await expect(leaseView).toBeVisible({ timeout: 20000 });

    // Verify Kurdish review card heading
    const reviewCard = page.locator('#tenant-property-review-card');
    await expect(reviewCard).toBeVisible({ timeout: 15000 });
    await expect(reviewCard.locator('text=هەڵسەنگاندنی موڵک و ئەزموونی نیشتەجێبوون')).toBeVisible({ timeout: 10000 });

    // Capture visual screenshot of the Kurdish Lease View
    const kuLeaseScreenshotPath = path.join(screenshotDir, 'review_and_rating_tenant_lease_view_ku.png');
    await page.screenshot({ path: kuLeaseScreenshotPath, fullPage: true });
    console.log(`[Option C] Screenshot captured: ${kuLeaseScreenshotPath}`);

    // Click edit review in Kurdish
    const editBtn = reviewCard.locator('button:has-text("دەستکاری هەڵسەنگاندن"), button:has-text("نووسینی هەڵسەنگاندن")').first();
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();

    // Verify Kurdish modal heading and RTL layout
    const kuModalHeading = page.locator('h3:has-text("دەستکاریکردنی هەڵسەنگاندنەکەت"), h3:has-text("هەڵسەنگاندن و دەربڕینی ڕا بۆ موڵک")');
    await expect(kuModalHeading).toBeVisible({ timeout: 10000 });

    // Verify Kurdish labels inside modal
    await expect(page.locator('text=پاکوخاوێنی و ڕاگرتنی بینا')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=خێرایی وەڵامدانەوەی چاکسازی')).toBeVisible({ timeout: 5000 });

    // Capture visual screenshot of Kurdish Review Modal
    const kuModalScreenshotPath = path.join(screenshotDir, 'review_and_rating_modal_ku.png');
    await page.screenshot({ path: kuModalScreenshotPath, fullPage: true });
    console.log(`[Option C] Screenshot captured: ${kuModalScreenshotPath}`);
  });

  test('3. Verify Property Command Center Cross-Domain Rating Badge and Resident Reviews Section', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Authenticate as Owner with valid dev-owner token
    await loginAs(page, activeOwner, 'dev-owner', 'en');

    // 2. Navigate to Property Command Center for the property
    await page.goto('/properties/e2e-tenant-prop-a', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 3. Verify Property Command Center renders
    await expect(page.locator('h1:has-text("Empire World Luxury Suite 402")')).toBeVisible({ timeout: 20000 });

    // 4. Verify verified resident rating badge in the header
    const ratingBadge = page.locator('#property-command-center-reviews-badge');
    await expect(ratingBadge).toBeVisible({ timeout: 10000 });

    // 5. Verify resident reviews section in the overview column
    const residentReviewsCard = page.locator('#property-resident-reviews-card');
    await expect(residentReviewsCard).toBeVisible({ timeout: 10000 });

    // Capture screenshot of Property Command Center with reviews
    const commandCenterScreenshotPath = path.join(screenshotDir, 'review_and_rating_property_command_center.png');
    await page.screenshot({ path: commandCenterScreenshotPath, fullPage: true });
    console.log(`[Option C] Screenshot captured: ${commandCenterScreenshotPath}`);
  });
});
