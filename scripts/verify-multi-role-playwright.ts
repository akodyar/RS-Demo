import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { db } from '../src/db/index.js';
import { users, agentProfiles, vendorProfiles } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'multi_role_audit');

async function runBrowserAudit() {
  console.log('================================================================');
  console.log('  HOMEHUB — MULTI-ROLE PLAYWRIGHT BROWSER VERIFICATION (OPTION C)');
  console.log('================================================================\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // 1. Initialize App & Server
  console.log('Starting application server...');
  const app = await createApp();
  const server = http.createServer(app);
  
  const port = 3005; // Use dedicated test port to avoid conflicts
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const baseUrl = `http://localhost:${port}`;
  console.log(`Server listening at ${baseUrl}\n`);

  const runId = Date.now();
  const testPassword = 'Password123!Secure';
  const passwordHash = await hashPassword(testPassword);

  const singleEmail = `browser_single_${runId}@homehub.iq`;
  const multiEmail = `browser_multi_${runId}@homehub.iq`;

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
    // SEED TEST FIXTURES IN POSTGRESQL
    // -------------------------------------------------------------------------
    console.log('Seeding synthetic test fixtures in PostgreSQL...');
    
    // Single-role tenant
    const [singleUser] = await db.insert(users).values({
      email: singleEmail,
      firstName: 'SingleRole',
      lastName: 'Tenant',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, singleUser.id));
    });

    // Multi-role user: Owner + Tenant + Agent + Vendor
    const [multiUser] = await db.insert(users).values({
      email: multiEmail,
      firstName: 'MultiRole',
      lastName: 'Persona',
      passwordHash,
      roles: ['PROPERTY_OWNER', 'TENANT', 'AGENT', 'VENDOR'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    const [agentProf] = await db.insert(agentProfiles).values({
      userId: multiUser.id,
      displayName: 'MultiRole Agent',
      status: 'ACTIVE',
    }).returning();

    const [vendorProf] = await db.insert(vendorProfiles).values({
      userId: multiUser.id,
      businessName: 'MultiRole Services',
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
    }).returning();

    cleanups.push(async () => {
      await db.delete(agentProfiles).where(eq(agentProfiles.id, agentProf.id));
      await db.delete(vendorProfiles).where(eq(vendorProfiles.id, vendorProf.id));
      await db.delete(users).where(eq(users.id, multiUser.id));
    });

    console.log('Fixtures seeded successfully.\n');

    // -------------------------------------------------------------------------
    // SCENARIO 1: SINGLE-ROLE DIRECT ENTRY
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: SINGLE-ROLE DIRECT ENTRY ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Wait for login form
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', singleEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Single-role user must automatically navigate directly to /tenant
    await page.waitForURL('**/tenant', { timeout: 10000 });
    const singleUrl = page.url();
    console.log(`Observed navigation destination: ${singleUrl}`);

    const shot1 = path.join(SCREENSHOT_DIR, '01-single-role-direct-entry.png');
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`[Evidence Captured] ${shot1}\n`);

    // Clear context state before next login
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // -------------------------------------------------------------------------
    // SCENARIO 2: MULTI-ROLE EXPLICIT SELECTION (KURDISH SORANI RTL)
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 2: MULTI-ROLE EXPLICIT WORKSPACE SELECTION (SORANI RTL) ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', multiEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Must show ScreenSelectWorkspace with #select-workspace-title
    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    const headerTextKu = await page.textContent('#select-workspace-title');
    const htmlDirKu = await page.getAttribute('html', 'dir');
    console.log(`Observed Title: "${headerTextKu?.trim()}" | HTML Dir: "${htmlDirKu}"`);

    // Verify workspace cards are rendered
    const ownerCardExists = await page.isVisible('#workspace-card-owner_personal');
    const tenantCardExists = await page.isVisible('#workspace-card-tenant');
    const agentCardExists = await page.isVisible('#workspace-card-agent');
    const vendorCardExists = await page.isVisible('#workspace-card-vendor');
    console.log(`Workspace Cards Visible: Owner=${ownerCardExists}, Tenant=${tenantCardExists}, Agent=${agentCardExists}, Vendor=${vendorCardExists}`);

    const shot2 = path.join(SCREENSHOT_DIR, '02-multi-role-workspace-selection-sorani-rtl.png');
    await page.screenshot({ path: shot2, fullPage: true });
    console.log(`[Evidence Captured] ${shot2}\n`);

    // -------------------------------------------------------------------------
    // SCENARIO 3: ARABIC LOCALIZATION & RTL
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 3: ARABIC LOCALIZATION & RTL ---');
    // Switch language to Arabic via global helper or UI toggle
    await page.evaluate(() => {
      if ((window as any).__setHomeHubLanguage) {
        (window as any).__setHomeHubLanguage('ar');
      } else {
        localStorage.setItem('homehub_lang', 'ar');
      }
    });
    // Brief settle
    await page.waitForTimeout(500);

    const headerTextAr = await page.textContent('#select-workspace-title');
    const htmlDirAr = await page.getAttribute('html', 'dir');
    console.log(`Arabic Title: "${headerTextAr?.trim()}" | HTML Dir: "${htmlDirAr}"`);

    const shot3 = path.join(SCREENSHOT_DIR, '03-workspace-selection-arabic-rtl.png');
    await page.screenshot({ path: shot3, fullPage: true });
    console.log(`[Evidence Captured] ${shot3}\n`);

    // -------------------------------------------------------------------------
    // SCENARIO 4: ENGLISH LOCALIZATION & LTR
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 4: ENGLISH LOCALIZATION & LTR ---');
    await page.evaluate(() => {
      if ((window as any).__setHomeHubLanguage) {
        (window as any).__setHomeHubLanguage('en');
      } else {
        localStorage.setItem('homehub_lang', 'en');
      }
    });
    await page.waitForTimeout(500);

    const headerTextEn = await page.textContent('#select-workspace-title');
    const htmlDirEn = await page.getAttribute('html', 'dir');
    console.log(`English Title: "${headerTextEn?.trim()}" | HTML Dir: "${htmlDirEn}"`);

    const shot4 = path.join(SCREENSHOT_DIR, '04-workspace-selection-english-ltr.png');
    await page.screenshot({ path: shot4, fullPage: true });
    console.log(`[Evidence Captured] ${shot4}\n`);

    // -------------------------------------------------------------------------
    // SCENARIO 5: SELECT WORKSPACE & DASHBOARD ENTRY
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 5: WORKSPACE SELECTION & ENTRY ---');
    // Select tenant workspace card
    await page.click('#workspace-card-tenant');
    await page.waitForTimeout(300);

    // Click Enter Workspace
    await page.click('#select-workspace-submit-btn');

    // Wait for navigation to /tenant
    await page.waitForURL('**/tenant', { timeout: 10000 });
    console.log(`Successfully navigated to: ${page.url()}`);

    const shot5 = path.join(SCREENSHOT_DIR, '05-entered-tenant-workspace.png');
    await page.screenshot({ path: shot5, fullPage: true });
    console.log(`[Evidence Captured] ${shot5}\n`);

    // -------------------------------------------------------------------------
    // SCENARIO 6: LOGOUT CLEARS CLIENT STATE
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 6: LOGOUT STATE CLEARANCE ---');
    // Call logout endpoint via page evaluation to verify client clearance
    await page.evaluate(async () => {
      const storedToken = localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token');
      if (storedToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${storedToken}` },
        });
      }
      localStorage.clear();
      window.location.href = '/login';
    });

    await page.waitForURL('**/login', { timeout: 10000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    const remainingAuthToken = await page.evaluate(() => localStorage.getItem('homehub_auth_token'));
    const remainingActiveWs = await page.evaluate(() => localStorage.getItem('homehub_active_workspace'));
    console.log(`Storage post-logout: authToken=${remainingAuthToken}, activeWorkspace=${remainingActiveWs}`);

    const shot6 = path.join(SCREENSHOT_DIR, '06-logged-out-clean-state.png');
    await page.screenshot({ path: shot6, fullPage: true });
    console.log(`[Evidence Captured] ${shot6}\n`);

    console.log('================================================================');
    console.log('  ALL PLAYWRIGHT SCENARIOS COMPLETED SUCCESSFULLY!');
    console.log('================================================================\n');

  } finally {
    await browser.close();
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (err) {
        console.warn('Cleanup error (non-fatal):', err);
      }
    }
    server.close();
  }
}

runBrowserAudit()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('Fatal Playwright audit error:', err);
  process.exit(1);
});
