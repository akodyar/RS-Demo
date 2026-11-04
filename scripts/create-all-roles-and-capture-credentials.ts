process.env.SQL_DB_NAME = 'homehub_test';

import { chromium, Browser, Page } from 'playwright';
import { db, pool } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

// Target directories for screenshots
const WORKSPACE_SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'accounts_audit');
const ARTIFACT_SCREENSHOT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\ac5dd336-573d-4138-b29c-30467160e6e2\\audit';

fs.mkdirSync(WORKSPACE_SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(ARTIFACT_SCREENSHOT_DIR, { recursive: true });

async function saveScreenshot(page: Page, filename: string) {
  const wsPath = path.join(WORKSPACE_SCREENSHOT_DIR, filename);
  const artPath = path.join(ARTIFACT_SCREENSHOT_DIR, filename);
  await page.screenshot({ path: wsPath, fullPage: false });
  fs.copyFileSync(wsPath, artPath);
  console.log(`[SCREENSHOT SAVED]: ${filename}`);
}

interface AccountSpec {
  id: string;
  roleKey: 'OWNER' | 'AGENT' | 'TENANT' | 'VENDOR';
  roleCardId: string;
  entityType?: 'INDIVIDUAL' | 'COMPANY';
  fullName: string;
  companyName?: string;
  phone: string;
  email: string;
  password: string;
  expectedDashboard: string;
  expectedRoleInDb: string;
}

const testAccounts: AccountSpec[] = [
  {
    id: 'owner_individual',
    roleKey: 'OWNER',
    roleCardId: 'role-card-owner',
    entityType: 'INDIVIDUAL',
    fullName: 'Kardo Farhad',
    phone: '7501112233',
    email: 'owner.ind.audit@homehub.iq',
    password: 'Password123!',
    expectedDashboard: '/owner',
    expectedRoleInDb: 'PROPERTY_OWNER',
  },
  {
    id: 'owner_company',
    roleKey: 'OWNER',
    roleCardId: 'role-card-owner',
    entityType: 'COMPANY',
    fullName: 'Dara Nawzad',
    companyName: 'Zagros Real Estate Development LLC',
    phone: '7502223344',
    email: 'owner.co.audit@homehub.iq',
    password: 'Password123!',
    expectedDashboard: '/owner',
    expectedRoleInDb: 'PROPERTY_OWNER',
  },
  {
    id: 'agent_individual',
    roleKey: 'AGENT',
    roleCardId: 'role-card-agent',
    entityType: 'INDIVIDUAL',
    fullName: 'Alan Botan',
    phone: '7503334455',
    email: 'agent.ind.audit@homehub.iq',
    password: 'Password123!',
    expectedDashboard: '/agent',
    expectedRoleInDb: 'AGENT',
  },
  {
    id: 'agent_company',
    roleKey: 'AGENT',
    roleCardId: 'role-card-agent',
    entityType: 'COMPANY',
    fullName: 'Soran Omer',
    companyName: 'Erbil Prime Brokerage Agency',
    phone: '7504445566',
    email: 'agent.co.audit@homehub.iq',
    password: 'Password123!',
    expectedDashboard: '/agent',
    expectedRoleInDb: 'AGENT',
  },
  {
    id: 'tenant',
    roleKey: 'TENANT',
    roleCardId: 'role-card-tenant',
    fullName: 'Rebin Ahmed',
    phone: '7505556677',
    email: 'tenant.audit@homehub.iq',
    password: 'Password123!',
    expectedDashboard: '/tenant',
    expectedRoleInDb: 'TENANT',
  },
  {
    id: 'vendor',
    roleKey: 'VENDOR',
    roleCardId: 'role-card-vendor',
    fullName: 'Karwan Electrician & HVAC',
    phone: '7506667788',
    email: 'vendor.audit@homehub.iq',
    password: 'Password123!',
    expectedDashboard: '/vendor',
    expectedRoleInDb: 'VENDOR',
  },
];

async function main() {
  console.log('--- STARTING ACCOUNT CREATION & VISIBLE CREDENTIALS AUDIT ---');

  // 1. Clean up audit accounts in PostgreSQL
  console.log('[CLEANUP] Cleaning up any prior audit accounts from homehub_test...');
  await pool.query(`
    DELETE FROM organization_members WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%.audit@homehub.iq' OR email LIKE '%.audit.%@homehub.iq'
    );
    DELETE FROM password_reset_tokens WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%.audit@homehub.iq' OR email LIKE '%.audit.%@homehub.iq'
    );
    DELETE FROM users WHERE email LIKE '%.audit@homehub.iq' OR email LIKE '%.audit.%@homehub.iq';
    DELETE FROM organizations WHERE name IN ('Zagros Real Estate Development LLC', 'Erbil Prime Brokerage Agency');
  `);
  console.log('[CLEANUP] Database cleaned up successfully.');

  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    locale: 'ku',
  });

  const page = await context.newPage();

  // Test results tracker
  const auditResults: Record<string, any> = {};

  try {
    // -------------------------------------------------------------
    // LOCALIZATION VERIFICATION: Kurdish RTL vs English LTR
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING LOCALIZATION & RTL/LTR SWITCHING ---');
    await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#role-card-owner', { timeout: 10000 });

    // 1. Kurdish Purpose Screen
    await saveScreenshot(page, 'loc_01_kurdish_rtl_purpose.png');

    // Switch to English
    await page.click('#language-selector-trigger');
    await page.click('#lang-option-en');
    await page.waitForTimeout(500);
    await saveScreenshot(page, 'loc_02_english_ltr_purpose.png');

    // Switch to Kurdish again
    await page.click('#language-selector-trigger');
    await page.click('#lang-option-ku');
    await page.waitForTimeout(500);

    // Proceed to signup to capture Kurdish vs English on signup form
    await page.click('#role-card-owner');
    await page.click('#purpose-continue-btn');
    await page.waitForSelector('#signup-fullname', { timeout: 10000 });

    // 3. Kurdish Signup Screen
    await saveScreenshot(page, 'loc_03_kurdish_rtl_signup.png');

    // Switch to English on Signup
    await page.click('#language-selector-trigger');
    await page.click('#lang-option-en');
    await page.waitForTimeout(500);
    await saveScreenshot(page, 'loc_04_english_ltr_signup.png');

    // Switch back to Kurdish
    await page.click('#language-selector-trigger');
    await page.click('#lang-option-ku');
    await page.waitForTimeout(500);

    // -------------------------------------------------------------
    // LOOP OVER EACH ACCOUNT SPECIFICATION
    // -------------------------------------------------------------
    for (const acc of testAccounts) {
      console.log(`\n======================================================`);
      console.log(`CREATING ACCOUNT: ${acc.id} (${acc.email})`);
      console.log(`======================================================`);

      // Clear cookies / localStorage for fresh session
      await context.clearCookies();
      await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Navigate to purpose selection
      await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector(`#${acc.roleCardId}`, { timeout: 10000 });
      await page.click(`#${acc.roleCardId}`);
      await page.click('#purpose-continue-btn');

      // Now on /onboarding/signup
      await page.waitForSelector('#signup-fullname', { timeout: 10000 });

      // If entity type radio exists, select it
      if (acc.entityType) {
        if (acc.entityType === 'INDIVIDUAL') {
          await page.click('input[data-testid="entity-type-individual"]');
        } else if (acc.entityType === 'COMPANY') {
          await page.click('input[data-testid="entity-type-company"]');
          await page.waitForSelector('#signup-company', { timeout: 5000 });
          await page.fill('#signup-company', acc.companyName!);
        }
      }

      await page.fill('#signup-fullname', acc.fullName);
      await page.fill('#signup-phone', acc.phone);
      await page.fill('#signup-email', acc.email);
      await page.fill('#signup-password', acc.password);
      await page.fill('#signup-confirm-password', acc.password);

      // CLICK PASSWORD REVEAL TOGGLES SO PASSWORDS ARE PLAINLY VISIBLE IN THE SCREENSHOT!
      const passToggle = page.locator('#signup-password-toggle');
      if (await passToggle.isVisible()) {
        await passToggle.click();
      }
      const confirmToggle = page.locator('#signup-confirm-password-toggle');
      if (await confirmToggle.isVisible()) {
        await confirmToggle.click();
      }

      await page.waitForTimeout(300);

      // CAPTURE SIGNUP SCREENSHOT WITH VISIBLE EMAIL AND VISIBLE PASSWORD!
      const signupScreenshotName = `signup_credentials_${acc.id}.png`;
      await saveScreenshot(page, signupScreenshotName);

      // Submit registration
      await page.click('#signup-submit-btn');

      // Wait for onboarding next step or dashboard
      // Onboarding workflow advances: profile setup -> profile review -> success -> dashboard
      try {
        await page.waitForURL((url) => !url.pathname.includes('/signup'), { timeout: 15000 });
        if (page.url().includes('/profile')) {
          const profileBtn = page.locator('#profile-continue-btn');
          if (await profileBtn.isVisible({ timeout: 5000 })) {
            await profileBtn.click();
          }
        }
        if (page.url().includes('/review') || (await page.locator('#profile-review-finish-btn').isVisible({ timeout: 3000 }))) {
          await page.locator('#profile-review-finish-btn').click();
        }
        if (page.url().includes('/success') || (await page.locator('#success-start-btn').isVisible({ timeout: 3000 }))) {
          await page.locator('#success-start-btn').click();
        }
      } catch (e) {
        console.log(`Onboarding progression notice: ${e}`);
      }

      // Verify user created in PostgreSQL
      const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, acc.email));
      if (!dbUser) {
        throw new Error(`CRITICAL: User ${acc.email} was not found in PostgreSQL!`);
      }
      console.log(`[DB VERIFIED]: User ${acc.email} persisted in DB with ID: ${dbUser.id}, roles: ${JSON.stringify(dbUser.roles)}`);

      if (acc.entityType === 'COMPANY') {
        const [orgMember] = await db.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.userId, dbUser.id));
        if (!orgMember) {
          throw new Error(`CRITICAL: Organization member record missing for company user ${acc.email}`);
        }
        const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgMember.organizationId));
        console.log(`[DB VERIFIED]: Company organization persisted: "${org?.name}", type: ${org?.type}`);
      }

      // Now verify authoritative Login with visible credentials
      console.log(`[LOGIN VERIFICATION]: Navigating to /login to test credentials sign-in for ${acc.email}...`);
      await context.clearCookies();
      await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#login-email', { timeout: 10000 });

      await page.fill('#login-email', acc.email);
      await page.fill('#login-password', acc.password);

      // CLICK LOGIN PASSWORD REVEAL TOGGLE SO PASSWORD IS PLAINLY VISIBLE!
      const loginPassToggle = page.locator('#login-password-toggle');
      if (await loginPassToggle.isVisible()) {
        await loginPassToggle.click();
      }
      await page.waitForTimeout(300);

      // CAPTURE LOGIN SCREENSHOT WITH VISIBLE EMAIL AND VISIBLE PASSWORD!
      const loginScreenshotName = `login_credentials_${acc.id}.png`;
      await saveScreenshot(page, loginScreenshotName);

      // Click sign in
      await page.click('#login-submit-btn');

      // Wait for destination dashboard
      await page.waitForURL((url) => url.pathname.startsWith(acc.expectedDashboard), { timeout: 15000 });
      console.log(`[DASHBOARD VERIFIED]: Successfully landed on ${page.url()} matching expected ${acc.expectedDashboard}`);

      await page.waitForTimeout(1000);
      const dashboardScreenshotName = `dashboard_${acc.id}.png`;
      await saveScreenshot(page, dashboardScreenshotName);

      auditResults[acc.id] = {
        email: acc.email,
        password: acc.password,
        role: acc.roleKey,
        entityType: acc.entityType || 'INDIVIDUAL',
        dbUserId: dbUser.id,
        dbRoles: dbUser.roles,
        expectedDashboard: acc.expectedDashboard,
        signupScreenshot: signupScreenshotName,
        loginScreenshot: loginScreenshotName,
        dashboardScreenshot: dashboardScreenshotName,
        status: 'VERIFIED_PASS',
      };
    }

    // -------------------------------------------------------------
    // PLATFORM ADMINISTRATOR VERIFICATION
    // -------------------------------------------------------------
    console.log(`\n======================================================`);
    console.log(`VERIFYING PLATFORM ADMINISTRATOR: admin@homehub.iq`);
    console.log(`======================================================`);

    await context.clearCookies();
    await page.goto('http://localhost:3000/admin/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('http://localhost:3000/admin/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#admin-email', { timeout: 10000 });

    await page.fill('#admin-email', 'admin@homehub.iq');
    await page.fill('#admin-password', 'password123');

    // CLICK ADMIN PASSWORD REVEAL TOGGLE SO PASSWORD IS PLAINLY VISIBLE!
    const adminToggle = page.locator('#admin-password-toggle');
    if (await adminToggle.isVisible()) {
      await adminToggle.click();
    }
    await page.waitForTimeout(300);

    // CAPTURE ADMIN LOGIN SCREENSHOT WITH VISIBLE EMAIL AND VISIBLE PASSWORD!
    await saveScreenshot(page, 'login_credentials_admin.png');

    // Click admin sign in
    await page.click('button[type="submit"]');

    // Wait for admin dashboard
    await page.waitForURL((url) => url.pathname.includes('/admin/dashboard'), { timeout: 15000 });
    console.log(`[ADMIN DASHBOARD VERIFIED]: Successfully landed on ${page.url()}`);
    await page.waitForTimeout(1000);
    await saveScreenshot(page, 'dashboard_admin.png');

    auditResults['admin'] = {
      email: 'admin@homehub.iq',
      password: 'password123',
      role: 'PLATFORM_ADMIN',
      expectedDashboard: '/admin/dashboard',
      loginScreenshot: 'login_credentials_admin.png',
      dashboardScreenshot: 'dashboard_admin.png',
      status: 'VERIFIED_PASS',
    };

    console.log('\n--- ALL ACCOUNTS SUCCESSFULLY CREATED AND VERIFIED ---');
    console.log(JSON.stringify(auditResults, null, 2));

    // Save report to disk
    fs.writeFileSync(
      path.join(WORKSPACE_SCREENSHOT_DIR, 'audit_credentials_summary.json'),
      JSON.stringify(auditResults, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(ARTIFACT_SCREENSHOT_DIR, 'audit_credentials_summary.json'),
      JSON.stringify(auditResults, null, 2),
      'utf-8'
    );
  } finally {
    await browser.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
