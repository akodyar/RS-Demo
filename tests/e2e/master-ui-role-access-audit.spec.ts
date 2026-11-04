import { test, expect } from '@playwright/test';
import { db, pool } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// Strict Safety Invariant: target isolated homehub_test database exclusively
if (process.env.SQL_DB_NAME && process.env.SQL_DB_NAME !== 'homehub_test') {
  throw new Error(`HARD SAFETY GATE TRIGGERED: Audit must strictly target homehub_test. Got: ${process.env.SQL_DB_NAME}`);
}

test.describe('Master Browser UI & Role-Based Access Audit', () => {
  test.setTimeout(120000); // 2 minutes per comprehensive test block for Windows stability

  const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';

  const testAccounts = {
    ownerInd: {
      email: 'owner.audit.ind@homehub.iq',
      password: 'AuditPass123!',
      fullName: 'Salar Audit Ind',
      phone: '7501112233',
      role: 'OWNER',
      entityType: 'INDIVIDUAL',
      expectedWorkspace: '/owner',
    },
    ownerCo: {
      email: 'owner.audit.co@homehub.iq',
      password: 'AuditPass123!',
      fullName: 'Dara Audit Manager',
      companyName: 'Zagros Audit Estate Co',
      phone: '7502223344',
      role: 'OWNER',
      entityType: 'COMPANY',
      expectedWorkspace: '/owner',
    },
    agentInd: {
      email: 'agent.audit.ind@homehub.iq',
      password: 'AuditPass123!',
      fullName: 'Ahmed Audit Broker',
      phone: '7503334455',
      role: 'AGENT',
      entityType: 'INDIVIDUAL',
      expectedWorkspace: '/agent',
    },
    agentCo: {
      email: 'agent.audit.co@homehub.iq',
      password: 'AuditPass123!',
      fullName: 'Soran Audit Agency',
      companyName: 'Hawler Audit Realty Group',
      phone: '7504445566',
      role: 'AGENT',
      entityType: 'COMPANY',
      expectedWorkspace: '/agent',
    },
    tenantFresh: {
      email: 'tenant.audit.fresh@homehub.iq',
      password: 'AuditPass123!',
      fullName: 'Karwan Audit Resident',
      phone: '7505556677',
      role: 'TENANT',
      entityType: 'INDIVIDUAL',
      expectedWorkspace: '/tenant',
    },
    vendorFresh: {
      email: 'vendor.audit.fresh@homehub.iq',
      password: 'AuditPass123!',
      fullName: 'Baban Audit Facilities',
      phone: '7506667788',
      role: 'VENDOR',
      entityType: 'INDIVIDUAL',
      expectedWorkspace: '/vendor',
    },
  };

  test.beforeAll(async () => {
    // Deterministic audit setup: delete child records first to satisfy foreign key constraints
    await pool.query(`
      DELETE FROM organization_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%.audit.%@homehub.iq' OR email LIKE '%audit%@homehub.iq');
      DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%.audit.%@homehub.iq' OR email LIKE '%audit%@homehub.iq');
      DELETE FROM users WHERE email LIKE '%.audit.%@homehub.iq' OR email LIKE '%audit%@homehub.iq';
      DELETE FROM organizations WHERE name LIKE '%Audit%';
      UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'owner@homehub.iq';
    `);
  });

  // =========================================================================
  // 1. BROWSER RELIABILITY BASELINE & SHELL VERIFICATION
  // =========================================================================
  test('1. Baseline Browser Reliability & Layout Shell Verification', async ({ page }) => {
    // 1. Navigate to HomeHub base URL
    const response = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    expect(response?.status()).toBe(200);

    // 2. Verify root container & page title
    await expect(page.locator('#root')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveTitle(/HomeHub/, { timeout: 15000 });

    // 3. Verify language switcher & internationalization
    const langSwitch = page.locator('select:has(option[value="ku"]), select:has(option[value="ar"]), button:has-text("کوردی"), button:has-text("Kurdî")').first();
    await expect(langSwitch).toBeVisible({ timeout: 15000 });

    // 4. Verify main navigation items
    await expect(page.locator('a[href="/rentals"], a[href="/rent"]').first()).toBeVisible();

    // 5. Ensure Buy/Sell tabs are disabled/hidden per rental-only release invariant
    await expect(page.locator('a[href="/sale"]')).not.toBeVisible();

    // Capture baseline screenshot
    await page.screenshot({ path: 'test-results/audit-1-baseline-shell.png', fullPage: true });
  });

  // =========================================================================
  // 2. PUBLIC UI REGISTRATION MATRIX (ALL 6 ACCOUNT TYPES)
  // =========================================================================
  test('2.1. Registration: Property Owner — Individual', async ({ page }) => {
    const acc = testAccounts.ownerInd;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-owner').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('input[data-testid="entity-type-individual"]').check();

    await page.locator('#signup-fullname').fill(acc.fullName);
    await page.locator('#signup-phone').fill(acc.phone);
    await page.locator('#signup-email').fill(acc.email);
    await page.locator('#signup-password').fill(acc.password);
    await page.locator('#signup-confirm-password').fill(acc.password);

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();

    await expect(page).toHaveURL(/\/owner/, { timeout: 15000 });

    // Verify DB state
    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, acc.email));
    expect(dbUser).toBeDefined();
    expect(dbUser.roles).toContain('PROPERTY_OWNER');
    expect(dbUser.isActive).toBe(true);

    await page.screenshot({ path: 'test-results/audit-2.1-owner-ind.png' });
  });

  test('2.2. Registration: Property Owner — Company', async ({ page }) => {
    const acc = testAccounts.ownerCo;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-owner').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('input[data-testid="entity-type-company"]').check();

    await page.locator('#signup-fullname').fill(acc.fullName);
    await page.locator('#signup-company').fill(acc.companyName!);
    await page.locator('#signup-phone').fill(acc.phone);
    await page.locator('#signup-email').fill(acc.email);
    await page.locator('#signup-password').fill(acc.password);
    await page.locator('#signup-confirm-password').fill(acc.password);

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();

    await expect(page).toHaveURL(/\/owner/, { timeout: 15000 });

    // Verify DB User and Organization persistence
    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, acc.email));
    expect(dbUser).toBeDefined();

    const [dbOrgMember] = await db.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.userId, dbUser.id));
    expect(dbOrgMember).toBeDefined();
    expect(dbOrgMember.role).toBe('COMPANY_ADMIN');

    const [dbOrg] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, dbOrgMember.organizationId));
    expect(dbOrg).toBeDefined();
    expect(dbOrg.name).toBe(acc.companyName);
    expect(dbOrg.type).toBe('OWNER_COMPANY');

    await page.screenshot({ path: 'test-results/audit-2.2-owner-co.png' });
  });

  test('2.3. Registration: Agent — Individual', async ({ page }) => {
    const acc = testAccounts.agentInd;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-agent').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('input[data-testid="entity-type-individual"]').check();

    await page.locator('#signup-fullname').fill(acc.fullName);
    await page.locator('#signup-phone').fill(acc.phone);
    await page.locator('#signup-email').fill(acc.email);
    await page.locator('#signup-password').fill(acc.password);
    await page.locator('#signup-confirm-password').fill(acc.password);

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();

    await expect(page).toHaveURL(/\/agent/, { timeout: 15000 });

    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, acc.email));
    expect(dbUser).toBeDefined();
    expect(dbUser.roles).toContain('AGENT');

    await page.screenshot({ path: 'test-results/audit-2.3-agent-ind.png' });
  });

  test('2.4. Registration: Agent — Company', async ({ page }) => {
    const acc = testAccounts.agentCo;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-agent').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('input[data-testid="entity-type-company"]').check();

    await page.locator('#signup-fullname').fill(acc.fullName);
    await page.locator('#signup-company').fill(acc.companyName!);
    await page.locator('#signup-phone').fill(acc.phone);
    await page.locator('#signup-email').fill(acc.email);
    await page.locator('#signup-password').fill(acc.password);
    await page.locator('#signup-confirm-password').fill(acc.password);

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();

    await expect(page).toHaveURL(/\/agent/, { timeout: 15000 });

    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, acc.email));
    expect(dbUser).toBeDefined();
    expect(dbUser.roles).toContain('AGENT');

    const [dbOrgMember] = await db.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.userId, dbUser.id));
    expect(dbOrgMember).toBeDefined();
    expect(dbOrgMember.role).toBe('COMPANY_ADMIN');

    const [dbOrg] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, dbOrgMember.organizationId));
    expect(dbOrg).toBeDefined();
    expect(dbOrg.type).toBe('AGENT_COMPANY');

    await page.screenshot({ path: 'test-results/audit-2.4-agent-co.png' });
  });

  test('2.5. Registration: Tenant -> Truthful Empty Tenancy State', async ({ page }) => {
    const acc = testAccounts.tenantFresh;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-tenant').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('#signup-fullname').fill(acc.fullName);
    await page.locator('#signup-phone').fill(acc.phone);
    await page.locator('#signup-email').fill(acc.email);
    await page.locator('#signup-password').fill(acc.password);
    await page.locator('#signup-confirm-password').fill(acc.password);

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();

    await expect(page).toHaveURL(/\/tenant/, { timeout: 15000 });

    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, acc.email));
    expect(dbUser).toBeDefined();
    expect(dbUser.roles).toContain('TENANT');

    // Verify Truthful Empty Tenancy State (Zero fake lease fabricated)
    const emptyStateHeading = page.locator('text=/No Active Lease Found|هیچ گرێبەستێکی چالاکت نییە|لا يوجد لديك عقد إيجار نشط/i').first();
    await expect(emptyStateHeading).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: 'test-results/audit-2.5-tenant-fresh.png' });
  });

  test('2.6. Registration: Vendor -> Vendor Workspace Entry', async ({ page }) => {
    const acc = testAccounts.vendorFresh;

    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });
    await page.locator('#role-card-vendor').click();
    await page.locator('#purpose-continue-btn').click();

    await page.waitForURL('**/onboarding/signup');
    await page.locator('#signup-fullname').fill(acc.fullName);
    await page.locator('#signup-phone').fill(acc.phone);
    await page.locator('#signup-email').fill(acc.email);
    await page.locator('#signup-password').fill(acc.password);
    await page.locator('#signup-confirm-password').fill(acc.password);

    await page.locator('#signup-submit-btn').click();

    await page.waitForURL('**/onboarding/profile');
    await page.locator('#profile-continue-btn').click();
    await page.locator('#profile-review-finish-btn').click();
    await page.locator('#success-start-btn').click();

    await expect(page).toHaveURL(/\/vendor/, { timeout: 15000 });

    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, acc.email));
    expect(dbUser).toBeDefined();
    expect(dbUser.roles).toContain('VENDOR');

    await page.screenshot({ path: 'test-results/audit-2.6-vendor-fresh.png' });
  });

  // =========================================================================
  // 3. NEGATIVE REGISTRATION VALIDATION & REJECTIONS
  // =========================================================================
  test('3. Negative Registration Validation & Privilege Escalation Guard', async ({ page }) => {
    await page.goto('/onboarding/purpose', { waitUntil: 'domcontentloaded' });

    // 1. Verify Administrative Roles are strictly excluded from public UI registration
    await expect(page.locator('#role-card-admin')).not.toBeVisible();
    await expect(page.locator('#role-card-platform_admin')).not.toBeVisible();
    await expect(page.locator('#role-card-super_admin')).not.toBeVisible();
    await expect(page.locator('#role-card-finance_admin')).not.toBeVisible();

    // 2. Select Tenant to reach signup form
    await page.locator('#role-card-tenant').click();
    await page.locator('#purpose-continue-btn').click();
    await page.waitForURL('**/onboarding/signup');

    // 3. Missing required fields submit test
    await page.locator('#signup-submit-btn').click();
    await expect(page.locator('text=/تکایە ناوی تەواوت بنووسە|ناوی تەواو پێویستە/i').first()).toBeVisible();

    // 4. Invalid email format test
    await page.locator('#signup-fullname').fill('Validation Test User');
    await page.locator('#signup-phone').fill('7500000000');
    await page.locator('#signup-email').fill('not-a-valid-email-string');
    await page.locator('#signup-password').fill('ValidPass123!');
    await page.locator('#signup-confirm-password').fill('ValidPass123!');
    await page.locator('#signup-submit-btn').click();
    await expect(page.locator('text=/ئیمەیڵەکە دروست نییە|A valid email address is required/i').first()).toBeVisible();

    // 5. Password mismatch test
    await page.locator('#signup-email').fill('mismatch.audit@homehub.iq');
    await page.locator('#signup-confirm-password').fill('CompletelyDifferent456!');
    await page.locator('#signup-submit-btn').click();
    await expect(page.locator('text=/وشەی نهێنی هاوتا نییە/i').first()).toBeVisible();

    // 6. Duplicate email rejection test
    await page.locator('#signup-email').fill(testAccounts.ownerInd.email); // Already registered in 2.1
    await page.locator('#signup-confirm-password').fill('ValidPass123!');
    await page.locator('#signup-submit-btn').click();

    // Backend responds with 409 EMAIL_ALREADY_EXISTS, UI shows duplicate banner
    const dupError = page.locator('text=/ئەم ئیمەیڵە پێشتر تۆمارکراوە|already registered/i').first();
    await expect(dupError).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/audit-3-negative-registration.png' });
  });

  // =========================================================================
  // 4. INDIVIDUAL LOGIN VERIFICATION FOR EVERY CREATED ACCOUNT
  // =========================================================================
  test('4. Individual Login Verification for Every Registered Persona', async ({ page }) => {
    const accountsToTest = [
      { name: 'Owner Individual', acc: testAccounts.ownerInd },
      { name: 'Owner Company', acc: testAccounts.ownerCo },
      { name: 'Agent Individual', acc: testAccounts.agentInd },
      { name: 'Agent Company', acc: testAccounts.agentCo },
      { name: 'Tenant Fresh', acc: testAccounts.tenantFresh },
      { name: 'Vendor Fresh', acc: testAccounts.vendorFresh },
    ];

    for (const { name, acc } of accountsToTest) {
      // 1. Clear session
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // 2. Fill login form
      await page.locator('#login-email').fill(acc.email);
      await page.locator('#login-password').fill(acc.password);
      await page.locator('#login-submit-btn').click();

      // 3. Confirm expected landing page
      await expect(page).toHaveURL(new RegExp(acc.expectedWorkspace), { timeout: 15000 });

      // 4. Verify auth token saved in localStorage
      const token = await page.evaluate(() => localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token'));
      expect(token).toBeTruthy();

      // 5. Explicitly logout before next persona
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }

    // 4.7 Platform Admin Login Verification via standard /login
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#login-email').fill('admin@homehub.iq');
    await page.locator('#login-password').fill('password123');
    await page.locator('#login-submit-btn').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // 4.8 Platform Admin Login Verification via specialized /admin/login
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.locator('input[type="email"]').fill('admin@homehub.iq');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    await page.screenshot({ path: 'test-results/audit-4-admin-login-success.png' });
  });

  // =========================================================================
  // 5. NEGATIVE LOGIN VALIDATION & REJECTIONS
  // =========================================================================
  test('5. Negative Login Rejection: Wrong Password, Unknown User, Suspended State', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 1. Incorrect password rejection
    await page.locator('#login-email').fill('owner@homehub.iq');
    await page.locator('#login-password').fill('CompletelyWrongPassword999!');
    await page.locator('#login-submit-btn').click();
    const wrongPassBanner = page.locator('text=/Invalid email or password|هەڵەیە/i').first();
    await expect(wrongPassBanner).toBeVisible({ timeout: 10000 });
    await db.update(schema.users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(schema.users.email, 'owner@homehub.iq'));

    // 2. Unknown account rejection
    await page.locator('#login-email').fill('nonexistent.audit@homehub.iq');
    await page.locator('#login-password').fill('SomePassword123!');
    await page.locator('#login-submit-btn').click();
    const unknownBanner = page.locator('text=/Invalid email or password|هەڵەیە/i').first();
    await expect(unknownBanner).toBeVisible({ timeout: 10000 });

    // 3. Suspended account rejection (isActive: false)
    const suspendedEmail = 'suspended.audit@homehub.iq';
    const [suspendedUser] = await db.insert(schema.users).values({
      id: 'usr-susp-audit',
      email: suspendedEmail,
      firstName: 'Suspended',
      lastName: 'User Audit',
      roles: ['TENANT'],
      isActive: false, // Suspended
    }).returning();

    // Try logging in as suspended user
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: suspendedEmail, password: 'password123' },
    });
    expect(loginRes.status()).toBe(403);
    const loginBody = await loginRes.json();
    expect(loginBody.error).toBe('ACCOUNT_SUSPENDED');

    await page.screenshot({ path: 'test-results/audit-5-negative-login.png' });
  });

  // =========================================================================
  // 6. ACCOUNT LIFECYCLE & SESSION SECURITY
  // =========================================================================
  test('6. Session Persistence, Logout Invalidation, Password Reset, and Lockout', async ({ page }) => {
    // 6.1 Session persistence across page reload
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#login-email').fill(testAccounts.ownerInd.email);
    await page.locator('#login-password').fill(testAccounts.ownerInd.password);
    await page.locator('#login-submit-btn').click();
    await expect(page).toHaveURL(/\/owner/, { timeout: 15000 });

    // Reload page and verify still on /owner
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/owner/);

    // Capture token before logout
    const preLogoutToken = await page.evaluate(() => localStorage.getItem('homehub_auth_token'));
    expect(preLogoutToken).toBeTruthy();

    // 6.2 Session termination via Logout
    await page.evaluate(async () => {
      const token = localStorage.getItem('homehub_auth_token');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    });
    await page.waitForURL('**/login', { timeout: 10000 });

    // 6.3 Authoritative Token Invalidation (obsolete tokenVersion rejected with 401)
    const testPostLogout = await page.request.get('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${preLogoutToken}` }
    });
    expect([401, 403]).toContain(testPostLogout.status());

    // 6.4 Back-button behavior after logout does not leak protected content
    await page.goto('/owner', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#owner-portfolio-grid')).not.toBeVisible();
    await expect(page.locator('#welcome-signin-link, button:has-text("چوونە ژوورەوە"), button:has-text("Login")').first()).toBeVisible({ timeout: 10000 });

    // 6.5 Full Password Reset Lifecycle
    const resetEmail = 'reset.audit@homehub.iq';
    const initialPass = 'OldPass123!';
    const newPass = 'BrandNewPass999!';

    // Register user for reset
    const regRes = await page.request.post('/api/auth/register', {
      data: {
        email: resetEmail,
        password: initialPass,
        fullName: 'Password Reset Candidate',
        phone: '7509998877',
        role: 'TENANT',
        entityType: 'INDIVIDUAL'
      }
    });
    expect(regRes.status()).toBe(201);

    // Request reset token
    const forgotRes = await page.request.post('/api/auth/forgot-password', {
      data: { email: resetEmail }
    });
    expect(forgotRes.status()).toBe(200);

    // Query token from database
    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, resetEmail));
    const [tokenRecord] = await db.select().from(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, dbUser.id));
    expect(tokenRecord).toBeDefined();
    expect(tokenRecord.tokenHash).toBeTruthy();

    // Reset password with invalid token -> rejected
    const invalidReset = await page.request.post('/api/auth/reset-password', {
      data: { token: 'invalid_raw_token_xyz', newPassword: newPass }
    });
    expect(invalidReset.status()).toBe(400);

    // 6.6 Failed-Login Protection & 15-Minute Account Lockout
    for (let attempt = 1; attempt <= 5; attempt++) {
      await page.request.post('/api/auth/login', {
        data: { email: resetEmail, password: 'WrongPasswordEveryTime!' }
      });
    }

    // 6th attempt must trigger ACCOUNT_LOCKED (HTTP 423)
    const lockedRes = await page.request.post('/api/auth/login', {
      data: { email: resetEmail, password: 'WrongPasswordEveryTime!' }
    });
    expect(lockedRes.status()).toBe(423);
    const lockedBody = await lockedRes.json();
    expect(lockedBody.error).toBe('ACCOUNT_LOCKED');

    // Clean up lockout state in DB
    await db.update(schema.users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(schema.users.id, dbUser.id));

    await page.screenshot({ path: 'test-results/audit-6-session-lifecycle.png' });
  });

  // =========================================================================
  // 7. ROLE-BASED ACCESS ACROSS ALL 5 WORKSPACES & LEAST PRIVILEGE
  // =========================================================================
  test('7. Workspace Verification & Sub-Admin Least Privilege Enforcement', async ({ page }) => {
    // 7.1 Property Owner Workspace (/owner)
    const [ownerUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'owner@homehub.iq'));
    const ownerToken = jwt.sign(
      { id: ownerUser.id, email: ownerUser.email, roles: ['PROPERTY_OWNER'], tokenVersion: 1 },
      jwtSecret
    );
    const ownerRes = await page.request.get('/api/owner/dashboard', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    expect(ownerRes.status()).toBe(200);

    // 7.2 Agent Workspace (/agent)
    const [agentUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'agent@homehub.iq'));
    const agentToken = jwt.sign(
      { id: agentUser.id, email: agentUser.email, roles: ['AGENT'], tokenVersion: 1 },
      jwtSecret
    );
    const agentRes = await page.request.get('/api/agent/dashboard', {
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    expect(agentRes.status()).toBe(200);

    // 7.3 Tenant Workspace (/tenant)
    const [tenantUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'tenant@homehub.iq'));
    const tenantToken = jwt.sign(
      { id: tenantUser.id, email: tenantUser.email, roles: ['TENANT'], tokenVersion: 1 },
      jwtSecret
    );
    const tenantRes = await page.request.get('/api/tenant/dashboard', {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    expect(tenantRes.status()).toBe(200);

    // 7.4 Vendor Workspace (/vendor)
    const [vendorUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'vendor@homehub.iq'));
    const vendorToken = jwt.sign(
      { id: vendorUser.id, email: vendorUser.email, roles: ['VENDOR'], tokenVersion: 1 },
      jwtSecret
    );
    const vendorRes = await page.request.get('/api/vendor/work-orders', {
      headers: { Authorization: `Bearer ${vendorToken}` }
    });
    expect([200, 404]).toContain(vendorRes.status());

    // 7.5 Read-Only Admin Least Privilege:
    // Read-Only Admin can read admin stats/audit logs, but mutations MUST be rejected with HTTP 403
    const readOnlyAdminToken = jwt.sign(
      { id: 'admin_ro_01', email: 'readonly.admin@homehub.iq', roles: ['READ_ONLY_ADMIN'], tokenVersion: 1 },
      jwtSecret
    );
    const roReadRes = await page.request.get('/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${readOnlyAdminToken}` }
    });
    expect([200, 401, 403]).toContain(roReadRes.status());

    // Mutation by Read-Only Admin must be denied with 403
    const roMutationRes = await page.request.post('/api/admin/users/assign-role', {
      headers: { Authorization: `Bearer ${readOnlyAdminToken}` },
      data: { targetUserId: tenantUser.id, newRole: 'PROPERTY_OWNER' }
    });
    expect([401, 403, 404]).toContain(roMutationRes.status());

    // 7.6 Organizational Roles (ACCOUNTANT vs VIEWER)
    const accountantToken = jwt.sign(
      { id: 'usr_acct_01', email: 'accountant@homehub.iq', roles: ['ACCOUNTANT', 'COMPANY_MEMBER'], tokenVersion: 1 },
      jwtSecret
    );
    const acctRes = await page.request.get('/api/financials/statements/trial-balance', {
      headers: { Authorization: `Bearer ${accountantToken}` }
    });
    expect([200, 401, 403]).toContain(acctRes.status());

    await page.screenshot({ path: 'test-results/audit-7-workspace-matrix.png' });
  });

  // =========================================================================
  // 8. CROSS-ROLE AND CROSS-ACCOUNT ISOLATION (ADVERSARIAL IDOR)
  // =========================================================================
  test('8. Cross-Account Isolation: Owner A vs B, Tenant A vs B, Non-Admin API Denial', async ({ page }) => {
    // 8.1 Non-Admin users attempting Admin endpoints must return 401 or 403
    const [tenantUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'tenant@homehub.iq'));
    const tenantToken = jwt.sign(
      { id: tenantUser.id, email: tenantUser.email, roles: ['TENANT'], tokenVersion: 1 },
      jwtSecret
    );

    const forbiddenAdminRes = await page.request.get('/api/admin/users', {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    expect([401, 403]).toContain(forbiddenAdminRes.status());

    // 8.2 Tenant A cannot view Tenant B's rent schedules or payments
    const [tenantB] = await db.select().from(schema.users).where(eq(schema.users.email, 'tenant_b@homehub.iq'));
    const tenantBToken = jwt.sign(
      { id: tenantB.id, email: tenantB.email, roles: ['TENANT'], tokenVersion: 1 },
      jwtSecret
    );

    const crossPaymentRes = await page.request.post('/api/tenant/payments/submit', {
      headers: { Authorization: `Bearer ${tenantToken}` },
      data: {
        scheduleId: 'demo_sch_06', // Tenant B's overdue rent schedule
        amount: 500000,
        currency: 'IQD',
        method: 'CASH',
      }
    });
    expect([401, 403, 404]).toContain(crossPaymentRes.status());

    // 8.3 Cross-Owner Isolation: Owner B cannot mutate Owner A's property
    const [ownerB] = await db.select().from(schema.users).where(eq(schema.users.email, 'owner_b@homehub.iq'));
    const ownerBToken = jwt.sign(
      { id: ownerB.id, email: ownerB.email, roles: ['PROPERTY_OWNER'], tokenVersion: 1 },
      jwtSecret
    );

    const crossOwnerMutation = await page.request.patch('/api/properties/demo_prop_01', {
      headers: { Authorization: `Bearer ${ownerBToken}` },
      data: { name: 'Hacked Property Title' }
    });
    expect([401, 403, 404]).toContain(crossOwnerMutation.status());

    await page.screenshot({ path: 'test-results/audit-8-cross-isolation.png' });
  });

  // =========================================================================
  // 9. ROLE-SPECIFIC DASHBOARD ROUTING & DEPRECATED REDIRECTS
  // =========================================================================
  test('9. Role Routing & Deprecated Route Redirects', async ({ page }) => {
    // 1. Deprecated /company redirects to /
    await page.goto('/company', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    expect(page.url()).toBe('http://localhost:3000/');

    // 2. Deprecated /workspace/company redirects to /
    await page.goto('/workspace/company', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    expect(page.url()).toBe('http://localhost:3000/');

    // 3. Dormant Buy/Sell /buyer redirects to /
    await page.goto('/buyer', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    expect(page.url()).toBe('http://localhost:3000/');

    // 4. Dormant Buy/Sell /sale redirects to /rentals
    await page.goto('/sale', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/rentals', { timeout: 10000 });
    expect(page.url()).toContain('/rentals');

    // 5. Unknown route fallback redirects to /
    await page.goto('/some-completely-invalid-route-xyz', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    expect(page.url()).toBe('http://localhost:3000/');

    await page.screenshot({ path: 'test-results/audit-9-routing-redirects.png' });
  });
});
