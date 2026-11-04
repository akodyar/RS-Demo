import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { db } from '../src/db/index.js';
import { users, organizations, organizationMembers } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'company_switcher');
const ARTIFACT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\885f5a39-23d2-4761-9d37-8b94a82a12dd\\screenshots\\company_switcher';

async function runCompanySwitcherPlaywright() {
  console.log('================================================================');
  console.log('  HOMEHUB — COMPANY WORKSPACE SWITCHER PLAYWRIGHT (OPTION C)');
  console.log('================================================================\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const copyScreenshotToArtifacts = (filename: string) => {
    const src = path.join(SCREENSHOT_DIR, filename);
    const dst = path.join(ARTIFACT_DIR, filename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
    }
  };

  // 1. Initialize App & Server on dedicated port 3020
  const port = 3020;
  console.log(`Starting application server on dedicated port ${port}...`);
  const app = await createApp();
  const server = http.createServer(app);
  
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const baseUrl = `http://localhost:${port}`;
  console.log(`Server listening at ${baseUrl}`);

  // Warm up Vite development server
  console.log('Warming up Vite development server...');
  try {
    const warmupRes = await fetch(`${baseUrl}/login`);
    await warmupRes.text();
    console.log(`Vite warmed up (status ${warmupRes.status}).\n`);
  } catch (e) {}

  const runId = Date.now();
  const testPassword = 'Password123!Secure';
  const passwordHash = await hashPassword(testPassword);

  const multiCompanyEmail = `pw_company_dual_${runId}@homehub.iq`;
  const singleCompanyEmail = `pw_company_single_${runId}@homehub.iq`;

  const cleanups: Array<() => Promise<void>> = [];

  // Launch Playwright (Option C: Project-Local Playwright)
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  try {
    // -------------------------------------------------------------------------
    // SEED TEST FIXTURES IN POSTGRESQL (homehub_test)
    // -------------------------------------------------------------------------
    console.log('Seeding synthetic test fixtures in PostgreSQL...');

    // 1. Organization Alpha for Dual-Role Company User
    const [orgAlpha] = await db.insert(organizations).values({
      name: `Kurdistan Properties Group Alpha ${runId}`,
      type: 'PROPERTY_MANAGEMENT',
      registrationNumber: `REG-A-${runId}`,
      status: 'VERIFIED',
      verified: true,
      email: `alpha_${runId}@krdproperties.iq`,
      phone: '+9647501112233',
    }).returning();

    // Dual-Role User: COMPANY_MEMBER + TENANT
    const [companyDualUser] = await db.insert(users).values({
      email: multiCompanyEmail,
      firstName: 'Soran',
      lastName: 'Director',
      passwordHash,
      roles: ['COMPANY_MEMBER', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    await db.insert(organizationMembers).values({
      organizationId: orgAlpha.id,
      userId: companyDualUser.id,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    });

    // 2. Organization Beta for Single-Role Company User
    const [orgBeta] = await db.insert(organizations).values({
      name: `Zagros Facility Management Beta ${runId}`,
      type: 'PROPERTY_MANAGEMENT',
      registrationNumber: `REG-B-${runId}`,
      status: 'VERIFIED',
      verified: true,
      email: `beta_${runId}@zagrosfm.iq`,
      phone: '+9647504445566',
    }).returning();

    // Single-Role User: COMPANY_MEMBER only
    const [companySingleUser] = await db.insert(users).values({
      email: singleCompanyEmail,
      firstName: 'Renas',
      lastName: 'Manager',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    await db.insert(organizationMembers).values({
      organizationId: orgBeta.id,
      userId: companySingleUser.id,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    });

    cleanups.push(async () => {
      await db.delete(organizationMembers).where(inArray(organizationMembers.userId, [companyDualUser.id, companySingleUser.id]));
      await db.delete(organizations).where(inArray(organizations.id, [orgAlpha.id, orgBeta.id]));
      await db.delete(users).where(inArray(users.id, [companyDualUser.id, companySingleUser.id]));
    });

    console.log('PostgreSQL synthetic fixtures seeded successfully.\n');

    // -------------------------------------------------------------------------
    // SCENARIO 1: COMPANY DASHBOARD QUICK WORKSPACE SWITCHER OPEN
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: COMPANY LOGIN & WORKSPACE SWITCHER OPEN ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', multiCompanyEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Multi-role user lands on onboarding workspace selection screen
    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    console.log('Initial workspace selection screen reached.');

    // Select Company Workspace Card
    const companyCardSelector = `#workspace-card-company_${orgAlpha.id}`;
    await page.waitForSelector(companyCardSelector, { timeout: 5000 });
    await page.click(companyCardSelector);
    await page.click('#select-workspace-submit-btn');

    // Wait for Company Workspace at /company
    await page.waitForURL('**/company', { timeout: 10000 });
    await page.waitForSelector('#company-header-switch-workspace-btn', { timeout: 10000 });
    console.log('Successfully reached Company Workspace at /company.');

    // Click quick switcher button in Company header
    await page.click('#company-header-switch-workspace-btn');
    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 5000 });
    await page.waitForSelector(companyCardSelector, { timeout: 5000 });
    await page.waitForSelector('#tenant-switcher-active-badge', { timeout: 5000 });
    await page.waitForSelector('#btn-select-workspace-tenant', { timeout: 5000 });

    const shot1 = '01-company-switcher-modal-open.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot1), fullPage: true });
    copyScreenshotToArtifacts(shot1);
    console.log(`[EVIDENCE] Screenshot captured: ${shot1}`);

    // -------------------------------------------------------------------------
    // SCENARIO 2: COMPANY SWITCHES TO TENANT WORKSPACE
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: COMPANY SWITCHES TO TENANT WORKSPACE ---');
    await page.click('#btn-select-workspace-tenant');

    // Wait for transition to /tenant
    await page.waitForURL('**/tenant', { timeout: 10000 });
    await page.waitForSelector('#tenant-main-header', { timeout: 10000 });
    console.log('Successfully transitioned from Company to Tenant Workspace (/tenant).');

    const shot2 = '02-company-switched-to-tenant.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot2), fullPage: true });
    copyScreenshotToArtifacts(shot2);
    console.log(`[EVIDENCE] Screenshot captured: ${shot2}`);

    // Clear local storage and cookies for single-workspace tests
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // -------------------------------------------------------------------------
    // SCENARIO 3: SINGLE-WORKSPACE COMPANY USER (ZERO FAKE ALTERNATIVES)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: SINGLE-WORKSPACE COMPANY USER (TRUTHFUL ZERO FAKE ALTERNATIVES) ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', singleCompanyEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Single-workspace user bypasses selection screen and lands directly at /company
    await page.waitForURL('**/company', { timeout: 10000 });
    await page.waitForSelector('#company-header-switch-workspace-btn', { timeout: 10000 });

    await page.click('#company-header-switch-workspace-btn');
    await page.waitForSelector('#tenant-no-alternative-workspaces-notice', { timeout: 5000 });
    await page.waitForSelector(`#workspace-card-company_${orgBeta.id}`, { timeout: 5000 });
    
    // Assert no fake alternatives exist
    const hasTenantCard = await page.$('#workspace-card-tenant');
    const hasAgentCard = await page.$('#workspace-card-agent');
    const hasVendorCard = await page.$('#workspace-card-vendor');
    const hasOwnerCard = await page.$('#workspace-card-owner_personal');

    if (hasTenantCard || hasAgentCard || hasVendorCard || hasOwnerCard) {
      throw new Error('Single-workspace company modal displayed fabricated alternatives!');
    }
    console.log('Single-workspace Company verified: Notice displayed and zero fake alternative options present.');

    const shot3 = '03-company-single-workspace-no-alternatives.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot3), fullPage: true });
    copyScreenshotToArtifacts(shot3);
    console.log(`[EVIDENCE] Screenshot captured: ${shot3}`);

    // Close modal
    await page.click('#tenant-switcher-close-btn');

    // -------------------------------------------------------------------------
    // SCENARIO 4: COMPANY PROFILE DROPDOWN SWITCHER ENTRY
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: COMPANY PROFILE DROPDOWN MENU SWITCHER ---');
    await page.waitForSelector('#company-profile-btn', { timeout: 5000 });
    await page.click('#company-profile-btn');
    await page.waitForSelector('#company-switch-workspace-btn', { timeout: 5000 });
    
    // Click switcher item from profile dropdown
    await page.click('#company-switch-workspace-btn');
    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 5000 });
    console.log('Successfully opened workspace switcher from profile dropdown menu.');

    const shot4 = '04-company-profile-dropdown-switcher.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot4), fullPage: true });
    copyScreenshotToArtifacts(shot4);
    console.log(`[EVIDENCE] Screenshot captured: ${shot4}`);

    console.log('\n================================================================');
    console.log('  ALL COMPANY PLAYWRIGHT SCENARIOS COMPLETED AND VERIFIED SUCCESSFULLY!');
    console.log('================================================================\n');

  } catch (error) {
    console.error('Playwright verification encountered an error:', error);
    throw error;
  } finally {
    await browser.close();
    for (const cleanup of cleanups) {
      await cleanup().catch(() => {});
    }
    server.close();
    process.exit(0);
  }
}

runCompanySwitcherPlaywright().catch((err) => {
  console.error('Fatal Playwright run failure:', err);
  process.exit(1);
});
