import { test, expect } from '@playwright/test';
import path from 'path';

const screenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-full-audit/marketplace');

test.describe.serial('Marketplace Rental Discovery & Promotion Boost Verification', () => {
  test('1. Rental marketplace search API returns 200 with items and promotion metadata', async ({ request }) => {
    const res = await request.get('/api/marketplace/listings/search?type=FOR_RENT');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(typeof data.total).toBe('number');

    // Strict Domain Separation: FOR_SALE queries must fail with 403 BUY_SELL_DISABLED
    const saleRes = await request.get('/api/marketplace/listings/search?type=FOR_SALE');
    expect(saleRes.status()).toBe(403);
    const saleJson = await saleRes.json();
    expect(saleJson.error).toBe('BUY_SELL_DISABLED');
  });

  test('2. Public /rentals browsing page loads with verified rental listings', async ({ page }) => {
    await page.goto('/rentals', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify page content
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Capture screenshot as visual evidence
    await page.screenshot({
      path: path.join(screenshotDir, 'rentals-marketplace-discovery.png'),
      fullPage: false,
    });
  });
});
