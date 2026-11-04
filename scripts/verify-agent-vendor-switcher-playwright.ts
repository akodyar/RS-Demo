import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'agent_vendor_switcher');
const ARTIFACT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\885f5a39-23d2-4761-9d37-8b94a82a12dd\\screenshots\\agent_vendor_switcher';

async function runAgentVendorSwitcherPlaywright() {
  console.log('================================================================');
  console.log('  HOMEHUB — AGENT & VENDOR WORKSPACE SWITCHER PLAYWRIGHT (OPTION C)');
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
  const port = 3016;
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

  const multiAgentEmail = `pw_agent_dual_${runId}@homehub.iq`;
  const multiVendorEmail = `pw_vendor_dual_${runId}@homehub.iq`;
  const singleAgentEmail = `pw_agent_single_${runId}@homehub.iq`;
  const singleVendorEmail = `pw_vendor_single_${runId}@homehub.iq`;

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

    // 1. Multi-Role Agent User: AGENT + TENANT
    const [agentDualUser] = await db.insert(users).values({
      email: multiAgentEmail,
      firstName: 'Dara',
      lastName: 'AgentDual',
      passwordHash,
      roles: ['AGENT', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    // Lease where agentDualUser is tenant
    const [agentLeasedProp] = await db.insert(properties).values({
      name: `Agent Dual Residence ${runId}`,
      address: 'Dream City, Erbil',
      city: 'Erbil',
      type: 'APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();

    const [agentLease] = await db.insert(leases).values({
      propertyId: agentLeasedProp.id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      rentAmount: 900,
      paymentFrequency: 'MONTHLY',
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: agentLease.id,
      tenantId: agentDualUser.id,
      isPrimary: true,
    });

    // 2. Multi-Role Vendor User: VENDOR + TENANT
    const [vendorDualUser] = await db.insert(users).values({
      email: multiVendorEmail,
      firstName: 'Rawand',
      lastName: 'VendorDual',
      passwordHash,
      roles: ['VENDOR', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    // Lease where vendorDualUser is tenant
    const [vendorLeasedProp] = await db.insert(properties).values({
      name: `Vendor Dual Residence ${runId}`,
      address: 'Italian City 2, Erbil',
      city: 'Erbil',
      type: 'APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();

    const [vendorLease] = await db.insert(leases).values({
      propertyId: vendorLeasedProp.id,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      rentAmount: 750,
      paymentFrequency: 'MONTHLY',
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: vendorLease.id,
      tenantId: vendorDualUser.id,
      isPrimary: true,
    });

    // 3. Single-Role Agent User
    const [agentSingleUser] = await db.insert(users).values({
      email: singleAgentEmail,
      firstName: 'Hiwa',
      lastName: 'AgentSolo',
      passwordHash,
      roles: ['AGENT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    // 4. Single-Role Vendor User
    const [vendorSingleUser] = await db.insert(users).values({
      email: singleVendorEmail,
      firstName: 'Karwan',
      lastName: 'VendorSolo',
      passwordHash,
      roles: ['VENDOR'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    cleanups.push(async () => {
      await db.delete(leaseTenants).where(inArray(leaseTenants.tenantId, [agentDualUser.id, vendorDualUser.id]));
      await db.delete(leases).where(inArray(leases.id, [agentLease.id, vendorLease.id]));
      await db.delete(properties).where(inArray(properties.id, [agentLeasedProp.id, vendorLeasedProp.id]));
      await db.delete(users).where(inArray(users.id, [
        agentDualUser.id,
        vendorDualUser.id,
        agentSingleUser.id,
        vendorSingleUser.id,
      ]));
    });

    console.log('PostgreSQL synthetic fixtures seeded successfully.\n');

    // -------------------------------------------------------------------------
    // SCENARIO 1: AGENT DASHBOARD WORKSPACE SWITCHER OPEN
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: AGENT LOGIN & WORKSPACE SWITCHER OPEN ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', multiAgentEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Onboarding / initial workspace selector screen for multi-role user
    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    console.log('Initial workspace selection screen reached.');

    // Select the Agent Workspace Card
    await page.waitForSelector('#workspace-card-agent', { timeout: 5000 });
    await page.click('#workspace-card-agent');
    await page.click('#select-workspace-submit-btn');

    // Wait for Agent dashboard
    await page.waitForURL('**/agent', { timeout: 10000 });
    await page.waitForSelector('#agent-header-switch-workspace-btn', { timeout: 10000 });
    console.log('Successfully reached Agent Dashboard at /agent.');

    // Click quick switcher button in Agent header
    await page.click('#agent-header-switch-workspace-btn');
    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 5000 });
    await page.waitForSelector('#workspace-card-agent', { timeout: 5000 });
    await page.waitForSelector('#btn-select-workspace-tenant', { timeout: 5000 });

    const shot1 = '01-agent-switcher-modal-open.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot1), fullPage: true });
    copyScreenshotToArtifacts(shot1);
    console.log(`[EVIDENCE] Screenshot captured: ${shot1}`);

    // -------------------------------------------------------------------------
    // SCENARIO 2: AGENT SWITCHES TO TENANT WORKSPACE
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: AGENT SWITCHES TO TENANT WORKSPACE ---');
    await page.click('#btn-select-workspace-tenant');

    // Wait for transition to /tenant
    await page.waitForURL('**/tenant', { timeout: 10000 });
    await page.waitForSelector('#tenant-main-header', { timeout: 10000 });
    console.log('Successfully transitioned from Agent to Tenant Workspace (/tenant).');

    const shot2 = '02-agent-switched-to-tenant.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot2), fullPage: true });
    copyScreenshotToArtifacts(shot2);
    console.log(`[EVIDENCE] Screenshot captured: ${shot2}`);

    // Clear local storage and cookies for next test
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // -------------------------------------------------------------------------
    // SCENARIO 3: VENDOR DASHBOARD WORKSPACE SWITCHER OPEN
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: VENDOR LOGIN & WORKSPACE SWITCHER OPEN ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', multiVendorEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Onboarding / initial workspace selector screen for multi-role user
    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    console.log('Initial workspace selection screen reached for Vendor.');

    // Select the Vendor Workspace Card
    await page.waitForSelector('#workspace-card-vendor', { timeout: 5000 });
    await page.click('#workspace-card-vendor');
    await page.click('#select-workspace-submit-btn');

    // Wait for Vendor dashboard
    await page.waitForURL('**/vendor', { timeout: 10000 });
    await page.waitForSelector('#vendor-switch-workspace-btn', { timeout: 10000 });
    console.log('Successfully reached Vendor Dashboard at /vendor.');

    // Click quick switcher button in Vendor header
    await page.click('#vendor-switch-workspace-btn');
    await page.waitForSelector('#tenant-switcher-modal-title', { timeout: 5000 });
    await page.waitForSelector('#workspace-card-vendor', { timeout: 5000 });
    await page.waitForSelector('#btn-select-workspace-tenant', { timeout: 5000 });

    const shot3 = '03-vendor-switcher-modal-open.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot3), fullPage: true });
    copyScreenshotToArtifacts(shot3);
    console.log(`[EVIDENCE] Screenshot captured: ${shot3}`);

    // -------------------------------------------------------------------------
    // SCENARIO 4: VENDOR SWITCHES TO TENANT WORKSPACE
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: VENDOR SWITCHES TO TENANT WORKSPACE ---');
    await page.click('#btn-select-workspace-tenant');

    // Wait for transition to /tenant
    await page.waitForURL('**/tenant', { timeout: 10000 });
    await page.waitForSelector('#tenant-main-header', { timeout: 10000 });
    console.log('Successfully transitioned from Vendor to Tenant Workspace (/tenant).');

    const shot4 = '04-vendor-switched-to-tenant.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot4), fullPage: true });
    copyScreenshotToArtifacts(shot4);
    console.log(`[EVIDENCE] Screenshot captured: ${shot4}`);

    // Clear local storage and cookies for single-workspace tests
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // -------------------------------------------------------------------------
    // SCENARIO 5: SINGLE-WORKSPACE AGENT (ZERO FAKE ALTERNATIVES)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: SINGLE-WORKSPACE AGENT (TRUTHFUL ZERO FAKE ALTERNATIVES) ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', singleAgentEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Single-role user bypasses workspace selector and lands directly at /agent
    await page.waitForURL('**/agent', { timeout: 10000 });
    await page.waitForSelector('#agent-header-switch-workspace-btn', { timeout: 10000 });

    await page.click('#agent-header-switch-workspace-btn');
    await page.waitForSelector('#tenant-no-alternative-workspaces-notice', { timeout: 5000 });
    console.log('Single-workspace Agent verified: Notice displayed that no alternative workspaces exist.');

    const shot5 = '05-agent-single-workspace-no-alternatives.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot5), fullPage: true });
    copyScreenshotToArtifacts(shot5);
    console.log(`[EVIDENCE] Screenshot captured: ${shot5}`);

    // Clear local storage and cookies
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // -------------------------------------------------------------------------
    // SCENARIO 6: SINGLE-WORKSPACE VENDOR (ZERO FAKE ALTERNATIVES)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 6: SINGLE-WORKSPACE VENDOR (TRUTHFUL ZERO FAKE ALTERNATIVES) ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', singleVendorEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Single-role vendor bypasses workspace selector and lands directly at /vendor
    await page.waitForURL('**/vendor', { timeout: 10000 });
    await page.waitForSelector('#vendor-switch-workspace-btn', { timeout: 10000 });

    await page.click('#vendor-switch-workspace-btn');
    await page.waitForSelector('#tenant-no-alternative-workspaces-notice', { timeout: 5000 });
    console.log('Single-workspace Vendor verified: Notice displayed that no alternative workspaces exist.');

    const shot6 = '06-vendor-single-workspace-no-alternatives.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot6), fullPage: true });
    copyScreenshotToArtifacts(shot6);
    console.log(`[EVIDENCE] Screenshot captured: ${shot6}`);

    console.log('\n================================================================');
    console.log('  ALL PLAYWRIGHT SCENARIOS COMPLETED AND VERIFIED SUCCESSFULLY!');
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

runAgentVendorSwitcherPlaywright().catch((err) => {
  console.error('Fatal Playwright run failure:', err);
  process.exit(1);
});
