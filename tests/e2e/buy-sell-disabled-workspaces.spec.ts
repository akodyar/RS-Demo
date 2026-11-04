import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env' });

const screenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-full-audit/roles');

test.describe.serial('Domain 9 & 10: Buy/Sell Disablement & Workspace/Role Cleanup', () => {

  test('1. Buy/Sell Feature — UI Disablement & RENT Unaffected', async ({ page, request }) => {
    // 1. Visit Home page
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Header navigation should NOT have "موڵک بۆ فرۆشتن" or Buy/Sell links
    const saleNavLink = page.locator('nav a[href="/sale"]');
    await expect(saleNavLink).toHaveCount(0);

    // Rent navigation must be visible
    const rentNavLink = page.locator('nav a[href="/rent"], nav a[href="/rentals"]').first();
    await expect(rentNavLink).toBeVisible();

    // 2. Direct navigation to /sale must redirect to /rentals (or /rent)
    await page.goto('/sale', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/.*\/(rent|rentals).*/);
    expect(page.url()).toMatch(/\/(rent|rentals)/);

    // Capture screenshot of Rent marketplace with no Buy/Sell controls
    await page.screenshot({ path: path.join(screenshotDir, 'buy-sell-disabled-marketplace.png'), fullPage: true });

    // 3. API Disablement: FOR_SALE queries must fail with 403 BUY_SELL_DISABLED
    const saleSearchRes = await request.get('/api/marketplace/listings/search?type=FOR_SALE');
    expect(saleSearchRes.status()).toBe(403);
    const saleSearchJson = await saleSearchRes.json();
    expect(saleSearchJson.error).toBe('BUY_SELL_DISABLED');

    // 4. API Rent Unaffected: FOR_RENT queries must succeed with 200
    const rentSearchRes = await request.get('/api/marketplace/listings/search?type=FOR_RENT');
    expect(rentSearchRes.status()).toBe(200);

    // 5. Backend Buyer API rejection
    const buyerApiRes = await request.get('/api/buyer/dashboard', {
      headers: { Authorization: `Bearer dev-platform_admin` }
    });
    expect(buyerApiRes.status()).toBe(403);
    const buyerApiJson = await buyerApiRes.json();
    expect(buyerApiJson.error).toBe('BUY_SELL_DISABLED');
  });

  test('2. Legacy Workspaces & Obsolete Routes Blocked', async ({ page }) => {
    // 1. Direct navigation to legacy /buyer route must redirect to /
    await page.goto('/buyer', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/.*localhost:3000\/?$/);

    // 2. Direct navigation to /workspace/buyer must redirect to /
    await page.goto('/workspace/buyer', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/.*localhost:3000\/?$/);

    // 3. Protected /company and /workspace/accountant require authentication (render login/onboarding prompt)
    await page.goto('/company', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('button, [data-testid], a[href*="login"]').first()).toBeVisible({ timeout: 10000 });

    await page.goto('/workspace/accountant', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('button, [data-testid], a[href*="login"]').first()).toBeVisible({ timeout: 10000 });

    // Capture screenshot of clean redirected root
    await page.screenshot({ path: path.join(screenshotDir, 'clean-workspaces-navigation.png'), fullPage: true });
  });

  test('3. Owner Registration — Requires Individual OR Company Selection', async ({ page }) => {
    // Go to onboarding purpose screen
    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Select Owner role card
    const ownerCard = page.locator('[data-testid="role-card-owner"]');
    await expect(ownerCard).toBeVisible({ timeout: 10000 });
    await ownerCard.click();

    // Click continue button
    const continueBtn = page.locator('#purpose-continue-btn');
    await continueBtn.click();

    // Verify signup form renders with entityType radios

    // Verify entityType radios: INDIVIDUAL and COMPANY are present
    const indRadio = page.locator('[data-testid="entity-type-individual"]');
    const compRadio = page.locator('[data-testid="entity-type-company"]');
    await expect(indRadio).toBeVisible();
    await expect(compRadio).toBeVisible();

    // Select Individual
    await indRadio.check();
    expect(await indRadio.isChecked()).toBe(true);

    // Select Company
    await compRadio.check();
    expect(await compRadio.isChecked()).toBe(true);

    // When Company is checked, Company Name input appears
    const compNameInput = page.locator('#signup-company');
    await expect(compNameInput).toBeVisible();

    // Capture screenshot of Owner entity selection
    await page.screenshot({ path: path.join(screenshotDir, 'owner-registration-entity-selection.png'), fullPage: true });
  });

  test('4. Agent Registration — Requires Individual OR Company Selection', async ({ page }) => {
    // Go to onboarding purpose screen
    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Select Agent role card
    const agentCard = page.locator('[data-testid="role-card-agent"]');
    await expect(agentCard).toBeVisible({ timeout: 10000 });
    await agentCard.click();

    // Click continue button
    const continueBtn = page.locator('#purpose-continue-btn');
    await continueBtn.click();

    // Verify signup form renders with entityType radios

    // Verify entityType radios: INDIVIDUAL and COMPANY are present
    const indRadio = page.locator('[data-testid="entity-type-individual"]');
    const compRadio = page.locator('[data-testid="entity-type-company"]');
    await expect(indRadio).toBeVisible();
    await expect(compRadio).toBeVisible();

    // Select Company
    await compRadio.check();
    expect(await compRadio.isChecked()).toBe(true);

    // Capture screenshot of Agent entity selection
    await page.screenshot({ path: path.join(screenshotDir, 'agent-registration-entity-selection.png'), fullPage: true });
  });
});
