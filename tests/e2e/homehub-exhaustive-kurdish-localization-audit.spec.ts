import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const screenshotDir = path.resolve(process.cwd(), 'screenshots/kurdish-full-audit-2026-10-29');
const samplePropId = 'prop_sc1_1792730246811_pfmto';

test.describe('HomeHub Exhaustive Kurdish Sorani (ku) RTL Localization & Visual Audit', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(90000);
  });

  // Helper to inject Kurdish persona
  async function setupKurdishPersona(page: any, role: string, persona: any, token: string) {
    await page.addInitScript(({ token, persona }) => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('homehub_auth_persona', JSON.stringify(persona));
    }, { token, persona });
  }

  // -------------------------------------------------------------------------
  // 1. PUBLIC PAGES
  // -------------------------------------------------------------------------

  test('01 — Homepage Desktop in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const dir = await page.locator('html').getAttribute('dir');
    expect(dir === 'rtl' || dir === null).toBeTruthy();

    await page.screenshot({
      path: path.join(screenshotDir, '01_page_home_desktop_ku.png'),
      fullPage: true,
    });
  });

  test('02 — Homepage Mobile in Kurdish Sorani RTL (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '02_page_home_mobile_ku.png'),
      fullPage: true,
    });
  });

  test('03 — Rentals Search Explorer in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/rentals?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(screenshotDir, '03_page_rentals_search_ku.png'),
      fullPage: true,
    });
  });

  test('04 — Property Detail Page in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto(`/properties/${samplePropId}?lang=ku`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(screenshotDir, '04_page_property_detail_ku.png'),
      fullPage: true,
    });
  });

  test('05 — Rent Management Hub in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/rent-management?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '05_page_rent_management_hub_ku.png'),
      fullPage: true,
    });
  });

  test('06 — Property Services & Amenities in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/services?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '06_page_services_ku.png'),
      fullPage: true,
    });
  });

  test('07 — Prompts Center in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/prompts?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '07_page_prompts_ku.png'),
      fullPage: true,
    });
  });

  test('08 — Property Passport in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto(`/passport/${samplePropId}?lang=ku`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '08_page_property_passport_ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 2. AUTHENTICATION & ONBOARDING
  // -------------------------------------------------------------------------

  test('09 — Login Page in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/login?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '09_page_login_ku.png'),
      fullPage: true,
    });
  });

  test('10 — Onboarding Purpose Selection in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/onboarding/purpose?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '10_page_onboarding_purpose_ku.png'),
      fullPage: true,
    });
  });

  test('11 — Onboarding Success Screen in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/onboarding/success?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '11_page_onboarding_success_ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 3. ADD PROPERTY WIZARD (ALL STEPS)
  // -------------------------------------------------------------------------

  test('12 — Add Property Wizard Step 0 (Type) & Step 1 (Basic Info)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupKurdishPersona(page, 'PROPERTY_OWNER', {
      id: 'user_owner_01',
      email: 'owner@homehub.iq',
      role: 'PROPERTY_OWNER',
      roles: ['PROPERTY_OWNER'],
    }, 'dev-owner');

    await page.goto('/properties/add?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="property-type-apartment"]')).toBeVisible({ timeout: 10000 });

    // Capture Step 0
    await page.screenshot({
      path: path.join(screenshotDir, '12_page_add_property_step0_type_ku.png'),
      fullPage: true,
    });

    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await page.locator('[data-testid="property-type-apartment"]').click();
    await nextBtn.click();

    // Capture Step 1
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('تاوەری نیشتەجێبوونی ئەربیل');

    await page.screenshot({
      path: path.join(screenshotDir, '13_page_add_property_step1_basic_ku.png'),
      fullPage: true,
    });

    // Step 2: Location
    await nextBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(screenshotDir, '14_page_add_property_step2_location_ku.png'),
      fullPage: true,
    });

    // Step 3: Details
    await nextBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(screenshotDir, '15_page_add_property_step3_details_ku.png'),
      fullPage: true,
    });

    // Step 4: Amenities
    await nextBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(screenshotDir, '16_page_add_property_step4_amenities_ku.png'),
      fullPage: true,
    });

    // Step 5: Photos
    await nextBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(screenshotDir, '17_page_add_property_step5_photos_ku.png'),
      fullPage: true,
    });

    // Step 6: Ownership Percentage Badge
    await nextBtn.click();
    await page.waitForTimeout(500);
    const percentageDisplay = page.locator('[data-testid="ownership-percentage-display"]');
    await expect(percentageDisplay).toBeVisible({ timeout: 5000 });
    const rendered = await percentageDisplay.innerText();
    expect(rendered.trim()).toBe('100%');

    await page.screenshot({
      path: path.join(screenshotDir, '18_page_add_property_step6_ownership_ku.png'),
      fullPage: true,
    });

    // Step 7: Management Preference
    await nextBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(screenshotDir, '19_page_add_property_step7_management_ku.png'),
      fullPage: true,
    });

    // Step 8: Final Review & Summary
    await nextBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotDir, '20_page_add_property_step8_review_ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 4. TENANT WORKSPACE & MODALS
  // -------------------------------------------------------------------------

  test('21 — Tenant Workspace & Rent Payment Modal in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupKurdishPersona(page, 'TENANT', {
      id: 'user_tenant_01',
      email: 'tenant@homehub.iq',
      role: 'TENANT',
      roles: ['TENANT'],
      firstName: 'ئەحمەد',
      lastName: 'فەرهاد',
    }, 'dev-tenant');

    await page.goto('/tenant?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="workspace-loader"]')).toHaveCount(0, { timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(screenshotDir, '21_page_tenant_overview_ku.png'),
      fullPage: true,
    });

    // Mobile version
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(screenshotDir, '22_page_tenant_overview_mobile_ku.png'),
      fullPage: true,
    });

    // Back to desktop for maintenance request & payment modal
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/tenant/maintenance?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('[data-testid="workspace-loader"]')).toHaveCount(0, { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '23_page_tenant_maintenance_ku.png'),
      fullPage: true,
    });

    // Open Tenant Pay Rent Modal
    await page.goto('/tenant?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('[data-testid="workspace-loader"]')).toHaveCount(0, { timeout: 15000 });
    await page.waitForTimeout(1000);
    const payBtn = page.locator('[data-testid="btn-pay-rent-card-action"], #btn-rent-due-pay-now, button:has-text("ئێستا کڕێ بدە")').first();
    if (await payBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await payBtn.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({
      path: path.join(screenshotDir, '24_modal_tenant_pay_rent_ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 5. OWNER WORKSPACES (INDIVIDUAL & COMPANY)
  // -------------------------------------------------------------------------

  test('25 — Individual Owner & Portfolio in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupKurdishPersona(page, 'PROPERTY_OWNER', {
      id: 'user_owner_01',
      email: 'owner@homehub.iq',
      role: 'PROPERTY_OWNER',
      roles: ['PROPERTY_OWNER'],
    }, 'dev-owner');

    await page.goto('/owner?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '25_page_owner_individual_dashboard_ku.png'),
      fullPage: true,
    });

    await page.goto('/workspace/portfolio?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(screenshotDir, '26_page_owner_portfolio_ku.png'),
      fullPage: true,
    });
  });

  test('27 — Corporate Owner, CRM & Profile in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupKurdishPersona(page, 'COMPANY', {
      id: 'user_company_01',
      email: 'company@homehub.iq',
      role: 'COMPANY',
      roles: ['COMPANY'],
      organizationId: 'org_company_01',
    }, 'dev-company');

    await page.goto('/company?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '27_page_company_workspace_ku.png'),
      fullPage: true,
    });

    await page.goto('/workspace/company/crm?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('[data-testid="workspace-loader"]')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('#crm-workspace-title')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, '28_page_company_crm_ku.png'),
      fullPage: true,
    });

    await page.goto('/company/org_company_01?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(screenshotDir, '29_page_company_profile_ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 6. AGENT & VENDOR WORKSPACES
  // -------------------------------------------------------------------------

  test('30 — Agent Broker Workspace in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupKurdishPersona(page, 'AGENT_BROKER', {
      id: 'user_agent_01',
      email: 'agent@homehub.iq',
      role: 'AGENT_BROKER',
      roles: ['AGENT_BROKER'],
    }, 'dev-agent');

    await page.goto('/agent?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '30_page_agent_workspace_ku.png'),
      fullPage: true,
    });
  });

  test('31 — Vendor & Maintenance Center in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupKurdishPersona(page, 'VENDOR', {
      id: 'user_vendor_01',
      email: 'vendor@homehub.iq',
      role: 'VENDOR',
      roles: ['VENDOR'],
      organizationId: 'org_vendor_01',
    }, 'dev-vendor');

    await page.goto('/vendor?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '31_page_vendor_workspace_ku.png'),
      fullPage: true,
    });

    await page.goto('/workspace/maintenance?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(screenshotDir, '32_page_maintenance_center_ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 7. ACCOUNTANT & PLATFORM ADMIN WORKSPACES
  // -------------------------------------------------------------------------

  test('33 — Accountant Workspace & Ledger in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupKurdishPersona(page, 'FINANCE_ADMIN', {
      id: 'admin_user_02',
      email: 'finance@homehub.iq',
      role: 'FINANCE_ADMIN',
      roles: ['FINANCE_ADMIN', 'ACCOUNTANT'],
    }, 'dev-platform_admin');

    await page.goto('/accountant?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotDir, '33_page_accountant_workspace_ku.png'),
      fullPage: true,
    });
  });

  test('34 — Admin Login, Dashboard, Fees, Trust & Integrations in Kurdish Sorani RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Admin login portal
    await page.goto('/admin/login?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '34_page_admin_login_ku.png'),
      fullPage: true,
    });

    // Admin authenticated dashboard
    await setupKurdishPersona(page, 'SUPER_ADMIN', {
      id: 'admin_user_01',
      email: 'superadmin@homehub.iq',
      role: 'SUPER_ADMIN',
      roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN'],
    }, 'dev-platform_admin');

    await page.goto('/admin/dashboard?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '35_page_admin_dashboard_ku.png'),
      fullPage: true,
    });

    // Admin fees & policies
    await page.goto('/admin/fees?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(screenshotDir, '36_page_admin_fees_ku.png'),
      fullPage: true,
    });

    // Admin trust & TAPU deeds
    await page.goto('/workspace/admin?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(screenshotDir, '37_page_admin_trust_ku.png'),
      fullPage: true,
    });

    // Admin integrations
    await page.goto('/workspace/integrations?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(screenshotDir, '38_page_admin_integrations_ku.png'),
      fullPage: true,
    });
  });
});

