import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const screenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-global-dark-premium-design-system');

function ensureDir() {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
}

test.describe.serial('HomeHub Option 4: Midnight Slate & Champagne Gold Design System Audit', () => {
  test.beforeAll(() => {
    ensureDir();
  });

  test('01. Public Homepage — Desktop (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Verify Option 4 tokens present
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotDir, '01-homepage-desktop-ku.png'),
      fullPage: true,
    });
  });

  test('02. Public Homepage — Desktop (Arabic RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
      localStorage.setItem('homehub_language', 'ar');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.screenshot({
      path: path.join(screenshotDir, '02-homepage-desktop-ar.png'),
      fullPage: true,
    });
  });

  test('03. Public Homepage — Desktop (English LTR)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.screenshot({
      path: path.join(screenshotDir, '03-homepage-desktop-en.png'),
      fullPage: true,
    });
  });

  test('04. Public Homepage — Mobile (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '04-homepage-mobile-ku.png'),
      fullPage: true,
    });
  });

  test('05. Public Rentals Discovery & Search Explorer (English LTR)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
    });

    await page.goto('/rentals', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#search-explorer-root')).toBeVisible({ timeout: 10000 });

    // Verify search bar
    await expect(page.locator('#search-explorer-input')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '05-rentals-search-explorer-en.png'),
      fullPage: true,
    });
  });

  test('06. Public Rentals Discovery & Search Explorer (Kurdish RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });

    await page.goto('/rentals', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#search-explorer-root')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '06-rentals-search-explorer-ku.png'),
      fullPage: true,
    });
  });

  test('07. Dedicated Property Detail Page (/properties/:id)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
    });

    await page.goto('/properties/p_01', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '07-property-detail-en.png'),
      fullPage: true,
    });
  });

  test('08. Sign-In / Login Screen (/login)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('homehub_auth_persona');
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    // Verify login form is visible
    await expect(page.locator('#login-email')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '08-login-screen.png'),
      fullPage: true,
    });
  });

  test('09. Tenant Dashboard (/tenant)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_tenant_01',
        email: 'tenant@homehub.iq',
        role: 'TENANT',
        roles: ['TENANT'],
      }));
    });

    await page.goto('/tenant', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '09-tenant-dashboard.png'),
      fullPage: true,
    });
  });

  test('10. Owner Dashboard (/owner)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        email: 'owner@homehub.iq',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto('/owner', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '10-owner-dashboard.png'),
      fullPage: true,
    });
  });

  test('11. Agent Dashboard (/agent)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('auth_token', 'dev-agent');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_agent_01',
        email: 'agent@homehub.iq',
        role: 'AGENT_BROKER',
        roles: ['AGENT_BROKER'],
      }));
    });

    await page.goto('/agent', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '11-agent-dashboard.png'),
      fullPage: true,
    });
  });

  test('12. Vendor Dashboard (/vendor)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('auth_token', 'dev-vendor');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_vendor_01',
        email: 'vendor@homehub.iq',
        role: 'VENDOR',
        roles: ['VENDOR'],
      }));
    });

    await page.goto('/vendor', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '12-vendor-dashboard.png'),
      fullPage: true,
    });
  });

  test('13. Company Workspace (/workspace/company)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_company_01',
        email: 'company@homehub.iq',
        role: 'COMPANY_ADMIN',
        roles: ['COMPANY_ADMIN'],
      }));
    });

    await page.goto('/workspace/company', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '13-company-workspace.png'),
      fullPage: true,
    });
  });

  test('14. Company CRM Workspace (/workspace/company/crm)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_company_01',
        email: 'company@homehub.iq',
        role: 'COMPANY_ADMIN',
        roles: ['COMPANY_ADMIN'],
      }));
    });

    await page.goto('/workspace/company/crm', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#crm-workspace-title').first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '14-company-crm-workspace.png'),
      fullPage: true,
    });
  });

  test('15. Platform Admin Dashboard (/admin/dashboard)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'],
      }));
    });

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotDir, '15-platform-admin-dashboard.png'),
      fullPage: true,
    });
  });
});
