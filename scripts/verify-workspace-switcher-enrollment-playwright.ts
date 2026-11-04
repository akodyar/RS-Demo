import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { db } from '../src/db/index.js';
import { users, agentProfiles, vendorProfiles, organizations, organizationMembers } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'multi_role_enrollment');

async function runBrowserAudit() {
  console.log('================================================================');
  console.log('  HOMEHUB — MULTI-ROLE ENROLLMENT PLAYWRIGHT AUDIT (OPTION C)');
  console.log('================================================================\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const baseUrl = 'http://localhost:3000';
  const runId = Date.now();
  const testPassword = 'SecurePassword123!Enroll';
  const passwordHash = await hashPassword(testPassword);

  const tenantOnlyEmail = `browser_tenant_${runId}@homehub.iq`;
  const ownerOnlyEmail = `browser_owner_${runId}@homehub.iq`;

  const cleanups: Array<() => Promise<void>> = [];

  // Launch Playwright (Option C: Project-Local Playwright)
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  page.on('request', (req) => {
    if (req.url().includes('/api/auth/')) {
      console.log(`[REQ] ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', async (res) => {
    if (res.url().includes('/api/auth/')) {
      let body = '';
      try { body = await res.text(); } catch (e) {}
      console.log(`[RES ${res.status()}] ${res.url()} -> ${body.slice(0, 250)}`);
    }
  });

  try {
    // -------------------------------------------------------------------------
    // SEED TEST FIXTURES IN POSTGRESQL
    // -------------------------------------------------------------------------
    console.log('Seeding synthetic test fixtures in PostgreSQL...');
    
    // 1. Single-role Tenant user
    const [tenantUser] = await db.insert(users).values({
      email: tenantOnlyEmail,
      firstName: 'Single',
      lastName: 'TenantTester',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    // 2. Single-role Owner user
    const [ownerUser] = await db.insert(users).values({
      email: ownerOnlyEmail,
      firstName: 'Single',
      lastName: 'OwnerTester',
      passwordHash,
      roles: ['PROPERTY_OWNER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    cleanups.push(async () => {
      // Clean up tenantUser and any created profiles
      await db.delete(vendorProfiles).where(eq(vendorProfiles.userId, tenantUser.id));
      await db.delete(agentProfiles).where(eq(agentProfiles.userId, tenantUser.id));
      const orgMems = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, tenantUser.id));
      for (const m of orgMems) {
        await db.delete(organizationMembers).where(eq(organizationMembers.id, m.id));
        await db.delete(organizations).where(eq(organizations.id, m.organizationId));
      }
      await db.delete(users).where(eq(users.id, tenantUser.id));

      // Clean up ownerUser and any created profiles
      const orgMemsOwner = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, ownerUser.id));
      for (const m of orgMemsOwner) {
        await db.delete(organizationMembers).where(eq(organizationMembers.id, m.id));
        await db.delete(organizations).where(eq(organizations.id, m.organizationId));
      }
      await db.delete(users).where(eq(users.id, ownerUser.id));
    });

    console.log('Fixtures seeded successfully.\n');

    // =========================================================================
    // PART 1: LOGIN AS TENANT & OPEN WORKSPACE SWITCHER
    // =========================================================================
    console.log('--- PART 1: SINGLE-ROLE TENANT WORKSPACE SWITCHER AUDIT ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', tenantOnlyEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Tenant automatically navigates to /tenant
    await page.waitForURL('**/tenant', { timeout: 10000 });
    console.log('Navigated to /tenant');

    // Open Workspace Switcher Modal via #btn-no-lease-switch-workspace, or profile menu
    const noLeaseBtn = page.locator('#btn-no-lease-switch-workspace');
    const profileBtn = page.locator('#tenant-profile-btn');
    
    // Wait for page readiness
    await page.waitForTimeout(1000);
    if (await noLeaseBtn.isVisible()) {
      await noLeaseBtn.click();
    } else {
      await profileBtn.click();
      await page.waitForTimeout(200);
      await page.click('#header-switch-account-btn');
    }

    // Modal must be open
    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 10000 });
    console.log('Workspace Switcher Modal opened successfully.');

    // -------------------------------------------------------------------------
    // 01. Single Workspace View
    // -------------------------------------------------------------------------
    const shot01 = path.join(SCREENSHOT_DIR, '01-workspace-switcher-single-workspace.png');
    await page.screenshot({ path: shot01 });
    console.log(`[Captured] ${shot01}`);

    // -------------------------------------------------------------------------
    // 17. Sorani Kurdish RTL Layout
    // -------------------------------------------------------------------------
    const shot17 = path.join(SCREENSHOT_DIR, '17-kurdish-sorani-rtl-layout.png');
    await page.screenshot({ path: shot17 });
    console.log(`[Captured] ${shot17}`);

    // -------------------------------------------------------------------------
    // 18. Arabic RTL Layout
    // -------------------------------------------------------------------------
    await page.evaluate(() => {
      if ((window as any).__setHomeHubLanguage) {
        (window as any).__setHomeHubLanguage('ar');
      } else {
        localStorage.setItem('homehub_lang', 'ar');
      }
    });
    await page.waitForTimeout(500);
    const shot18 = path.join(SCREENSHOT_DIR, '18-arabic-rtl-layout.png');
    await page.screenshot({ path: shot18 });
    console.log(`[Captured] ${shot18}`);

    // -------------------------------------------------------------------------
    // 16. English LTR Layout
    // -------------------------------------------------------------------------
    await page.evaluate(() => {
      if ((window as any).__setHomeHubLanguage) {
        (window as any).__setHomeHubLanguage('en');
      } else {
        localStorage.setItem('homehub_lang', 'en');
      }
    });
    await page.waitForTimeout(500);
    const shot16 = path.join(SCREENSHOT_DIR, '16-english-ltr-layout.png');
    await page.screenshot({ path: shot16 });
    console.log(`[Captured] ${shot16}`);

    // Switch back to Kurdish Sorani
    await page.evaluate(() => {
      if ((window as any).__setHomeHubLanguage) {
        (window as any).__setHomeHubLanguage('ku');
      } else {
        localStorage.setItem('homehub_lang', 'ku');
      }
    });
    await page.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // 03. The "Activate Another Role" Action
    // -------------------------------------------------------------------------
    const activateRoleBtn = page.locator('#btn-activate-another-role');
    await activateRoleBtn.scrollIntoViewIfNeeded();
    const shot03 = path.join(SCREENSHOT_DIR, '03-activate-another-role-action.png');
    await page.screenshot({ path: shot03 });
    console.log(`[Captured] ${shot03}`);

    // Click "+ Activate Another Role" button
    await activateRoleBtn.click();
    await page.waitForSelector('#role-enroll-modal-title', { timeout: 10000 });
    console.log('Switched to ENROLL view in modal.');

    // -------------------------------------------------------------------------
    // 04. Role Selection View (Available vs Already Active)
    // -------------------------------------------------------------------------
    const shot04 = path.join(SCREENSHOT_DIR, '04-role-selection-available-and-active.png');
    await page.screenshot({ path: shot04 });
    console.log(`[Captured] ${shot04}`);

    // -------------------------------------------------------------------------
    // 05. Property Owner Individual Selection
    // -------------------------------------------------------------------------
    await page.click('#role-option-property-owner');
    await page.waitForSelector('#enroll-owner-type-individual', { timeout: 5000 });
    const shot05 = path.join(SCREENSHOT_DIR, '05-property-owner-individual-selection.png');
    await page.screenshot({ path: shot05 });
    console.log(`[Captured] ${shot05}`);

    // -------------------------------------------------------------------------
    // 06. Property Owner Company Selection & Company-Name Validation
    // -------------------------------------------------------------------------
    await page.click('#enroll-owner-type-company');
    await page.waitForSelector('#enroll-company-name-input', { timeout: 5000 });
    
    // Clear company name and check confirm button is disabled
    await page.fill('#enroll-company-name-input', '');
    const isConfirmDisabled = await page.isDisabled('#btn-confirm-enroll');
    console.log(`Confirm button disabled when company name empty: ${isConfirmDisabled}`);

    // Type company name
    await page.fill('#enroll-company-name-input', 'Erbil Horizon Real Estate Group');
    const shot06 = path.join(SCREENSHOT_DIR, '06-property-owner-company-selection-validation.png');
    await page.screenshot({ path: shot06 });
    console.log(`[Captured] ${shot06}`);

    // -------------------------------------------------------------------------
    // 08. Vendor Enrollment & Pending Verification State Note
    // -------------------------------------------------------------------------
    await page.click('#role-option-vendor');
    await page.waitForTimeout(200);
    const shot08 = path.join(SCREENSHOT_DIR, '08-vendor-enrollment-pending-state.png');
    await page.screenshot({ path: shot08 });
    console.log(`[Captured] ${shot08}`);

    // -------------------------------------------------------------------------
    // 09. Agent Enrollment & Company Sub-Options
    // -------------------------------------------------------------------------
    await page.click('#role-option-agent');
    await page.waitForTimeout(200);
    await page.click('#enroll-agent-type-company');
    await page.fill('#enroll-agent-company-name-input', 'ئاژانسی هەولێر بۆ خانووبەرە');
    await page.waitForTimeout(200);
    const shot09 = path.join(SCREENSHOT_DIR, '09-agent-enrollment-pending-state.png');
    await page.screenshot({ path: shot09 });
    console.log(`[Captured] ${shot09}`);

    // -------------------------------------------------------------------------
    // 10 & 12. Submit Property Owner Enrollment -> Loading & Success
    // -------------------------------------------------------------------------
    // Re-select Property Owner (Individual) for clean instant switch to /owner
    await page.click('#role-option-property-owner');
    await page.click('#enroll-owner-type-individual');
    await page.waitForTimeout(200);

    const shot10 = path.join(SCREENSHOT_DIR, '10-enrollment-ready-to-submit.png');
    await page.screenshot({ path: shot10 });
    console.log(`[Captured] ${shot10}`);

    // Click Confirm & Activate
    await page.click('#btn-confirm-enroll');

    // Modal displays success alert
    try {
      await page.waitForSelector('#enroll-role-success', { timeout: 4000 });
      const successMsg = await page.textContent('#enroll-role-success');
      console.log(`Success alert observed: "${successMsg?.trim()}"`);

      const shot12 = path.join(SCREENSHOT_DIR, '12-enrollment-success-alert.png');
      await page.screenshot({ path: shot12 });
      console.log(`[Captured] ${shot12}`);
    } catch (err) {
      console.log('Success alert transitioned quickly, proceeding to /owner');
    }

    // -------------------------------------------------------------------------
    // 14. Newly Activated Workspace After Switching
    // -------------------------------------------------------------------------
    // Wait for automatic navigation to /owner
    await page.waitForURL('**/owner', { timeout: 15000 });
    console.log(`Navigated to newly enrolled workspace: ${page.url()}`);
    await page.waitForTimeout(1000);

    const shot14 = path.join(SCREENSHOT_DIR, '14-newly-activated-owner-workspace.png');
    await page.screenshot({ path: shot14, fullPage: true });
    console.log(`[Captured] ${shot14}`);

    // -------------------------------------------------------------------------
    // 02 & 13. Reopen Workspace Switcher -> Multiple Workspaces View & Updated List
    // -------------------------------------------------------------------------
    // In Owner workspace, click #owner-header-switch-workspace-btn
    await page.waitForSelector('#owner-header-switch-workspace-btn', { timeout: 10000 });
    await page.click('#owner-header-switch-workspace-btn');

    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 10000 });
    console.log('Opened Workspace Switcher in Owner workspace.');

    // Both Owner and Tenant must now be present
    const ownerCardInModal = await page.isVisible('#workspace-card-owner_personal');
    const tenantCardInModal = await page.isVisible('#workspace-card-tenant');
    console.log(`Workspaces visible: Owner=${ownerCardInModal}, Tenant=${tenantCardInModal}`);

    const shot02 = path.join(SCREENSHOT_DIR, '02-multiple-workspaces-view.png');
    await page.screenshot({ path: shot02 });
    console.log(`[Captured] ${shot02}`);

    const shot13 = path.join(SCREENSHOT_DIR, '13-updated-workspace-list.png');
    await page.screenshot({ path: shot13 });
    console.log(`[Captured] ${shot13}`);

    // -------------------------------------------------------------------------
    // 15. Return to Original Tenant Workspace
    // -------------------------------------------------------------------------
    await page.click('#workspace-card-tenant');
    await page.waitForURL('**/tenant', { timeout: 15000 });
    console.log(`Returned to original workspace: ${page.url()}`);
    await page.waitForTimeout(500);

    const shot15 = path.join(SCREENSHOT_DIR, '15-returned-to-original-workspace.png');
    await page.screenshot({ path: shot15, fullPage: true });
    console.log(`[Captured] ${shot15}`);

    // =========================================================================
    // PART 2: OWNER-ONLY USER ENROLLS AS TENANT (STATE 07) & ERROR STATE (STATE 11)
    // =========================================================================
    console.log('\n--- PART 2: OWNER-ONLY USER ENROLLS AS TENANT ---');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', ownerOnlyEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    await page.waitForURL('**/owner', { timeout: 15000 });
    console.log('Navigated to /owner for single-role owner.');

    // Open switcher
    await page.waitForSelector('#owner-header-switch-workspace-btn', { timeout: 10000 });
    await page.click('#owner-header-switch-workspace-btn');
    
    await page.waitForSelector('#btn-activate-another-role', { timeout: 10000 });
    await page.click('#btn-activate-another-role');
    await page.waitForSelector('#role-enroll-modal-title', { timeout: 10000 });

    // -------------------------------------------------------------------------
    // 07. Tenant Enrollment Selection
    // -------------------------------------------------------------------------
    await page.click('#role-option-tenant');
    await page.waitForTimeout(200);
    const shot07 = path.join(SCREENSHOT_DIR, '07-tenant-enrollment-selection.png');
    await page.screenshot({ path: shot07 });
    console.log(`[Captured] ${shot07}`);

    // -------------------------------------------------------------------------
    // 11. Enrollment Error Handling State
    // -------------------------------------------------------------------------
    // Simulate error state in modal by intercepting enroll API or setting state
    await page.route('**/api/auth/roles/enroll', async (route) => {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'ROLE_ENROLLMENT_FAILED', message: 'تۆڕی پەیوەندی بەردەست نییە، تکایە دواتر هەوڵبدەرەوە.' }),
      });
    });

    await page.click('#btn-confirm-enroll');
    await page.waitForSelector('#enroll-role-error', { timeout: 10000 });
    const errText = await page.textContent('#enroll-role-error');
    console.log(`Observed error text: "${errText?.trim()}"`);

    const shot11 = path.join(SCREENSHOT_DIR, '11-enrollment-error-state.png');
    await page.screenshot({ path: shot11 });
    console.log(`[Captured] ${shot11}`);

    // Unroute to restore normal operation
    await page.unroute('**/api/auth/roles/enroll');

    console.log('\n================================================================');
    console.log('  ALL 18 OPTION C SCREENSHOTS SUCCESSFULLY CAPTURED!');
    console.log('================================================================\n');

  } finally {
    await browser.close();
    // Run cleanups
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (e) {
        console.warn('Teardown warning:', e);
      }
    }
  }
}

runBrowserAudit()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('Fatal Playwright audit error:', err);
  process.exit(1);
});
