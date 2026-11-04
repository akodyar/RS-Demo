import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

test.describe('Phase 58: Adversarial Security, Role Isolation & Responsive Viewports', () => {
  const runId = Date.now().toString(36);
  const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';

  // =========================================================================
  // 1. UNAUTHENTICATED ACCESS PROTECTION & REDIRECTS
  // =========================================================================
  test('1. Unauthenticated Access Block: Protected Workspaces Fallback to Login', async ({ page }) => {
    // Ensure clean state without tokens
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const protectedRoutes = [
      '/owner',
      '/agent',
      '/tenant',
      '/vendor',
      '/admin/dashboard',
      '/properties/add'
    ];

    for (const route of protectedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      // RequireAuth renders LoginPage when unauthenticated (showing HomeHub Welcome screen)
      await expect(page.locator('#welcome-signin-link')).toBeVisible({ timeout: 10000 });
      // Verify protected dashboard contents are NOT rendered
      await expect(page.locator('#add-property-form')).not.toBeVisible();
      await expect(page.locator('#owner-portfolio-grid')).not.toBeVisible();
      await expect(page.locator('#tenant-lease-card')).not.toBeVisible();
    }
  });

  // =========================================================================
  // 2. ROLE ISOLATION & ADVERSARIAL API AUTHORIZATION
  // =========================================================================
  test('2. Tenant Role Isolation: Prevented from Admin and Accounting Endpoints', async ({ page }) => {
    const tenantEmail = `tenant.adv.${runId}@homehub.iq`;
    const [tenant] = await db.insert(schema.users).values({
      id: `usr-adv-tenant-${runId}`,
      email: tenantEmail,
      firstName: 'Adversarial',
      lastName: `Tenant ${runId}`,
      roles: ['TENANT'],
      isActive: true,
      createdAt: new Date()
    }).returning();

    const tenantToken = jwt.sign(
      { id: tenant.id, email: tenant.email, roles: ['TENANT'], tokenVersion: 1 },
      jwtSecret
    );

    // 1. Tenant attempts to access admin endpoint -> must return 401/403
    const adminRes = await page.request.get('/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    expect([401, 403]).toContain(adminRes.status());

    // 2. Tenant attempts to access accounting endpoint -> must return 401/403
    const acctRes = await page.request.get('/api/financials/statements/trial-balance', {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    expect([401, 403]).toContain(acctRes.status());

    // 3. Tenant attempts to execute vendor work order creation -> must return 401/403
    const woRes = await page.request.post('/api/vendor/work-orders/status', {
      headers: { Authorization: `Bearer ${tenantToken}` },
      data: { status: 'COMPLETED' }
    });
    expect([401, 403, 404]).toContain(woRes.status());
  });

  // =========================================================================
  // 3. CROSS-TENANT ISOLATION
  // =========================================================================
  test('3. Cross-Tenant Data Isolation: Tenant A cannot access Tenant B leases', async ({ page }) => {
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.email, 'owner@homehub.iq'));

    // Create Property
    const propId = `prop-iso-${runId}`;
    await db.insert(schema.properties).values({
      id: propId,
      name: `Cross Isolation Prop ${runId}`,
      ownerId: owner.id,
      type: 'RESIDENTIAL',
      status: 'RENTED',
      operatingModel: 'FULLY_MANAGED'
    });

    // Create Tenant A
    const [tenantA] = await db.insert(schema.users).values({
      id: `usr-tenant-a-${runId}`,
      email: `tenant.a.${runId}@homehub.iq`,
      firstName: 'Tenant',
      lastName: `A ${runId}`,
      roles: ['TENANT'],
      isActive: true,
      createdAt: new Date()
    }).returning();

    // Create Tenant B
    const [tenantB] = await db.insert(schema.users).values({
      id: `usr-tenant-b-${runId}`,
      email: `tenant.b.${runId}@homehub.iq`,
      firstName: 'Tenant',
      lastName: `B ${runId}`,
      roles: ['TENANT'],
      isActive: true,
      createdAt: new Date()
    }).returning();

    // Create Lease for Tenant A
    const leaseAId = `lease-a-${runId}`;
    await db.insert(schema.leases).values({
      id: leaseAId,
      propertyId: propId,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: 850000,
      billingFrequency: 'MONTHLY'
    });

    await db.insert(schema.leaseTenants).values({
      leaseId: leaseAId,
      tenantId: tenantA.id,
      isPrimary: true
    });

    const tokenB = jwt.sign(
      { id: tenantB.id, email: tenantB.email, roles: ['TENANT'], tokenVersion: 1 },
      jwtSecret
    );

    // Tenant B attempts to fetch Tenant A's lease details
    const leaseRes = await page.request.get(`/api/tenant/leases/${leaseAId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    // Must be rejected with 403 Forbidden or 404 Not Found (isolated)
    expect([403, 404]).toContain(leaseRes.status());
  });

  // =========================================================================
  // 4. RESPONSIVE VIEWPORTS EXECUTION
  // =========================================================================
  test('4. Responsive Viewports: Layout Stability from Mobile to Ultra-Wide', async ({ page }) => {
    const viewports = [
      { width: 1440, height: 900, name: 'Desktop (1440x900)' },
      { width: 1280, height: 800, name: 'Laptop (1280x800)' },
      { width: 1024, height: 768, name: 'Tablet (1024x768)' },
      { width: 390, height: 844, name: 'Mobile (390x844)' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login', { waitUntil: 'domcontentloaded' });

      // Handle transition from welcome screen to login form if not already on login form
      await Promise.race([
        page.locator('#welcome-signin-link').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
        page.locator('#login-email').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      ]);

      if (await page.locator('#welcome-signin-link').isVisible()) {
        await page.locator('#welcome-signin-link').click();
      }

      // Verify login card and inputs exist and are interactive
      const emailInput = page.locator('#login-email');
      const submitBtn = page.locator('#login-submit-btn');

      await expect(emailInput).toBeVisible({ timeout: 10000 });
      await expect(submitBtn).toBeVisible({ timeout: 10000 });

      // Verify that no horizontal scrolling overflow broke the main body container
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 10); // allow minor scrollbar margin
    }
  });

  // =========================================================================
  // 5. LOCALIZATION & RTL/LTR DIRECTIONALITY INTEGRITY
  // =========================================================================
  test('5. Localization & RTL/LTR: Kurdish/Arabic RTL and English LTR Standards', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 1. Kurdish Sorani (Default) -> dir="rtl", lang="ku"
    await page.evaluate(() => {
      if ((window as any).__setHomeHubLanguage) {
        (window as any).__setHomeHubLanguage('ku');
      } else {
        localStorage.setItem('homehub_lang', 'ku');
        window.location.reload();
      }
    });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl', { timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('lang', 'ku', { timeout: 10000 });

    // 2. Arabic -> dir="rtl", lang="ar"
    await page.evaluate(() => {
      if ((window as any).__setHomeHubLanguage) {
        (window as any).__setHomeHubLanguage('ar');
      }
    });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl', { timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar', { timeout: 10000 });

    // 3. English -> dir="ltr", lang="en"
    await page.evaluate(() => {
      if ((window as any).__setHomeHubLanguage) {
        (window as any).__setHomeHubLanguage('en');
      }
    });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr', { timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 10000 });
  });
});
