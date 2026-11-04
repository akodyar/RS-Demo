import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const baseDir = path.resolve(
  process.cwd(),
  'screenshots/homehub-comprehensive-financial-ui-localization-audit-2026-10-26/continuation-deep-verification'
);

function ensureDir() {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
}

test.describe('HomeHub Deep Post-Audit Verification & UI Expansion (Option C)', () => {
  test.beforeAll(() => {
    ensureDir();
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(90000);
  });

  // -------------------------------------------------------------------------
  // 1. PUBLIC RENTALS EXPLORER & MARKETPLACE
  // -------------------------------------------------------------------------
  test('EXP-01. Public Rentals Marketplace (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify search and rental filter elements
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('سلێمانی');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(baseDir, '01-rentals-marketplace-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 2. PROPERTY COMMAND CENTER INTERACTIVE
  // -------------------------------------------------------------------------
  test('EXP-02. Property Command Center Detailed View (Kurdish Sorani RTL)', async ({ page }) => {
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
    await page.goto('/properties/prop-1', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(baseDir, '02-property-command-center-interactive-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 3. OWNER WORKSPACE LEASES TAB
  // -------------------------------------------------------------------------
  test('EXP-03. Owner Workspace Leases & Tenancies Tab (Kurdish Sorani RTL)', async ({ page }) => {
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
    await page.waitForTimeout(1000);

    // Look for leases tab or scroll to section
    const leasesBtn = page.locator('button:has-text("کڕێنشینان"), button:has-text("گرێبەستەکان"), [data-testid="owner-tab-leases"]').first();
    if (await leasesBtn.isVisible()) {
      await leasesBtn.click();
      await page.waitForTimeout(800);
    }

    await page.screenshot({
      path: path.join(baseDir, '03-owner-leases-tab-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 4. OWNER WORKSPACE SETTLEMENTS & FINANCE TAB
  // -------------------------------------------------------------------------
  test('EXP-04. Owner Workspace Settlements & Financial Reporting (Kurdish Sorani RTL)', async ({ page }) => {
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
    await page.waitForTimeout(1000);

    const financeBtn = page.locator('button:has-text("داهات"), button:has-text("ڕاپۆرتەکان"), [data-testid="owner-tab-finance"]').first();
    if (await financeBtn.isVisible()) {
      await financeBtn.click();
      await page.waitForTimeout(800);
    }

    await page.screenshot({
      path: path.join(baseDir, '04-owner-settlements-tab-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 5. STEP 7 DEEP DIVE: FULLY_MANAGED
  // -------------------------------------------------------------------------
  test('EXP-05. Step 7 Operating Model: FULLY_MANAGED with Both Fee Inputs (Kurdish Sorani RTL)', async ({ page }) => {
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

    // Step 0 -> Step 7
    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });
    await aptBtn.click();
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.click();

    // Step 1
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('شووقەی گەشتیاری');
    await nextBtn.click();

    // Step 2-6
    for (let i = 2; i <= 6; i++) {
      await page.waitForTimeout(300);
      await nextBtn.click();
    }

    // Step 7
    await page.waitForTimeout(1000);
    const fullyManagedCard = page.locator('[data-testid="op-model-fully-managed"]');
    await expect(fullyManagedCard).toBeVisible({ timeout: 5000 });
    await fullyManagedCard.click();

    // Assert both fee inputs are visible
    const mgmtFeeInput = page.locator('[data-testid="agreed-mgmt-fee-input"]');
    const rentFeeInput = page.locator('[data-testid="agreed-rent-fee-input"]');
    await expect(mgmtFeeInput).toBeVisible({ timeout: 5000 });
    await expect(rentFeeInput).toBeVisible({ timeout: 5000 });

    await mgmtFeeInput.fill('10');
    await rentFeeInput.fill('5');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(baseDir, '05-add-property-step7-fully-managed-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 6. STEP 7 DEEP DIVE: AGENT_LISTED_PLATFORM_MANAGED
  // -------------------------------------------------------------------------
  test('EXP-06. Step 7 Operating Model: AGENT_LISTED (Rent Fee Omitted)', async ({ page }) => {
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

    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });
    await aptBtn.click();
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.click();

    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('ڤێلای ئارام');
    await nextBtn.click();

    for (let i = 2; i <= 6; i++) {
      await page.waitForTimeout(300);
      await nextBtn.click();
    }

    await page.waitForTimeout(1000);
    const agentListedCard = page.locator('[data-testid="op-model-agent-listed"]');
    await expect(agentListedCard).toBeVisible({ timeout: 5000 });
    await agentListedCard.click();

    // Management fee must be visible, Rent fee must NOT be visible
    const mgmtFeeInput = page.locator('[data-testid="agreed-mgmt-fee-input"]');
    const rentFeeInput = page.locator('[data-testid="agreed-rent-fee-input"]');
    await expect(mgmtFeeInput).toBeVisible({ timeout: 5000 });
    await expect(rentFeeInput).not.toBeVisible();

    await mgmtFeeInput.fill('8.5');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(baseDir, '06-add-property-step7-agent-listed-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 7. STEP 7 DEEP DIVE: AGENT_OPERATED
  // -------------------------------------------------------------------------
  test('EXP-07. Step 7 Operating Model: AGENT_OPERATED (Both Fee Inputs Omitted)', async ({ page }) => {
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

    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });
    await aptBtn.click();
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.click();

    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('خانووی ئاراس');
    await nextBtn.click();

    for (let i = 2; i <= 6; i++) {
      await page.waitForTimeout(300);
      await nextBtn.click();
    }

    await page.waitForTimeout(1000);
    const agentOperatedCard = page.locator('[data-testid="op-model-agent-operated"]');
    await expect(agentOperatedCard).toBeVisible({ timeout: 5000 });
    await agentOperatedCard.click();

    // In AGENT_OPERATED, neither rent fee nor mgmt fee inputs are shown (Platform fee only)
    const mgmtFeeInput = page.locator('[data-testid="agreed-mgmt-fee-input"]');
    const rentFeeInput = page.locator('[data-testid="agreed-rent-fee-input"]');
    await expect(mgmtFeeInput).not.toBeVisible();
    await expect(rentFeeInput).not.toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(baseDir, '07-add-property-step7-agent-operated-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 8. TENANT LEASE DETAILS
  // -------------------------------------------------------------------------
  test('EXP-08. Tenant Workspace Active Lease Terms (Kurdish Sorani RTL)', async ({ page }) => {
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
    await page.waitForTimeout(1000);

    // Scroll to active lease details
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(baseDir, '08-tenant-lease-details-ku.png'),
    });
  });

  // -------------------------------------------------------------------------
  // 9. TENANT PAY RENT MODAL — 0% SURCHARGE VERIFICATION
  // -------------------------------------------------------------------------
  test('EXP-09. Tenant Pay Rent Modal Zero Surcharge Verification', async ({ page }) => {
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
    await page.waitForTimeout(1000);

    // Click Pay Rent button if present
    const payBtn = page.locator('button:has-text("پارەدان"), button:has-text("دانی کرێ"), [data-testid="pay-rent-btn"]').first();
    if (await payBtn.isVisible()) {
      await payBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(baseDir, '09-tenant-pay-rent-modal-zero-surcharge-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 10. AGENT WORKSPACE AGREEMENTS TAB
  // -------------------------------------------------------------------------
  test('EXP-10. Agent Workspace Portfolio & Listing Agreements', async ({ page }) => {
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
    await page.waitForTimeout(1000);

    // Scroll to listing agreements table
    await page.evaluate(() => window.scrollBy(0, 700));
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(baseDir, '10-agent-agreements-tab-ku.png'),
    });
  });

  // -------------------------------------------------------------------------
  // 11. MANAGEMENT COMPANY WORKSPACE DASHBOARD
  // -------------------------------------------------------------------------
  test('EXP-11. Management Company Workspace Dashboard (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_company_01',
        email: 'company@homehub.iq',
        role: 'COMPANY_ADMIN',
        roles: ['COMPANY_ADMIN', 'MANAGEMENT_COMPANY'],
        firstName: 'کۆمپانیای',
        lastName: 'نیشتیمان',
        companyName: 'کۆمپانیای نیشتیمان بۆ بەڕێوەبردنی موڵک',
      }));
    });
    await page.goto('/company', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(baseDir, '11-company-workspace-dashboard-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 12. MANAGEMENT COMPANY CRM & COMMUNICATIONS
  // -------------------------------------------------------------------------
  test('EXP-12. Company CRM & Tenant Communications (Kurdish Sorani RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_company_01',
        email: 'company@homehub.iq',
        role: 'COMPANY_ADMIN',
        roles: ['COMPANY_ADMIN'],
      }));
    });
    await page.goto('/company/crm', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(baseDir, '12-company-crm-communications-ku.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 13. ADMIN DYNAMIC FEE POLICY CONTROLS
  // -------------------------------------------------------------------------
  test('EXP-13. Platform Admin Fee Policy Module (Kurdish Sorani RTL)', async ({ page }) => {
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
        roles: ['PLATFORM_ADMIN'],
        firstName: 'بەڕێوەبەر',
        lastName: 'گشتی',
      }));
    });
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Scroll to fee policy module
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(baseDir, '13-admin-fee-policy-sliders-ku.png'),
    });
  });

  // -------------------------------------------------------------------------
  // 14. ACCOUNTANT DEPOSIT ESCROW SEGREGATION
  // -------------------------------------------------------------------------
  test('EXP-14. Accountant Workspace Deposit Escrow & Balance Sheet', async ({ page }) => {
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
        roles: ['FINANCE_ADMIN'],
        firstName: 'ژمێریار',
        lastName: 'سەرەکی',
      }));
    });
    await page.goto('/accountant', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Scroll down to examine Account 2100 & Ledger lines
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(baseDir, '14-accountant-deposit-escrow-segregation-ku.png'),
    });
  });

  // -------------------------------------------------------------------------
  // 15. ARABIC REGRESSION — COMPANY WORKSPACE
  // -------------------------------------------------------------------------
  test('EXP-15. Company Workspace (Arabic RTL Regression)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
      localStorage.setItem('homehub_language', 'ar');
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_company_01',
        role: 'COMPANY_ADMIN',
        roles: ['COMPANY_ADMIN'],
      }));
    });
    await page.goto('/company', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(baseDir, '15-company-workspace-ar.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 16. ENGLISH REGRESSION — COMPANY WORKSPACE
  // -------------------------------------------------------------------------
  test('EXP-16. Company Workspace (English LTR Regression)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_company_01',
        role: 'COMPANY_ADMIN',
        roles: ['COMPANY_ADMIN'],
      }));
    });
    await page.goto('/company', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(baseDir, '16-company-workspace-en.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 17. ARABIC REGRESSION — RENTALS EXPLORER
  // -------------------------------------------------------------------------
  test('EXP-17. Rentals Explorer (Arabic RTL Regression)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
      localStorage.setItem('homehub_language', 'ar');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(baseDir, '17-rentals-marketplace-ar.png'),
      fullPage: true,
    });
  });

  // -------------------------------------------------------------------------
  // 18. ENGLISH REGRESSION — RENTALS EXPLORER
  // -------------------------------------------------------------------------
  test('EXP-18. Rentals Explorer (English LTR Regression)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
    });
    await page.goto('/rentals', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(baseDir, '18-rentals-marketplace-en.png'),
      fullPage: true,
    });
  });
});
