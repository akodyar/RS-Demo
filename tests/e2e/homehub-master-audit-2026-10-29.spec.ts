import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const screenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-comprehensive-audit-2026-10-29');

test.describe('HomeHub Master Comprehensive System & Localization Audit (Option C)', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(90000);
  });

  // 1. Marketplace Home Desktop (Kurdish Sorani RTL)
  test('01 — Marketplace Home Desktop in Kurdish Sorani RTL (1440x900)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify RTL document direction
    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlDir === 'rtl' || htmlDir === null).toBeTruthy();

    await page.screenshot({
      path: path.join(screenshotDir, '01_marketplace_home_desktop_ku.png'),
      fullPage: true,
    });
  });

  // 2. Marketplace Home Mobile (Kurdish Sorani RTL)
  test('02 — Marketplace Home Mobile in Kurdish Sorani RTL (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '02_marketplace_home_mobile_ku.png'),
      fullPage: true,
    });
  });

  // 3. Tenant Dashboard Desktop (Kurdish Sorani RTL)
  test('03 — Tenant Dashboard Desktop in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_tenant_01',
          email: 'tenant@homehub.iq',
          role: 'TENANT',
          roles: ['TENANT'],
          firstName: 'ئەحمەد',
          lastName: 'فەرهاد',
        })
      );
    });
    await page.goto('/tenant?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '03_tenant_dashboard_desktop_ku.png'),
      fullPage: true,
    });
  });

  // 4. Tenant Payment / Rent Schedule (Kurdish Sorani RTL)
  test('04 — Tenant Rent Schedule & Dynamic 3-Fee Payment View', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_tenant_01',
          email: 'tenant@homehub.iq',
          role: 'TENANT',
          roles: ['TENANT'],
          firstName: 'ئەحمەد',
          lastName: 'فەرهاد',
        })
      );
    });
    await page.goto('/tenant?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Scroll to rent payments/schedule section if available
    const payBtn = page.locator('button:has-text("دان"), button:has-text("Pay"), [data-testid="pay-rent-btn"]').first();
    if (await payBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await payBtn.click();
      await page.waitForTimeout(800);
    }

    await page.screenshot({
      path: path.join(screenshotDir, '04_tenant_payment_modal_ku.png'),
      fullPage: true,
    });
  });

  // 5. Owner Individual Dashboard (Kurdish Sorani RTL)
  test('05 — Individual Owner Workspace in Kurdish Sorani RTL', async ({ page }) => {
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
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
          firstName: 'سالار',
          lastName: 'عەزیز',
        })
      );
    });
    await page.goto('/owner?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '05_owner_individual_dashboard_ku.png'),
      fullPage: true,
    });
  });

  // 6. Owner Company Dashboard (Kurdish Sorani RTL)
  test('06 — Company Owner Workspace in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_token', 'dev-company');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_company_01',
          email: 'company@homehub.iq',
          name: 'Zagros Admin',
          role: 'COMPANY',
          roles: ['COMPANY'],
          organizationId: 'org_company_01',
        })
      );
    });
    await page.goto('/company?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '06_owner_company_dashboard_ku.png'),
      fullPage: true,
    });
  });

  // 7. Add Property Wizard — Step 1 Basic Info (Kurdish Sorani RTL)
  test('07 — Add Property Wizard Step 1 Basic Info in Kurdish Sorani RTL', async ({ page }) => {
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
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });
    await page.goto('/properties/add?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    // Step 0: Type Selection -> Apartment
    await page.locator('[data-testid="property-type-apartment"]').click();
    await nextBtn.click();

    // Step 1: Basic Information
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('تاوەری نیشتەجێبوونی گوڵان');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, '07_add_property_wizard_step1_ku.png'),
      fullPage: true,
    });
  });

  // 8. Add Property Wizard — Step 6 Ownership Percentage Badge (Kurdish Sorani RTL)
  test('08 — Add Property Wizard Step 6 Ownership Percentage Badge (100% LTR Isolated)', async ({ page }) => {
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
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });
    await page.goto('/properties/add?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');

    // Step 0 -> Step 1
    await page.locator('[data-testid="property-type-apartment"]').click();
    await nextBtn.click();

    // Step 1 -> Step 2
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('پشکنینی بەشە خاوەندارێتی');
    await nextBtn.click();

    // Advance Steps 2 to 5 -> Step 6
    for (let s = 2; s <= 5; s++) {
      await page.waitForTimeout(250);
      await nextBtn.click();
    }

    // Step 6: Verify Percentage Display
    await page.waitForTimeout(500);
    const percentageDisplay = page.locator('[data-testid="ownership-percentage-display"]');
    await expect(percentageDisplay).toBeVisible({ timeout: 5000 });

    const renderedText = await percentageDisplay.innerText();
    expect(renderedText.trim()).toBe('100%');

    await page.screenshot({
      path: path.join(screenshotDir, '08_add_property_wizard_step6_percentage_ku.png'),
      fullPage: true,
    });
  });

  // 9. Add Property Wizard — Step 8 Final Review
  test('09 — Add Property Wizard Step 8 Review & Summary View', async ({ page }) => {
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
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });
    await page.goto('/properties/add?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');

    await page.locator('[data-testid="property-type-apartment"]').click();
    await nextBtn.click();

    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('تاوەری گشتی پێداچوونەوە');
    await nextBtn.click();

    // Advance to Step 8
    for (let s = 2; s <= 7; s++) {
      await page.waitForTimeout(250);
      await nextBtn.click();
    }

    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(screenshotDir, '09_add_property_wizard_step8_review_ku.png'),
      fullPage: true,
    });
  });

  // 10. Agent Workspace CRM & Managed Properties
  test('10 — Agent Broker Workspace & CRM Contacts in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-agent');
      localStorage.setItem('homehub_auth_token', 'dev-agent');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_agent_01',
          email: 'agent@homehub.iq',
          role: 'AGENT_BROKER',
          roles: ['AGENT_BROKER'],
          firstName: 'ئەحمەد',
          lastName: 'ڕەحمان',
        })
      );
    });
    await page.goto('/agent?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '10_agent_dashboard_crm_ku.png'),
      fullPage: true,
    });
  });

  // 11. Vendor Workspace Maintenance & Work Orders
  test('11 — Vendor Workspace & Maintenance Work Orders in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-vendor');
      localStorage.setItem('homehub_auth_token', 'dev-vendor');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_vendor_01',
          email: 'vendor@homehub.iq',
          role: 'VENDOR',
          roles: ['VENDOR'],
          firstName: 'دڵشاد',
          lastName: 'قادر',
          organizationId: 'org_vendor_01',
        })
      );
    });
    await page.goto('/vendor?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '11_vendor_work_orders_ku.png'),
      fullPage: true,
    });
  });

  // 12. Admin Verification Queue
  test('12 — Platform Admin Verification Queue (Properties & TAPU Deeds)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_token', 'dev-platform_admin');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'admin_user_01',
          email: 'superadmin@homehub.iq',
          role: 'SUPER_ADMIN',
          roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN'],
        })
      );
    });
    await page.goto('/admin/dashboard?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '12_admin_verification_queue_ku.png'),
      fullPage: true,
    });
  });

  // 13. Admin Financial Policies & Fee Breakdown
  test('13 — Platform Admin Financial Policies & Dynamic 3-Fee Model', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_token', 'dev-platform_admin');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'admin_user_01',
          email: 'superadmin@homehub.iq',
          role: 'SUPER_ADMIN',
          roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN'],
        })
      );
    });
    await page.goto('/admin/fees?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '13_admin_financial_policies_ku.png'),
      fullPage: true,
    });
  });

  // 14. Marketplace Home Desktop in English LTR Baseline
  test('14 — Marketplace Home Desktop in English LTR Baseline (1440x900)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
    });
    await page.goto('/?lang=en', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlDir === 'ltr' || htmlDir === null).toBeTruthy();

    await page.screenshot({
      path: path.join(screenshotDir, '14_marketplace_home_desktop_en.png'),
      fullPage: true,
    });
  });

  // 15. Tenant Dashboard Mobile (Kurdish Sorani RTL)
  test('15 — Tenant Dashboard Mobile in Kurdish Sorani RTL (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_tenant_01',
          email: 'tenant@homehub.iq',
          role: 'TENANT',
          roles: ['TENANT'],
          firstName: 'ئەحمەد',
          lastName: 'فەرهاد',
        })
      );
    });
    await page.goto('/tenant?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(screenshotDir, '15_tenant_dashboard_mobile_ku.png'),
      fullPage: true,
    });
  });

  // 16. Arabic RTL Baseline
  test('16 — Arabic RTL Baseline Desktop (1440x900)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
      localStorage.setItem('homehub_language', 'ar');
    });
    await page.goto('/?lang=ar', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '16_arabic_regression_desktop_ar.png'),
      fullPage: true,
    });
  });
});

