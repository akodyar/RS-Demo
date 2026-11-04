import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const screenshotDir = path.resolve(process.cwd(), 'screenshots');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

test.describe.serial('Rent Management Page Visual Audit & UX Verification (Option C Playwright)', () => {
  test.beforeAll(async () => {
    ensureDir(screenshotDir);
  });

  test('WF-01: Kurdish Sorani RTL (ku) Desktop Baseline & Full Page Visual Verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Set Kurdish language in localStorage before navigating
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
    });

    await page.goto('/rent-management', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify root container and RTL direction
    const rootPage = page.locator('#rent-management-page');
    await expect(rootPage).toBeVisible({ timeout: 10000 });
    await expect(rootPage).toHaveAttribute('dir', 'rtl');

    // Verify headline in Kurdish Sorani
    const headline = page.locator('h1');
    await expect(headline).toContainText('بەڕێوەبردنی پڕۆفێشناڵی کرێنشین و کرێ');

    // Verify highlight box
    const highlightBox = page.locator('#rent-mgmt-highlight-box');
    await expect(highlightBox).toBeVisible();
    await expect(highlightBox).toContainText('بەڕێوەبردنی خشتەی کرێ، تۆماری پارەدان، پەیوەندی کرێنشین');

    // Verify 4-stage operational flow
    await expect(page.locator('#rent-mgmt-operational-flow')).toBeVisible();
    await expect(page.locator('#rent-mgmt-step-1')).toBeVisible();
    await expect(page.locator('#rent-mgmt-step-2')).toBeVisible();
    await expect(page.locator('#rent-mgmt-step-3')).toBeVisible();
    await expect(page.locator('#rent-mgmt-step-4')).toBeVisible();

    // Verify 3 operating models section
    await expect(page.locator('#rent-mgmt-operating-models')).toBeVisible();
    await expect(page.locator('#rent-mgmt-model-fully-managed')).toBeVisible();
    await expect(page.locator('#rent-mgmt-model-agent-listed')).toBeVisible();
    await expect(page.locator('#rent-mgmt-model-agent-operated')).toBeVisible();

    // Verify financial governance section
    await expect(page.locator('#rent-mgmt-governance')).toBeVisible();
    await expect(page.locator('#rent-mgmt-gov-1')).toBeVisible();
    await expect(page.locator('#rent-mgmt-gov-2')).toBeVisible();
    await expect(page.locator('#rent-mgmt-gov-3')).toBeVisible();

    // Verify final CTA section
    await expect(page.locator('#rent-mgmt-final-cta')).toBeVisible();
    await expect(page.locator('#rent-mgmt-bottom-open-owner-btn')).toBeVisible();
    await expect(page.locator('#rent-mgmt-bottom-register-property-btn')).toBeVisible();
    await expect(page.locator('#rent-mgmt-company-portal-btn')).toBeVisible();

    // Capture Kurdish Desktop Screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'rent_management_page_ku_desktop.png'),
      fullPage: true,
    });
  });

  test('WF-02: Arabic RTL (ar) Desktop Verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
    });

    await page.goto('/rent-management', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);

    const rootPage = page.locator('#rent-management-page');
    await expect(rootPage).toBeVisible({ timeout: 10000 });
    await expect(rootPage).toHaveAttribute('dir', 'rtl');

    // Verify Arabic headline
    const headline = page.locator('h1');
    await expect(headline).toContainText('إدارة احترافية للمستأجرين والإيجارات');

    // Capture Arabic Desktop Screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'rent_management_page_ar_desktop.png'),
      fullPage: true,
    });
  });

  test('WF-03: English LTR (en) Desktop Verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });

    await page.goto('/rent-management', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);

    const rootPage = page.locator('#rent-management-page');
    await expect(rootPage).toBeVisible({ timeout: 10000 });
    await expect(rootPage).toHaveAttribute('dir', 'ltr');

    // Verify English headline and highlight box
    const headline = page.locator('h1');
    await expect(headline).toContainText('Professional Tenant & Rent Management');

    const highlightBox = page.locator('#rent-mgmt-highlight-box');
    await expect(highlightBox).toContainText('Manage rental schedules, payment records, tenant communication');

    // Capture English Desktop Screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'rent_management_page_en_desktop.png'),
      fullPage: true,
    });
  });

  test('WF-04: Mobile Responsive Ergonomics (375x812 Viewport in Kurdish Sorani)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
    });

    await page.goto('/rent-management', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // allowing sub-pixel margin

    // Verify mobile CTAs are accessible
    await expect(page.locator('#rent-mgmt-hero-open-owner-btn')).toBeVisible();
    await expect(page.locator('#rent-mgmt-hero-register-property-btn')).toBeVisible();

    // Capture Mobile Screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'rent_management_page_mobile_ku.png'),
      fullPage: true,
    });
  });

  test('WF-05: CTA Destinations & Routing Invariants', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/rent-management', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 1. Verify Hero Open Owner Workspace href
    const heroOwnerBtn = page.locator('#rent-mgmt-hero-open-owner-btn');
    await expect(heroOwnerBtn).toHaveAttribute('href', '/workspace/owner');

    // 2. Verify Hero Register Property href
    const heroRegisterBtn = page.locator('#rent-mgmt-hero-register-property-btn');
    await expect(heroRegisterBtn).toHaveAttribute('href', '/properties/add');

    // 3. Verify Bottom Open Owner Workspace href
    const bottomOwnerBtn = page.locator('#rent-mgmt-bottom-open-owner-btn');
    await expect(bottomOwnerBtn).toHaveAttribute('href', '/workspace/owner');

    // 4. Verify Bottom Register Property href
    const bottomRegisterBtn = page.locator('#rent-mgmt-bottom-register-property-btn');
    await expect(bottomRegisterBtn).toHaveAttribute('href', '/properties/add');

    // 5. Verify Company Portal href
    const companyBtn = page.locator('#rent-mgmt-company-portal-btn');
    await expect(companyBtn).toHaveAttribute('href', '/company');
  });
});
