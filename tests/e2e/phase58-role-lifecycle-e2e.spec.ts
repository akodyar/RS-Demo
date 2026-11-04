import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import { eq } from 'drizzle-orm';

test.describe('Phase 58: Comprehensive Role Lifecycle & Authentication E2E', () => {
  const runId = Date.now().toString(36);

  test('1. Owner Individual Registration -> Persisted DB State -> Workspace Entry', async ({ page }) => {
    const ownerEmail = `owner.ind.${runId}@homehub.iq`;
    const ownerName = `Salar Aziz ${runId}`;

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('request', req => {
      if (req.url().includes('/api/auth/register')) console.log('REGISTER REQUEST BODY:', req.postData());
    });
    page.on('response', async resp => {
      if (resp.url().includes('/api/auth/register')) {
        console.log('REGISTER RESPONSE BODY:', await resp.text());
      } else if (resp.url().includes('/api/')) {
        console.log('API RESPONSE:', resp.url(), resp.status());
      }
    });

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    
    // Select Owner role
    const ownerCard = page.locator('#role-card-owner');
    await expect(ownerCard).toBeVisible({ timeout: 15000 });
    await ownerCard.click();

    // Continue to signup form
    const continueBtn = page.locator('#purpose-continue-btn');
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // On signup form, select Individual
    await page.waitForURL('**/onboarding/signup');
    const individualRadio = page.locator('input[data-testid="entity-type-individual"]');
    await expect(individualRadio).toBeVisible();
    await individualRadio.check();

    // Fill form fields
    await page.locator('#signup-fullname').fill(ownerName);
    await page.locator('#signup-phone').fill('7501234567');
    await page.locator('#signup-email').fill(ownerEmail);
    await page.locator('#signup-password').fill('OwnerPass123!');
    await page.locator('#signup-confirm-password').fill('OwnerPass123!');

    // Submit form
    await page.locator('#signup-submit-btn').click();

    // Profile Setup Step
    await page.waitForURL('**/onboarding/profile');
    const profileContinueBtn = page.locator('#profile-continue-btn');
    await expect(profileContinueBtn).toBeVisible({ timeout: 15000 });
    await profileContinueBtn.click();

    // Profile Review Step
    const reviewFinishBtn = page.locator('#profile-review-finish-btn');
    await expect(reviewFinishBtn).toBeVisible({ timeout: 15000 });
    await reviewFinishBtn.click();

    // Success Screen
    const successStartBtn = page.locator('#success-start-btn');
    await expect(successStartBtn).toBeVisible({ timeout: 15000 });
    await successStartBtn.click();

    // Verify redirected to Owner workspace
    await expect(page).toHaveURL(/\/owner/, { timeout: 15000 });

    // Verify DB persistence
    const { pool } = await import('../../src/db/index');
    const dbCheck = await pool.query('SELECT current_database()');
    console.log('TEST WORKER CURRENT DATABASE:', dbCheck.rows[0]);
    const allUsers = await pool.query('SELECT id, email FROM users WHERE email = $1', [ownerEmail]);
    console.log('QUERY ALL USERS BY EMAIL RESULT:', allUsers.rows);

    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, ownerEmail));
    expect(dbUser).toBeDefined();
    expect(dbUser.roles).toContain('PROPERTY_OWNER');
    expect(dbUser.isActive).toBe(true);
  });

  test('2. Owner Company Registration -> Organization Creation -> Workspace Entry', async ({ page }) => {
    const companyEmail = `owner.co.${runId}@homehub.iq`;
    const companyName = `Zagros Properties ${runId}`;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-owner').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('input[data-testid="entity-type-company"]').check();

    await page.locator('#signup-fullname').fill(`Manager ${runId}`);
    await page.locator('#signup-company').fill(companyName);
    await page.locator('#signup-phone').fill('7502223344');
    await page.locator('#signup-email').fill(companyEmail);
    await page.locator('#signup-password').fill('CompanyPass123!');
    await page.locator('#signup-confirm-password').fill('CompanyPass123!');

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();

    await expect(page).toHaveURL(/\/owner/, { timeout: 15000 });

    // Verify Organization persisted
    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, companyEmail));
    expect(dbUser).toBeDefined();

    const [dbOrgMember] = await db.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.userId, dbUser.id));
    expect(dbOrgMember).toBeDefined();
    expect(dbOrgMember.role).toBe('COMPANY_ADMIN');
  });

  test('3. Agent Individual Registration -> Agent Workspace Entry', async ({ page }) => {
    const agentEmail = `agent.ind.${runId}@homehub.iq`;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-agent').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('input[data-testid="entity-type-individual"]').check();

    await page.locator('#signup-fullname').fill(`Agent ${runId}`);
    await page.locator('#signup-phone').fill('7503334455');
    await page.locator('#signup-email').fill(agentEmail);
    await page.locator('#signup-password').fill('AgentPass123!');
    await page.locator('#signup-confirm-password').fill('AgentPass123!');

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();

    await expect(page).toHaveURL(/\/agent/, { timeout: 15000 });

    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, agentEmail));
    expect(dbUser).toBeDefined();
    expect(dbUser.roles).toContain('AGENT');
  });

  test('4. Tenant Registration -> Empty Tenancy Isolation', async ({ page }) => {
    const tenantEmail = `tenant.fresh.${runId}@homehub.iq`;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-tenant').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('#signup-fullname').fill(`Tenant Fresh ${runId}`);
    await page.locator('#signup-phone').fill('7504445566');
    await page.locator('#signup-email').fill(tenantEmail);
    await page.locator('#signup-password').fill('TenantPass123!');
    await page.locator('#signup-confirm-password').fill('TenantPass123!');

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();
    await expect(page).toHaveURL(/\/tenant/, { timeout: 15000 });

    // Fresh tenant without active lease is routed to tenant workspace
    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, tenantEmail));
    expect(dbUser).toBeDefined();
    expect(dbUser.roles).toContain('TENANT');
  });

  test('5. Vendor Registration -> Vendor Workspace Access', async ({ page }) => {
    const vendorEmail = `vendor.fresh.${runId}@homehub.iq`;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-vendor').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('#signup-fullname').fill(`Erbil Plumbing ${runId}`);
    await page.locator('#signup-phone').fill('7507778899');
    await page.locator('#signup-email').fill(vendorEmail);
    await page.locator('#signup-password').fill('VendorPass123!');
    await page.locator('#signup-confirm-password').fill('VendorPass123!');

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();

    await expect(page).toHaveURL(/\/vendor/, { timeout: 15000 });

    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, vendorEmail));
    expect(dbUser).toBeDefined();
    expect(dbUser.roles).toContain('VENDOR');
  });

  test('6. Native Login -> Session Persistence -> Logout Workflow', async ({ page }) => {
    // Ensure test user account is not locked out from prior test suites
    await db.update(schema.users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(schema.users.email, 'owner@homehub.iq'));

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Test Invalid Password rejection
    await page.locator('#login-email').fill('owner@homehub.iq');
    await page.locator('#login-password').fill('WrongPassword123!');
    await page.locator('#login-submit-btn').click();

    // Verify error banner is visible
    const errorBanner = page.locator('text=/Invalid email or password|هەڵەیە/i').first();
    await expect(errorBanner).toBeVisible({ timeout: 10000 });

    // Test Valid Credentials Login
    await page.locator('#login-password').fill('password123');
    await page.locator('#login-submit-btn').click();

    // Should navigate to owner workspace
    await expect(page).toHaveURL(/\/owner/, { timeout: 15000 });

    // Verify token stored in localStorage
    const storedToken = await page.evaluate(() => localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token'));
    expect(storedToken).toBeTruthy();

    // Verify Session persistence across page reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/owner/);

    // Logout
    await page.evaluate(() => {
      localStorage.removeItem('homehub_auth_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('homehub_auth_persona');
      window.location.href = '/login';
    });

    await page.waitForURL('**/login', { timeout: 10000 });

    // Attempt direct navigation to protected route
    await page.goto('/owner', { waitUntil: 'domcontentloaded' });
    // Verify protected Owner Dashboard is blocked and Unauthenticated gateway is displayed
    await expect(page.locator('#owner-dashboard')).not.toBeVisible();
    await expect(page.locator('button:has-text("چوونە ژوورەوە"), button:has-text("Login")').first()).toBeVisible({ timeout: 10000 });

    // Clean up login attempt counter for subsequent suites
    await db.update(schema.users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(schema.users.email, 'owner@homehub.iq'));
  });

  test('7. Admin Login & Administrative Isolation', async ({ page }) => {
    // Navigate to /login and enter Admin credentials
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#login-email').fill('admin@homehub.iq');
    await page.locator('#login-password').fill('password123');
    await page.locator('#login-submit-btn').click();

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Verify admin dashboard contents
    const adminHeading = page.locator('h1, button:has-text("هەژماری بەڕێوەبەر")').first();
    await expect(adminHeading).toBeVisible({ timeout: 15000 });
  });
});
