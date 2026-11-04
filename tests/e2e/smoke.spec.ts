import { test, expect } from '@playwright/test';

test.describe('HomeHub Browser Smoke Test', () => {
  test('should open HomeHub landing page and verify root elements', async ({ page }) => {
    // Navigate to local application
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    // Verify root container renders
    const root = page.locator('#root');
    await expect(root).toBeVisible({ timeout: 15000 });

    // Verify page title
    const title = await page.title();
    expect(title).toContain('HomeHub');

    // Verify primary header or brand element
    const brandElement = page.getByText('HomeHub').first();
    await expect(brandElement).toBeVisible();

    // Take verification screenshot artifact
    await page.screenshot({ path: 'test-results/smoke-landing-page.png', fullPage: true });
  });

  test('should navigate to login page and render authentication form', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Verify login form or inputs are rendered
    const emailInput = page.locator('#login-email');
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toBeVisible();

    const submitBtn = page.locator('#login-submit-btn');
    await expect(submitBtn).toBeVisible();

    // Take verification screenshot artifact
    await page.screenshot({ path: 'test-results/smoke-login-page.png' });
  });
});
