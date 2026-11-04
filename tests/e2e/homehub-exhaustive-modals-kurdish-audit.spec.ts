import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const screenshotDir = path.resolve(process.cwd(), 'screenshots/kurdish-full-audit-2026-10-29');

test.describe('HomeHub Interactive Modals & Popups Kurdish Sorani (ku) RTL Visual Audit', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(90000);
  });

  // M1: Tenant Pay Rent Modal
  test('M01 — Tenant Pay Monthly Rent Modal with 0% Surcharge in Kurdish Sorani RTL', async ({ page }) => {
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
        firstName: 'ئەحمەد',
        lastName: 'فەرهاد',
      }));
    });

    await page.goto('/tenant?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="workspace-loader"]')).toHaveCount(0, { timeout: 15000 });
    await page.waitForTimeout(1000);

    const payBtn = page.locator('[data-testid="btn-pay-rent-card-action"], #btn-rent-due-pay-now, button:has-text("ئێستا کڕێ بدە")').first();
    if (await payBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await payBtn.click();
      await page.waitForTimeout(800);
    }

    await page.screenshot({
      path: path.join(screenshotDir, '39_modal_tenant_pay_rent_ku.png'),
    });
  });

  // M2: Tenant Review & Rating Modal
  test('M02 — Tenant Review & Rating Modal in Kurdish Sorani RTL', async ({ page }) => {
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

    await page.goto('/tenant?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('[data-testid="workspace-loader"]')).toHaveCount(0, { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Switch to lease tab
    const leaseNav = page.locator('button:has-text("گرێبەستەکەم"), [data-testid="tab-lease"]').first();
    if (await leaseNav.isVisible({ timeout: 5000 }).catch(() => false)) {
      await leaseNav.click();
      await page.waitForTimeout(1200);
    }

    // Try finding review button
    const reviewBtn = page.locator('button:has-text("هەڵسەنگاندن"), button:has-text("Review"), [data-testid="open-review-modal-btn"]').first();
    if (await reviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reviewBtn.click();
      await page.waitForTimeout(800);
    }

    await page.screenshot({
      path: path.join(screenshotDir, '40_modal_tenant_review_ku.png'),
    });
  });

  // M3: Multi-Role Workspace Switcher Modal
  test('M03 — Multi-Role Workspace Switcher Modal in Kurdish Sorani RTL', async ({ page }) => {
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
        roles: ['PROPERTY_OWNER', 'TENANT'],
      }));
    });

    await page.goto('/owner?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Click Workspace Switcher in Header
    const switcherBtn = page.locator('[data-testid="workspace-switcher-btn"], button:has-text("شوێنی کار"), button:has-text("گۆڕینی شوێنی کار")').first();
    if (await switcherBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await switcherBtn.click();
      await page.waitForTimeout(600);
    }

    await page.screenshot({
      path: path.join(screenshotDir, '41_modal_workspace_switcher_ku.png'),
    });
  });

  // M4: Points Purchase / Sponsorship Modal
  test('M04 — Points Purchase & Wallet Modal in Kurdish Sorani RTL', async ({ page }) => {
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

    await page.goto('/agent?tab=points&lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const pointsBtn = page.locator('[data-testid="purchase-points-btn"]').first();
    if (await pointsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pointsBtn.click();
      await page.waitForTimeout(800);
    }

    await page.screenshot({
      path: path.join(screenshotDir, '42_modal_points_purchase_ku.png'),
    });
  });

  // M5: Owner Move-Out Deposit Deduction Inspection Modal
  test('M05 — Owner Deposit Deduction & Move-out Inspection Modal in Kurdish Sorani RTL', async ({ page }) => {
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

    await page.goto('/owner?tab=leases&lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1200);

    const deductBtn = page.locator('[id^="btn-deposit-inspections-"], button:has-text("بارمتە")').first();
    if (await deductBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deductBtn.click();
      await page.waitForTimeout(800);
    }

    await page.screenshot({
      path: path.join(screenshotDir, '43_modal_owner_deposit_deduction_ku.png'),
    });
  });
});

