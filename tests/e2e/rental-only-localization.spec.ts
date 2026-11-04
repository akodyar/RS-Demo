import { test, expect } from '@playwright/test';
import path from 'path';

const screenshotDir = path.resolve(process.cwd(), 'screenshots/rental-only');

test.describe('Rental-Only Product Scope & Localization Verification', () => {
  test.use({ locale: 'en-US' });

  test('English - Verify Rental-Only UI and lack of Buy/Sell navigation', async ({ page }) => {
    await page.goto('/?lang=en');
    await page.waitForTimeout(2000);

    // Verify Buy/Sell is absent
    await expect(page.locator('text=Buy Property')).toHaveCount(0);
    await expect(page.locator('text=Sell Property')).toHaveCount(0);
    await expect(page.locator('text=For Sale')).toHaveCount(0);

    // Verify Rental terminology is present
    await expect(page.getByRole('link', { name: /Rent|Lease/i }).first()).toBeVisible();

    // Verify Mobile navigation
    const mobileMenuBtn = page.locator('button[aria-label="Toggle Menu"]').first();
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
      await expect(page.locator('.mobile-nav text=Sale')).toHaveCount(0);
    }
  });

  test('Direct Buy/Sell Route Protection', async ({ page, request }) => {
    // Navigate to sale
    await page.goto('/sale');
    await page.waitForTimeout(1000);
    
    // Should redirect or not show sale listings
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/sale'); // or should have navigated away

    // Verify API is protected
    const saleSearchRes = await request.get('/api/marketplace/listings/search?type=FOR_SALE');
    expect(saleSearchRes.status()).toBe(403);
  });
});

test.describe('Kurdish Sorani - Rental-Only UI Verification', () => {
  test.use({ locale: 'ku' });

  test('Verify RTL and lack of Buy/Sell terminology', async ({ page }) => {
    await page.goto('/?lang=ku');
    await page.waitForTimeout(2000);

    // Verify lack of Kurdish Buy/Sell
    await expect(page.locator('text=کڕین')).toHaveCount(0);
    await expect(page.locator('text=فرۆشتن')).toHaveCount(0);
    await expect(page.locator('text=بۆ فرۆشتن')).toHaveCount(0);

    // Verify RTL is applied
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });
});

test.describe('Arabic - Rental-Only UI Verification', () => {
  test.use({ locale: 'ar' });

  test('Verify RTL and lack of Buy/Sell terminology', async ({ page }) => {
    await page.goto('/?lang=ar');
    await page.waitForTimeout(2000);

    // Verify lack of Arabic Buy/Sell
    await expect(page.locator('text=شراء')).toHaveCount(0);
    await expect(page.locator('text=بيع')).toHaveCount(0);
    await expect(page.locator('text=للبيع')).toHaveCount(0);

    // Verify RTL is applied
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });
});
