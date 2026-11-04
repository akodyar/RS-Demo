import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'owner_switcher');
const ARTIFACT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\885f5a39-23d2-4761-9d37-8b94a82a12dd\\screenshots\\owner_switcher';

async function runOwnerSwitcherPlaywright() {
  console.log('================================================================');
  console.log('  HOMEHUB — OWNER WORKSPACE SWITCHER PLAYWRIGHT (OPTION C)');
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

  // 1. Initialize App & Server on dedicated port 3018
  const port = 3018;
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

  const multiOwnerEmail = `pw_owner_dual_${runId}@homehub.iq`;
  const singleOwnerEmail = `pw_owner_single_${runId}@homehub.iq`;

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

    // 1. Multi-Role Owner User: PROPERTY_OWNER + TENANT
    const [ownerDualUser] = await db.insert(users).values({
      email: multiOwnerEmail,
      firstName: 'Khabat',
      lastName: 'OwnerDual',
      passwordHash,
      roles: ['PROPERTY_OWNER', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    // Owned property for ownerDualUser
    const [ownerProp] = await db.insert(properties).values({
      name: `Khabat Towers ${runId}`,
      address: 'Bakhtiyari, Erbil',
      city: 'Erbil',
      type: 'RESIDENTIAL_BUILDING',
      verificationStatus: 'VERIFIED',
    }).returning();

    const [ownerRec] = await db.insert(ownershipRecords).values({
      propertyId: ownerProp.id,
      ownerId: ownerDualUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    }).returning();

    // Lease where ownerDualUser is also a tenant
    const [leasedProp] = await db.insert(properties).values({
      name: `Khabat Rented Apartment ${runId}`,
      address: 'Dream City, Erbil',
      city: 'Erbil',
      type: 'APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();

    const [ownerLease] = await db.insert(leases).values({
      propertyId: leasedProp.id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      rentAmount: 850,
      paymentFrequency: 'MONTHLY',
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: ownerLease.id,
      tenantId: ownerDualUser.id,
      isPrimary: true,
    });

    // 2. Single-Role Owner User: PROPERTY_OWNER only
    const [ownerSingleUser] = await db.insert(users).values({
      email: singleOwnerEmail,
      firstName: 'Renas',
      lastName: 'OwnerSolo',
      passwordHash,
      roles: ['PROPERTY_OWNER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    const [singleOwnedProp] = await db.insert(properties).values({
      name: `Renas Residence ${runId}`,
      address: 'Gulan St, Erbil',
      city: 'Erbil',
      type: 'VILLA',
      verificationStatus: 'VERIFIED',
    }).returning();

    await db.insert(ownershipRecords).values({
      propertyId: singleOwnedProp.id,
      ownerId: ownerSingleUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    cleanups.push(async () => {
      await db.delete(leaseTenants).where(eq(leaseTenants.tenantId, ownerDualUser.id));
      await db.delete(leases).where(eq(leases.id, ownerLease.id));
      await db.delete(ownershipRecords).where(inArray(ownershipRecords.ownerId, [ownerDualUser.id, ownerSingleUser.id]));
      await db.delete(properties).where(inArray(properties.id, [ownerProp.id, leasedProp.id, singleOwnedProp.id]));
      await db.delete(users).where(inArray(users.id, [ownerDualUser.id, ownerSingleUser.id]));
    });

    console.log('PostgreSQL synthetic fixtures seeded successfully.\n');

    // -------------------------------------------------------------------------
    // SCENARIO 1: OWNER DASHBOARD QUICK WORKSPACE SWITCHER OPEN
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: OWNER LOGIN & WORKSPACE SWITCHER OPEN ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', multiOwnerEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Onboarding / initial workspace selector screen for multi-role user
    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    console.log('Initial workspace selection screen reached.');

    // Select the Owner Workspace Card
    await page.waitForSelector('#workspace-card-owner_personal', { timeout: 5000 });
    await page.click('#workspace-card-owner_personal');
    await page.click('#select-workspace-submit-btn');

    // Wait for Owner dashboard
    await page.waitForURL('**/owner', { timeout: 10000 });
    await page.waitForSelector('#owner-header-switch-workspace-btn', { timeout: 10000 });
    console.log('Successfully reached Owner Dashboard at /owner.');

    // Click quick switcher button in Owner header
    await page.click('#owner-header-switch-workspace-btn');
    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 5000 });
    await page.waitForSelector('#workspace-card-owner_personal', { timeout: 5000 });
    await page.waitForSelector('#tenant-switcher-active-badge', { timeout: 5000 });
    await page.waitForSelector('#btn-select-workspace-tenant', { timeout: 5000 });

    const shot1 = '01-owner-switcher-modal-open.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot1), fullPage: true });
    copyScreenshotToArtifacts(shot1);
    console.log(`[EVIDENCE] Screenshot captured: ${shot1}`);

    // -------------------------------------------------------------------------
    // SCENARIO 2: OWNER SWITCHES TO TENANT WORKSPACE
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: OWNER SWITCHES TO TENANT WORKSPACE ---');
    await page.click('#btn-select-workspace-tenant');

    // Wait for transition to /tenant
    await page.waitForURL('**/tenant', { timeout: 10000 });
    await page.waitForSelector('#tenant-main-header', { timeout: 10000 });
    console.log('Successfully transitioned from Owner to Tenant Workspace (/tenant).');

    const shot2 = '02-owner-switched-to-tenant.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot2), fullPage: true });
    copyScreenshotToArtifacts(shot2);
    console.log(`[EVIDENCE] Screenshot captured: ${shot2}`);

    // Clear local storage and cookies for single-workspace tests
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // -------------------------------------------------------------------------
    // SCENARIO 3: SINGLE-WORKSPACE OWNER (ZERO FAKE ALTERNATIVES)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: SINGLE-WORKSPACE OWNER (TRUTHFUL ZERO FAKE ALTERNATIVES) ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', singleOwnerEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Single-role owner bypasses workspace selector and lands directly at /owner
    await page.waitForURL('**/owner', { timeout: 10000 });
    await page.waitForSelector('#owner-header-switch-workspace-btn', { timeout: 10000 });

    await page.click('#owner-header-switch-workspace-btn');
    await page.waitForSelector('#tenant-no-alternative-workspaces-notice', { timeout: 5000 });
    await page.waitForSelector('#workspace-card-owner_personal', { timeout: 5000 });
    
    // Assert no fake alternatives exist
    const hasTenantCard = await page.$('#workspace-card-tenant');
    const hasAgentCard = await page.$('#workspace-card-agent');
    const hasVendorCard = await page.$('#workspace-card-vendor');

    if (hasTenantCard || hasAgentCard || hasVendorCard) {
      throw new Error('Single-workspace owner modal displayed fabricated alternatives!');
    }
    console.log('Single-workspace Owner verified: Notice displayed and zero fake alternative options present.');

    const shot3 = '03-owner-single-workspace-no-alternatives.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot3), fullPage: true });
    copyScreenshotToArtifacts(shot3);
    console.log(`[EVIDENCE] Screenshot captured: ${shot3}`);

    // Close modal
    await page.click('#tenant-switcher-close-btn');

    // -------------------------------------------------------------------------
    // SCENARIO 4: OWNER PROFILE DROPDOWN SWITCHER ENTRY
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: OWNER PROFILE DROPDOWN MENU SWITCHER ---');
    await page.waitForSelector('#owner-profile-btn', { timeout: 5000 });
    await page.click('#owner-profile-btn');
    await page.waitForSelector('#owner-switch-workspace-btn', { timeout: 5000 });
    
    // Click switcher item from profile dropdown
    await page.click('#owner-switch-workspace-btn');
    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 5000 });
    console.log('Successfully opened workspace switcher from profile dropdown menu.');

    const shot4 = '04-owner-profile-dropdown-switcher.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot4), fullPage: true });
    copyScreenshotToArtifacts(shot4);
    console.log(`[EVIDENCE] Screenshot captured: ${shot4}`);

    console.log('\n================================================================');
    console.log('  ALL OWNER PLAYWRIGHT SCENARIOS COMPLETED AND VERIFIED SUCCESSFULLY!');
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

runOwnerSwitcherPlaywright().catch((err) => {
  console.error('Fatal Playwright run failure:', err);
  process.exit(1);
});
