import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword, signAuthToken } from '../src/server/utils/auth.js';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'tenant_switcher');
const ARTIFACT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\885f5a39-23d2-4761-9d37-8b94a82a12dd\\screenshots\\tenant_switcher';

async function runTenantWorkspaceSwitcherPlaywright() {
  console.log('================================================================');
  console.log('  HOMEHUB — TENANT WORKSPACE SWITCHER PLAYWRIGHT (OPTION C)');
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

  // 1. Initialize App & Server
  const port = 3014;
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

  const multiUserEmail = `pw_dual_tenant_${runId}@homehub.iq`;
  const singleUserEmail = `pw_single_tenant_${runId}@homehub.iq`;

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

    // 1. Dual User: TENANT + PROPERTY_OWNER
    const [dualUser] = await db.insert(users).values({
      email: multiUserEmail,
      firstName: 'Kardo',
      lastName: 'Dual',
      passwordHash,
      roles: ['TENANT', 'PROPERTY_OWNER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    console.log(`Created Dual User: ${dualUser.id} (${dualUser.email})`);

    // Property owned by dualUser
    const [ownedProp] = await db.insert(properties).values({
      name: `Kardo Executive Tower ${runId}`,
      address: 'Gulan St, Erbil',
      city: 'Erbil',
      type: 'RESIDENTIAL_BUILDING',
      verificationStatus: 'VERIFIED',
    }).returning();

    await db.insert(ownershipRecords).values({
      propertyId: ownedProp.id,
      ownerId: dualUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    // Lease where dualUser is tenant
    const [leasedProp] = await db.insert(properties).values({
      name: `Skyline Apartment 402 ${runId}`,
      address: 'Bakhtiyari, Erbil',
      city: 'Erbil',
      type: 'APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();

    const [activeLease] = await db.insert(leases).values({
      propertyId: leasedProp.id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      rentAmount: 850,
      paymentFrequency: 'MONTHLY',
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: activeLease.id,
      tenantId: dualUser.id,
      isPrimary: true,
    });

    // 2. Single User: TENANT only
    const [singleUser] = await db.insert(users).values({
      email: singleUserEmail,
      firstName: 'Diyar',
      lastName: 'TenantOnly',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    console.log(`Created Single Tenant User: ${singleUser.id} (${singleUser.email})`);

    const [singleLeaseProp] = await db.insert(properties).values({
      name: `Empire World Suite 201 ${runId}`,
      address: 'Airport Road, Erbil',
      city: 'Erbil',
      type: 'APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();

    const [singleActiveLease] = await db.insert(leases).values({
      propertyId: singleLeaseProp.id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      rentAmount: 1100,
      paymentFrequency: 'MONTHLY',
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: singleActiveLease.id,
      tenantId: singleUser.id,
      isPrimary: true,
    });

    cleanups.push(async () => {
      await db.delete(leaseTenants).where(inArray(leaseTenants.tenantId, [dualUser.id, singleUser.id]));
      await db.delete(leases).where(inArray(leases.id, [activeLease.id, singleActiveLease.id]));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.ownerId, dualUser.id));
      await db.delete(properties).where(inArray(properties.id, [ownedProp.id, leasedProp.id, singleLeaseProp.id]));
      await db.delete(users).where(inArray(users.id, [dualUser.id, singleUser.id]));
    });

    // -------------------------------------------------------------------------
    // SCENARIO 1: DUAL USER LOGIN & TENANT WORKSPACE ENTRY
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 1: LOGIN & ENTER TENANT WORKSPACE ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', multiUserEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Onboarding / initial workspace selector screen for multi-role user
    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    console.log('Workspace selection screen reached.');

    // Select the Tenant Workspace Card
    await page.waitForSelector('#workspace-card-tenant', { timeout: 5000 });
    await page.click('#workspace-card-tenant');
    await page.click('#select-workspace-submit-btn');

    // Wait for Tenant dashboard
    await page.waitForURL('**/tenant', { timeout: 10000 });
    await page.waitForSelector('#tenant-main-header', { timeout: 10000 });
    console.log('Successfully entered Tenant Workspace at /tenant.');

    // Screenshot 1: Tenant Workspace Active
    const shot1 = '01-tenant-workspace-active.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot1), fullPage: true });
    copyScreenshotToArtifacts(shot1);
    console.log(`Captured Screenshot: ${shot1}`);

    // -------------------------------------------------------------------------
    // SCENARIO 2: OPEN TENANT WORKSPACE SWITCHER MODAL
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: OPEN TENANT WORKSPACE SWITCHER MODAL ---');
    
    // Open user dropdown in header
    await page.click('#tenant-profile-btn');
    await page.waitForSelector('#header-switch-account-btn', { timeout: 5000 });

    // Click Switch Workspace
    await page.click('#header-switch-account-btn');

    // Wait for TenantWorkspaceSwitcherModal dialog
    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 5000 });
    await page.waitForSelector('#workspace-card-tenant', { timeout: 5000 });
    await page.waitForSelector('#workspace-card-owner_personal', { timeout: 5000 });
    console.log('Authoritative Tenant Workspace Switcher modal is visible.');

    // Verify Active badge on Tenant card
    const activeBadgeExists = await page.isVisible('#tenant-switcher-active-badge');
    console.log(`Active badge on current workspace: ${activeBadgeExists}`);

    // Screenshot 2: Switcher Modal Open with Authoritative Workspaces
    const shot2 = '02-tenant-switcher-modal-open.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot2), fullPage: true });
    copyScreenshotToArtifacts(shot2);
    console.log(`Captured Screenshot: ${shot2}`);

    // -------------------------------------------------------------------------
    // SCENARIO 3: SELECT ALTERNATIVE ELIGIBLE WORKSPACE (OWNER)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: SWITCH WORKSPACE TO PROPERTY OWNER ---');
    await page.click('#btn-select-workspace-owner_personal');

    // Verify server-authorized transition to /owner
    await page.waitForURL('**/owner', { timeout: 10000 });
    await page.waitForSelector('h1, h2, [role="main"]', { timeout: 10000 });
    console.log('Successfully navigated to Property Owner workspace (/owner) via server-authorized switch!');

    // Screenshot 3: Active Owner Workspace after transition
    const shot3 = '03-owner-workspace-after-switch.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot3), fullPage: true });
    copyScreenshotToArtifacts(shot3);
    console.log(`Captured Screenshot: ${shot3}`);

    // Check localStorage auth state
    const authStorage = await page.evaluate(() => {
      const activeWs = localStorage.getItem('homehub_active_workspace');
      return activeWs ? JSON.parse(activeWs) : null;
    });
    console.log('Active Workspace in Storage after switch:', authStorage);
    if (authStorage?.role !== 'PROPERTY_OWNER' || authStorage?.workspaceId !== 'owner_personal') {
      throw new Error(`Expected activeRole PROPERTY_OWNER in localStorage, got ${authStorage?.role}`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 4: SINGLE-ROLE TENANT (NO FAKE ALTERNATIVES)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: SINGLE-ROLE TENANT (NO FAKE ALTERNATIVES) ---');
    // Clear storage and log out
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', singleUserEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Single-role tenant should bypass multi-role picker and route directly to /tenant
    await page.waitForURL('**/tenant', { timeout: 10000 });
    await page.waitForSelector('#tenant-main-header', { timeout: 10000 });
    console.log('Single tenant logged in directly into /tenant.');

    // Open user menu and switcher
    await page.click('#tenant-profile-btn');
    await page.waitForSelector('#header-switch-account-btn', { timeout: 5000 });
    await page.click('#header-switch-account-btn');

    // Wait for modal
    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 5000 });
    await page.waitForSelector('#tenant-no-alternative-workspaces-notice', { timeout: 5000 });
    console.log('Notice of no alternative workspaces displayed correctly.');

    // Screenshot 4: Single-role modal with no fake alternatives
    const shot4 = '04-single-tenant-no-alternatives.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot4), fullPage: true });
    copyScreenshotToArtifacts(shot4);
    console.log(`Captured Screenshot: ${shot4}`);

    // Verify mock personas are NOT present
    const pageContent = await page.content();
    const hasMockAhmed = pageContent.includes('Ahmed Farhad');
    const hasMockSalar = pageContent.includes('Salar Aziz');
    const hasMockZagros = pageContent.includes('Zagros Real Estate • 45 Units');
    console.log(`Mock personas present in single tenant modal: ${hasMockAhmed || hasMockSalar || hasMockZagros}`);
    if (hasMockAhmed || hasMockSalar || hasMockZagros) {
      throw new Error('FAIL: Hardcoded mock personas detected in Tenant Workspace Switcher modal!');
    }

    // Close modal
    await page.click('#tenant-switcher-close-btn');
    await page.waitForSelector('#tenant-switcher-modal-title', { state: 'hidden', timeout: 5000 });
    console.log('Modal closed cleanly.');

    console.log('\n================================================================');
    console.log('  ALL BROWSER PLAYWRIGHT VERIFICATION SCENARIOS PASSED (OPTION C)');
    console.log('================================================================\n');

  } finally {
    await browser.close();
    for (const cleanup of cleanups) {
      await cleanup().catch(() => {});
    }
    server.close();
  }
}

runTenantWorkspaceSwitcherPlaywright()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('Playwright verification failed:', err);
  process.exit(1);
});
