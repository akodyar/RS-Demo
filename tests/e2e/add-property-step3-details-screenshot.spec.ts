import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Add Property Wizard - Step 3 (Details) Cleaned Verification', () => {
  const screenshotDir = path.resolve(
    process.cwd(),
    'screenshots/homehub-whole-system-ui-audit/audit-run-2026-10-25'
  );

  test('Capture Step 3 Details in Kurdish Sorani RTL (without Pricing Tier & Operating Model)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          email: 'owner@homehub.iq',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    await page.goto('/properties/add?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    // Step 0: Type Selection
    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });
    await aptBtn.click();

    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.click();

    // Step 1: Basic Information
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('ئیمپایەر وۆڕڵد تاوەری A');
    await nextBtn.click();

    // Step 2: Location
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 3: Details
    await page.waitForTimeout(500);

    // Verify completely removed items
    await expect(page.locator('[data-testid="pricing-tier-banner"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="resolved-tier-name"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="verified-property-count"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="tier-rates-info"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="property-operating-model"]')).toHaveCount(0);
    await expect(page.locator('input[data-testid="property-rent-fee"]')).toHaveCount(0);
    await expect(page.locator('input[data-testid="property-management-fee"]')).toHaveCount(0);

    // Capture high-fidelity screenshot
    await page.screenshot({
      path: path.join(screenshotDir, '25b-add-property-step3-details-ku.png'),
      fullPage: true,
    });
  });

  test('Capture Step 3 Details in English LTR (without Pricing Tier & Operating Model)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          email: 'owner@homehub.iq',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    await page.goto('/properties/add?lang=en', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    // Step 0: Type Selection
    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });
    await aptBtn.click();

    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.click();

    // Step 1: Basic Information
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Empire World Tower A');
    await nextBtn.click();

    // Step 2: Location
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 3: Details
    await page.waitForTimeout(500);

    // Verify completely removed items
    await expect(page.locator('[data-testid="pricing-tier-banner"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="resolved-tier-name"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="verified-property-count"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="tier-rates-info"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="property-operating-model"]')).toHaveCount(0);
    await expect(page.locator('input[data-testid="property-rent-fee"]')).toHaveCount(0);
    await expect(page.locator('input[data-testid="property-management-fee"]')).toHaveCount(0);

    // Capture high-fidelity screenshot
    await page.screenshot({
      path: path.join(screenshotDir, '25c-add-property-step3-details-en.png'),
      fullPage: true,
    });
  });
});
