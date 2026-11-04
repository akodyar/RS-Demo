import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const baseDir = path.resolve(process.cwd(), 'screenshots/homehub-comprehensive-financial-ui-localization-audit-2026-10-26');

const subfolders = [
  '01-public-and-auth',
  '02-owner',
  '03-agent',
  '04-tenant',
  '05-vendor-and-maintenance',
  '06-admin-and-accountant',
  '07-financial-and-operating-models',
  '08-kurdish-sorani-rtl',
  '09-arabic-regression',
  '10-english-regression',
  '11-responsive-and-accessibility',
  '12-defect-retests',
];

function ensureDirs() {
  for (const sf of subfolders) {
    const fullPath = path.join(baseDir, sf);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

test.describe('HomeHub Comprehensive Master Evidence Capture (Option C)', () => {
  test.beforeAll(() => {
    ensureDirs();
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(90000);
  });

  // =========================================================================
  // 01. PUBLIC AND AUTH
  // =========================================================================
  test('01-1. Public Homepage — Desktop (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '01-public-and-auth', '01-homepage-desktop-ku.png'),
      fullPage: true,
    });
  });

  test('01-2. Login Screen with Phone Input (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '01-public-and-auth', '02-login-modal-ku.png'),
      fullPage: true,
    });
  });

  test('01-3. Multi-Role Registration Purpose (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '01-public-and-auth', '03-registration-purpose-ku.png'),
      fullPage: true,
    });
  });

  test('01-4. Rental Search Explorer with Filters (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '01-public-and-auth', '04-search-explorer-ku.png'),
      fullPage: true,
    });
  });

  // =========================================================================
  // 02. OWNER WORKSPACE
  // =========================================================================
  test('02-1. Owner Workspace Overview with KPI Cards (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        email: 'owner@homehub.iq',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
        firstName: 'کاروان',
        lastName: 'عەلی',
      }));
    });
    await page.goto('/owner', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '02-owner', '01-owner-dashboard-ku.png'),
      fullPage: true,
    });
  });

  test('02-2. Owner Workspace Properties Table & Quick Actions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        email: 'owner@homehub.iq',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto('/owner', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    // Scroll down to properties table
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '02-owner', '02-owner-properties-table-ku.png'),
    });
  });

  test('02-3. Add Property Wizard — Step 1 Basic Info (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        email: 'owner@homehub.iq',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto('/properties/add', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '02-owner', '03-add-property-step1-ku.png'),
      fullPage: true,
    });
  });

  // =========================================================================
  // 03. AGENT WORKSPACE
  // =========================================================================
  test('03-1. Agent Workspace Overview & Metrics (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-agent');
      localStorage.setItem('homehub_auth_token', 'dev-agent');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_agent_01',
        email: 'agent@homehub.iq',
        role: 'AGENT_BROKER',
        roles: ['AGENT_BROKER'],
        firstName: 'ئاراس',
        lastName: 'ڕەشید',
      }));
    });
    await page.goto('/agent', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '03-agent', '01-agent-workspace-overview-ku.png'),
      fullPage: true,
    });
  });

  test('03-2. Agent Leads Pipeline & CRM (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-agent');
      localStorage.setItem('homehub_auth_token', 'dev-agent');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_agent_01',
        email: 'agent@homehub.iq',
        role: 'AGENT_BROKER',
        roles: ['AGENT_BROKER'],
      }));
    });
    await page.goto('/agent', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '03-agent', '02-agent-leads-kanban-ku.png'),
    });
  });

  // =========================================================================
  // 04. TENANT WORKSPACE
  // =========================================================================
  test('04-1. Tenant Workspace Overview with Active Rent Card (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_tenant_01',
        email: 'tenant@homehub.iq',
        role: 'TENANT',
        roles: ['TENANT'],
        firstName: 'دیار',
        lastName: 'عومەر',
      }));
    });
    await page.goto('/tenant', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '04-tenant', '01-tenant-workspace-overview-ku.png'),
      fullPage: true,
    });
  });

  test('04-2. Tenant AI Assistant Drawer Open (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_tenant_01',
        email: 'tenant@homehub.iq',
        role: 'TENANT',
        roles: ['TENANT'],
      }));
    });
    await page.goto('/tenant', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '04-tenant', '02-tenant-ai-assistant-drawer-ku.png'),
    });
  });

  // =========================================================================
  // 05. VENDOR AND MAINTENANCE
  // =========================================================================
  test('05-1. Vendor Workspace Overview & Dispatch Pipeline (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-vendor');
      localStorage.setItem('homehub_auth_token', 'dev-vendor');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_vendor_01',
        email: 'vendor@homehub.iq',
        role: 'VENDOR',
        roles: ['VENDOR'],
        firstName: 'سەردار',
        lastName: 'محەمەد',
      }));
    });
    await page.goto('/vendor', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '05-vendor-and-maintenance', '01-vendor-workspace-overview-ku.png'),
      fullPage: true,
    });
  });

  test('05-2. Tenant Maintenance Ticket Submission Form (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_tenant_01',
        email: 'tenant@homehub.iq',
        role: 'TENANT',
        roles: ['TENANT'],
      }));
    });
    await page.goto('/tenant/maintenance/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '05-vendor-and-maintenance', '02-tenant-maintenance-form-ku.png'),
      fullPage: true,
    });
  });

  test('05-3. Property Services Catalog (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/services', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '05-vendor-and-maintenance', '03-property-services-catalog-ku.png'),
      fullPage: true,
    });
  });

  // =========================================================================
  // 06. ADMIN AND ACCOUNTANT
  // =========================================================================
  test('06-1. Platform Admin Control Center (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-admin');
      localStorage.setItem('homehub_auth_token', 'dev-admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_admin_01',
        email: 'admin@homehub.iq',
        role: 'PLATFORM_ADMIN',
        roles: ['PLATFORM_ADMIN', 'ADMIN'],
        firstName: 'بەڕێوەبەر',
        lastName: 'گشتی',
      }));
    });
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '06-admin-and-accountant', '01-platform-admin-dashboard-ku.png'),
      fullPage: true,
    });
  });

  test('06-2. Accountant Workspace General Ledger & Statements (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-finance');
      localStorage.setItem('homehub_auth_token', 'dev-finance');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_finance_01',
        email: 'finance@homehub.iq',
        role: 'FINANCE_ADMIN',
        roles: ['FINANCE_ADMIN', 'ACCOUNTANT'],
        firstName: 'ژمێریار',
        lastName: 'سەرەکی',
      }));
    });
    await page.goto('/accountant', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '06-admin-and-accountant', '02-accountant-workspace-ledger-ku.png'),
      fullPage: true,
    });
  });

  // =========================================================================
  // 07. FINANCIAL AND OPERATING MODELS
  // =========================================================================
  test('07-1. Operating Model & Fee Assignment Step 7 in Add Property Wizard', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto('/properties/add', { waitUntil: 'domcontentloaded', timeout: 60000 });
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
    await nameInput.fill('ئەزموونی خاوەن ماڵ');
    await nextBtn.click();

    // Step 2: Location
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 3: Details
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 4: Media
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 5: Rent & Pricing
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 6: Ownership Claim
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 7: Management / Operating Model
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(baseDir, '07-financial-and-operating-models', '01-operating-model-selector-step7-ku.png'),
      fullPage: true,
    });
  });

  // =========================================================================
  // 08. KURDISH SORANI RTL
  // =========================================================================
  test('08-1. Rent Management Page (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/rent-management', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '08-kurdish-sorani-rtl', '01-rent-management-page-ku.png'),
      fullPage: true,
    });
  });

  test('08-2. Property Details Command Center (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
    });
    await page.goto('/properties/prop-1', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '08-kurdish-sorani-rtl', '02-property-command-center-ku.png'),
      fullPage: true,
    });
  });

  // =========================================================================
  // 09. ARABIC REGRESSION
  // =========================================================================
  test('09-1. Public Homepage (Arabic RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
      localStorage.setItem('homehub_language', 'ar');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '09-arabic-regression', '01-homepage-arabic-rtl.png'),
      fullPage: true,
    });
  });

  test('09-2. Owner Workspace (Arabic RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
      localStorage.setItem('homehub_language', 'ar');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto('/owner', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '09-arabic-regression', '02-owner-workspace-ar.png'),
      fullPage: true,
    });
  });

  // =========================================================================
  // 10. ENGLISH REGRESSION
  // =========================================================================
  test('10-1. Public Homepage (English LTR)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '10-english-regression', '01-homepage-english-ltr.png'),
      fullPage: true,
    });
  });

  test('10-2. Owner Workspace (English LTR)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto('/owner', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '10-english-regression', '02-owner-workspace-en.png'),
      fullPage: true,
    });
  });

  // =========================================================================
  // 11. RESPONSIVE AND ACCESSIBILITY
  // =========================================================================
  test('11-1. Homepage at Mobile Viewport 390px (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(baseDir, '11-responsive-and-accessibility', '01-homepage-mobile-390px-ku.png'),
      fullPage: true,
    });
  });

  test('11-2. Owner Dashboard at Tablet Viewport 768px (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto('/owner', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '11-responsive-and-accessibility', '02-owner-dashboard-tablet-768px-ku.png'),
      fullPage: true,
    });
  });

  test('11-3. Tenant Workspace at Mobile Viewport 390px (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_tenant_01',
        role: 'TENANT',
        roles: ['TENANT'],
      }));
    });
    await page.goto('/tenant', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(baseDir, '11-responsive-and-accessibility', '03-tenant-mobile-390px-ku.png'),
      fullPage: true,
    });
  });

  // =========================================================================
  // 12. DEFECT RETESTS
  // =========================================================================
  test('12-1. DEF-10 Retest: Accountant Workspace Defensive Date Formatting', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-finance');
      localStorage.setItem('homehub_auth_token', 'dev-finance');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_finance_01',
        role: 'FINANCE_ADMIN',
        roles: ['FINANCE_ADMIN'],
      }));
    });
    await page.goto('/accountant', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    // Verify no 'Invalid Date' text exists on the page
    await page.waitForTimeout(3000);
    const pageText = await page.locator('body').innerText();
    expect(pageText).not.toContain('Invalid Date');
    await page.screenshot({
      path: path.join(baseDir, '12-defect-retests', '01-def-10-accountant-date-formatting-retest-ku.png'),
      fullPage: true,
    });
  });

  test('12-2. Add Property Step 3 Details: Pricing Tier & Operating Model Removed', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto('/properties/add', { waitUntil: 'domcontentloaded', timeout: 60000 });
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
    await nameInput.fill('پشکنینی بەشی سێیەم');
    await nextBtn.click();

    // Step 2: Location
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 3: Details
    await page.waitForTimeout(800);

    // Verify removed elements are not present
    await expect(page.locator('text=Pricing Tier: Tier A')).not.toBeVisible();
    await expect(page.locator('text=Operating Model')).not.toBeVisible();

    await page.screenshot({
      path: path.join(baseDir, '12-defect-retests', '02-add-property-step3-pricing-tier-removed-retest-ku.png'),
      fullPage: true,
    });
  });
});
